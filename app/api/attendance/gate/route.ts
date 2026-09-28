import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';
import { pktTime, todayPKT } from '@/lib/format';
import { invalidateDashboard } from '@/lib/dashboard';
import type { CheckInMethod } from '@prisma/client';

const METHODS: CheckInMethod[] = ['FINGERPRINT', 'FACE', 'RFID', 'MANUAL'];

export interface GateRow {
  studentId: string;
  name: string;
  admissionNo: string;
  grade: string;
  section: string;
  checkInTime: string;
  checkInDisplay: string;
  method: CheckInMethod;
  checkOutTime: string | null;
  checkOutDisplay: string | null;
}

/**
 * GET /api/attendance/gate?date=YYYY-MM-DD — today's gate check-in list
 * with check-out times. Defaults to today (PKT).
 */
export async function GET(req: Request) {
  const auth = await apiUser('attendance.gate');
  if (auth.error) return auth.error;

  const date = new URL(req.url).searchParams.get('date')?.trim() || todayPKT();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date format; expected YYYY-MM-DD' }, { status: 400 });
  }

  const [checkIns, checkOuts] = await Promise.all([
    prisma.gateCheckIn.findMany({
      where: { date },
      include: {
        student: {
          select: {
            id: true, name: true, admissionNo: true,
            grade: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
      },
      orderBy: { checkInTime: 'asc' },
    }),
    prisma.gateCheckOut.findMany({ where: { date }, select: { studentId: true, checkOutTime: true } }),
  ]);
  const outByStudent = new Map(checkOuts.map((o) => [o.studentId, o.checkOutTime]));

  const rows: GateRow[] = checkIns.map((c) => {
    const out = outByStudent.get(c.studentId) ?? null;
    return {
      studentId: c.student.id,
      name: c.student.name,
      admissionNo: c.student.admissionNo,
      grade: c.student.grade.name,
      section: c.student.section.name,
      checkInTime: c.checkInTime.toISOString(),
      checkInDisplay: pktTime(c.checkInTime),
      method: c.method,
      checkOutTime: out ? out.toISOString() : null,
      checkOutDisplay: out ? pktTime(out) : null,
    };
  });

  return NextResponse.json({ date, checkIns: rows, total: rows.length });
}

/**
 * POST /api/attendance/gate { studentId, method, terminalId? }
 * Manual (or terminal-driven) gate check-in. Rejects duplicates for the day.
 * Writes an ARRIVAL NotificationLog for the linked parent(s).
 */
export async function POST(req: Request) {
  const auth = await apiUser('attendance.gate');
  if (auth.error) return auth.error;
  const { user } = auth;

  let body: { studentId?: string; method?: string; terminalId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { studentId, method, terminalId } = body;
  if (!studentId || typeof studentId !== 'string') {
    return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
  }
  if (!method || !METHODS.includes(method as CheckInMethod)) {
    return NextResponse.json({ error: `method must be one of ${METHODS.join(', ')}` }, { status: 400 });
  }

  const today = todayPKT();
  const student = await prisma.student.findFirst({
    where: { id: studentId, isActive: true },
    include: { parents: { include: { parent: { select: { userId: true, name: true, phone: true } } } } },
  });
  if (!student) return NextResponse.json({ error: 'Student not found or inactive' }, { status: 404 });

  const existing = await prisma.gateCheckIn.findUnique({
    where: { studentId_date: { studentId, date: today } },
  });
  if (existing) {
    return NextResponse.json(
      { error: `${student.name} already checked in today at ${pktTime(existing.checkInTime)}` },
      { status: 409 },
    );
  }

  if (terminalId) {
    const terminal = await prisma.biometricTerminal.findUnique({ where: { id: terminalId } });
    if (!terminal) return NextResponse.json({ error: 'Terminal not found' }, { status: 404 });
  }

  const now = new Date();
  const checkIn = await prisma.gateCheckIn.create({
    data: {
      studentId,
      date: today,
      checkInTime: now,
      method: method as CheckInMethod,
      terminalId: terminalId ?? null,
      createdById: user.id,
    },
  });

  // Arrival notification to linked parent(s) — real time, real names.
  const message = `${student.name} (${student.admissionNo}) checked in at the school gate at ${pktTime(now)} on ${today}.`;
  const targets = student.parents.length > 0 ? student.parents.map((p) => p.parent.userId) : [null];
  for (const parentUserId of targets) {
    await prisma.notificationLog.create({
      data: {
        userId: parentUserId,
        studentId,
        type: 'ARRIVAL',
        channel: 'IN_APP',
        message,
        status: 'SENT',
      },
    });
  }

  invalidateDashboard();
  return NextResponse.json(
    { ok: true, checkIn: { id: checkIn.id, date: today, checkInDisplay: pktTime(now) } },
    { status: 201 },
  );
}
