import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';
import { todayPKT } from '@/lib/format';
import { dayOfWeekPKT, detectConflicts, notifyAbsences, sectionDayComplete } from '@/lib/attendance';
import { invalidateDashboard } from '@/lib/dashboard';
import type { AttendanceStatus } from '@prisma/client';

const STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'PENDING'];

/**
 * GET /api/attendance/period?sectionId=&date= — period-register data:
 * today's timetable slots for the section, active students, and already
 * submitted rows keyed "periodNo|studentId".
 */
export async function GET(req: Request) {
  const auth = await apiUser('attendance.period');
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const sectionId = url.searchParams.get('sectionId')?.trim() ?? '';
  const date = url.searchParams.get('date')?.trim() || todayPKT();
  if (!sectionId) return NextResponse.json({ error: 'sectionId is required' }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date format; expected YYYY-MM-DD' }, { status: 400 });
  }

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: { grade: { select: { name: true } } },
  });
  if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 });

  // Teachers may only access sections they're assigned to.
  if (auth.user.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: auth.user.id },
      select: { id: true },
    });
    if (!teacher) return NextResponse.json({ error: 'Teacher record not found' }, { status: 403 });
    const [slotCount, allocCount] = await Promise.all([
      prisma.timetableSlot.count({ where: { teacherId: teacher.id, sectionId } }),
      prisma.subjectAllocation.count({ where: { teacherId: teacher.id, gradeId: section.gradeId } }),
    ]);
    if (slotCount === 0 && allocCount === 0) {
      return NextResponse.json({ error: 'You are not assigned to this section.' }, { status: 403 });
    }
  }

  const dow = dayOfWeekPKT(date);
  const [slots, students, rows] = await Promise.all([
    prisma.timetableSlot.findMany({
      where: { sectionId, dayOfWeek: dow },
      include: {
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, user: { select: { name: true } } } },
      },
      orderBy: { periodNo: 'asc' },
    }),
    prisma.student.findMany({
      where: { sectionId, isActive: true },
      select: { id: true, name: true, admissionNo: true },
      orderBy: { name: 'asc' },
    }),
    prisma.periodAttendance.findMany({
      where: { sectionId, date },
      select: { periodNo: true, studentId: true, status: true },
    }),
  ]);

  const existing: Record<string, AttendanceStatus> = {};
  for (const r of rows) existing[`${r.periodNo}|${r.studentId}`] = r.status;

  return NextResponse.json({
    date,
    section: { id: section.id, label: `${section.grade.name} – Section ${section.name}` },
    slots: slots.map((s) => ({
      periodNo: s.periodNo,
      subjectId: s.subject.id,
      subject: s.subject.name,
      teacher: s.teacher.user?.name ?? '—',
      time: `${s.startTime}–${s.endTime}`,
      room: s.room,
    })),
    students,
    existing,
  });
}

interface EntryInput {
  studentId?: string;
  status?: string;
}

/**
 * POST /api/attendance/period { sectionId, date, periodNo, subjectId, entries }
 * Upserts the period register (one status per student). Afterwards runs
 * conflict detection, and if the section day is complete, absence
 * notifications — never before.
 */
export async function POST(req: Request) {
  const auth = await apiUser('attendance.period');
  if (auth.error) return auth.error;
  const { user } = auth;

  let body: {
    sectionId?: string;
    date?: string;
    periodNo?: number;
    subjectId?: string;
    entries?: EntryInput[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { sectionId, date, periodNo, subjectId, entries } = body;
  if (!sectionId || !date || !periodNo || !subjectId || !Array.isArray(entries)) {
    return NextResponse.json(
      { error: 'sectionId, date, periodNo, subjectId and entries[] are required' },
      { status: 400 },
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date format; expected YYYY-MM-DD' }, { status: 400 });
  }

  const slot = await prisma.timetableSlot.findUnique({
    where: { sectionId_dayOfWeek_periodNo: { sectionId, dayOfWeek: dayOfWeekPKT(date), periodNo } },
    include: { section: { select: { gradeId: true } } },
  });
  if (!slot) return NextResponse.json({ error: `No timetable period ${periodNo} for this section on ${date}` }, { status: 400 });
  if (slot.subjectId !== subjectId) {
    return NextResponse.json({ error: 'subjectId does not match the timetable slot for this period' }, { status: 400 });
  }

  // Teachers may only submit for sections they're assigned to.
  if (user.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!teacher) return NextResponse.json({ error: 'Teacher record not found' }, { status: 403 });
    const [slotCount, allocCount] = await Promise.all([
      prisma.timetableSlot.count({ where: { teacherId: teacher.id, sectionId } }),
      prisma.subjectAllocation.count({ where: { teacherId: teacher.id, gradeId: slot.section.gradeId } }),
    ]);
    if (slotCount === 0 && allocCount === 0) {
      return NextResponse.json({ error: 'You are not assigned to this section.' }, { status: 403 });
    }
  }

  const students = await prisma.student.findMany({
    where: { sectionId, isActive: true },
    select: { id: true },
  });
  const memberIds = new Set(students.map((s) => s.id));

  let saved = 0;
  for (const e of entries) {
    if (!e.studentId || !memberIds.has(e.studentId)) continue;
    if (!e.status || !STATUSES.includes(e.status as AttendanceStatus)) continue;
    await prisma.periodAttendance.upsert({
      where: {
        sectionId_subjectId_date_periodNo_studentId: {
          sectionId, subjectId, date, periodNo, studentId: e.studentId,
        },
      },
      create: {
        sectionId, subjectId, date, periodNo,
        studentId: e.studentId,
        status: e.status as AttendanceStatus,
        markedById: user.id,
      },
      update: { status: e.status as AttendanceStatus, markedById: user.id, markedAt: new Date() },
    });
    saved += 1;
  }

  const conflictsDetected = await detectConflicts(date);
  const complete = await sectionDayComplete(sectionId, date);
  const notificationsSent = complete ? await notifyAbsences(sectionId, date) : 0;
  invalidateDashboard();

  return NextResponse.json({
    ok: true,
    saved,
    conflictsDetected,
    notificationsSent,
    dayComplete: complete,
  });
}
