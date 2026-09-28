import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser, schoolIdOr400 } from '@/lib/api-auth';
import { can } from '@/lib/rbac';
import { todayPKT } from '@/lib/format';

/**
 * GET /api/staff-attendance?date=YYYY-MM-DD (default: today PKT)
 *   — staff.attendance.view.
 *   Managers (staff.attendance.manage): full roster of active teachers +
 *   active staff members with their attendance row for the date (null = not marked).
 *   TEACHER: own teacher row only. STAFF: own staff member row only.
 *   Everyone else with the view permission: empty list.
 *
 * GET /api/staff-attendance?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   — own-history range (max 31 days) for the signed-in teacher/staff member.
 *   Used by non-managers for the "last 30 days" view. Managers are refused
 *   here (use ?date= per day instead) so a range can never leak the roster.
 *
 * POST /api/staff-attendance — staff.attendance.manage.
 *   body: { date, personType: 'teacher'|'staff', personId, status:
 *   'PRESENT'|'ABSENT'|'LEAVE'|'LATE', note? }. Exactly one FK is set.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ['PRESENT', 'ABSENT', 'LEAVE', 'LATE'] as const;
type Status = (typeof STATUSES)[number];
type PersonType = 'teacher' | 'staff';

interface Row {
  personType: PersonType;
  personId: string;
  name: string;
  designation: string;
  status: Status | null;
  note: string | null;
}

interface AttendanceHit {
  teacherId: string | null;
  staffMemberId: string | null;
  status: Status;
  note: string | null;
}

function shapeRow(
  personType: PersonType,
  personId: string,
  name: string,
  designation: string,
  hit: Pick<AttendanceHit, 'status' | 'note'> | null,
): Row {
  return {
    personType,
    personId,
    name,
    designation,
    status: hit ? hit.status : null,
    note: hit ? hit.note : null,
  };
}

const bad = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });

function teacherRow(
  person: { id: string; employeeId: string; user: { name: string } | null },
  hit: Pick<AttendanceHit, 'status' | 'note'> | null,
): Row {
  return shapeRow('teacher', person.id, person.user?.name ?? person.employeeId, 'Teacher', hit);
}

function staffMemberRow(
  person: { id: string; employeeId: string; designation: string; user: { name: string } | null },
  hit: Pick<AttendanceHit, 'status' | 'note'> | null,
): Row {
  return shapeRow('staff', person.id, person.user?.name ?? person.employeeId, person.designation, hit);
}

export async function GET(req: Request) {
  const auth = await apiUser('staff.attendance.view');
  if (auth.error) return auth.error;
  const { user } = auth;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  // --- own-history range mode (non-managers only) ---
  if (from !== null || to !== null) {
    if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
      return bad('from and to must be YYYY-MM-DD dates');
    }
    if (can(user.role, 'staff.attendance.manage')) {
      return bad('Managers should query one date at a time (?date=)', 403);
    }
    const spanDays = Math.round(
      (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000,
    );
    if (spanDays < 0 || spanDays > 30) {
      return bad('Date range must be at most 31 days and not inverted');
    }

    let personType: PersonType | null = null;
    if (user.role === 'TEACHER') personType = 'teacher';
    else if (user.role === 'STAFF') personType = 'staff';
    if (!personType) return NextResponse.json({ from, to, rows: [] });

    const person = personType === 'teacher'
      ? await prisma.teacher.findUnique({
          where: { userId: user.id },
          select: { id: true, employeeId: true, user: { select: { name: true } } },
        })
      : await prisma.staffMember.findUnique({
          where: { userId: user.id },
          select: { id: true, employeeId: true, designation: true, user: { select: { name: true } } },
        });
    if (!person) return NextResponse.json({ from, to, rows: [] });

    const hits = await prisma.staffAttendance.findMany({
      where: {
        date: { gte: from, lte: to },
        ...(personType === 'teacher' ? { teacherId: person.id } : { staffMemberId: person.id }),
      },
      select: { date: true, status: true, note: true },
      orderBy: { date: 'desc' },
    });
    const byDate = new Map(hits.map((h) => [h.date, h]));
    const rows = [];
    for (let i = 0; i <= spanDays; i++) {
      const d = new Date(new Date(`${to}T00:00:00Z`).getTime() - i * 86400000)
        .toISOString()
        .slice(0, 10);
      const hit = byDate.get(d) ?? null;
      const base = personType === 'teacher'
        ? teacherRow(
            person as { id: string; employeeId: string; user: { name: string } | null },
            hit,
          )
        : staffMemberRow(
            person as { id: string; employeeId: string; designation: string; user: { name: string } | null },
            hit,
          );
      rows.push({ date: d, ...base });
    }
    return NextResponse.json({ from, to, rows });
  }

  // --- single-date mode ---
  const date = searchParams.get('date') ?? todayPKT();
  if (!DATE_RE.test(date)) return bad('date must be YYYY-MM-DD');

  const s = await schoolIdOr400();
  if ('error' in s) return s.error;

  const isManager = can(user.role, 'staff.attendance.manage');

  if (!isManager && user.role !== 'TEACHER' && user.role !== 'STAFF') {
    return NextResponse.json({ date, rows: [] });
  }

  let rows: Row[];
  if (isManager) {
    const [teachers, staff] = await Promise.all([
      prisma.teacher.findMany({
        where: { isActive: true },
        select: { id: true, employeeId: true, user: { select: { name: true } } },
      }),
      prisma.staffMember.findMany({
        where: { isActive: true },
        select: { id: true, employeeId: true, designation: true, user: { select: { name: true } } },
      }),
    ]);
    const hits: AttendanceHit[] = await prisma.staffAttendance.findMany({
      where: {
        schoolId: s.schoolId,
        date,
        OR: [
          { teacherId: { in: teachers.map((t) => t.id) } },
          { staffMemberId: { in: staff.map((m) => m.id) } },
        ],
      },
      select: { teacherId: true, staffMemberId: true, status: true, note: true },
    });
    const hitByTeacher = new Map<string, Pick<AttendanceHit, 'status' | 'note'>>();
    const hitByStaff = new Map<string, Pick<AttendanceHit, 'status' | 'note'>>();
    for (const h of hits) {
      if (h.teacherId) hitByTeacher.set(h.teacherId, { status: h.status, note: h.note });
      if (h.staffMemberId) hitByStaff.set(h.staffMemberId, { status: h.status, note: h.note });
    }
    rows = [
      ...teachers.map((t) => teacherRow(t, hitByTeacher.get(t.id) ?? null)),
      ...staff.map((m) => staffMemberRow(m, hitByStaff.get(m.id) ?? null)),
    ];
    rows.sort((a, b) => a.name.localeCompare(b.name));
  } else if (user.role === 'TEACHER') {
    const person = await prisma.teacher.findUnique({
      where: { userId: user.id },
      select: { id: true, employeeId: true, user: { select: { name: true } } },
    });
    rows = person
      ? [
          teacherRow(
            person,
            await prisma.staffAttendance.findFirst({
              where: { date, teacherId: person.id },
              select: { status: true, note: true },
            }),
          ),
        ]
      : [];
  } else {
    const person = await prisma.staffMember.findUnique({
      where: { userId: user.id },
      select: { id: true, employeeId: true, designation: true, user: { select: { name: true } } },
    });
    rows = person
      ? [
          staffMemberRow(
            person,
            await prisma.staffAttendance.findFirst({
              where: { date, staffMemberId: person.id },
              select: { status: true, note: true },
            }),
          ),
        ]
      : [];
  }

  return NextResponse.json({ date, rows });
}

export async function POST(req: Request) {
  const auth = await apiUser('staff.attendance.manage');
  if (auth.error) return auth.error;
  const { user } = auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad('Invalid JSON body');
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const date = typeof b.date === 'string' ? b.date : '';
  const personType = b.personType as PersonType;
  const personId = typeof b.personId === 'string' ? b.personId.trim() : '';
  const status = b.status as Status;
  const note =
    typeof b.note === 'string' && b.note.trim() !== '' ? b.note.trim().slice(0, 500) : null;

  if (!DATE_RE.test(date)) return bad('date must be YYYY-MM-DD');
  if (personType !== 'teacher' && personType !== 'staff') {
    return bad("personType must be 'teacher' or 'staff'");
  }
  if (!personId) return bad('personId is required');
  if (!STATUSES.includes(status)) return bad('status must be PRESENT, ABSENT, LEAVE or LATE');

  const s = await schoolIdOr400();
  if ('error' in s) return s.error;

  const teacher =
    personType === 'teacher'
      ? await prisma.teacher.findUnique({
          where: { id: personId },
          select: { id: true, employeeId: true, isActive: true, user: { select: { name: true } } },
        })
      : null;
  const staff =
    personType === 'staff'
      ? await prisma.staffMember.findUnique({
          where: { id: personId },
          select: { id: true, employeeId: true, designation: true, isActive: true, user: { select: { name: true } } },
        })
      : null;
  const person = teacher ?? staff;
  if (!person || !person.isActive) {
    return NextResponse.json({ error: 'Person not found or inactive' }, { status: 404 });
  }

  // Exactly one FK, never both.
  const where =
    personType === 'teacher' ? { teacherId: person.id, date } : { staffMemberId: person.id, date };
  const existing = await prisma.staffAttendance.findFirst({
    where,
    select: { id: true },
  });

  const saved = existing
    ? await prisma.staffAttendance.update({
        where: { id: existing.id },
        data: { status, note, markedById: user.id },
      })
    : await prisma.staffAttendance.create({
        data: {
          schoolId: s.schoolId,
          date,
          status,
          note,
          markedById: user.id,
          ...(personType === 'teacher' ? { teacherId: person.id } : { staffMemberId: person.id }),
        },
      });

  let row: Row;
  if (personType === 'teacher' && teacher) {
    row = teacherRow(teacher, { status: saved.status, note: saved.note });
  } else if (staff) {
    row = staffMemberRow(staff, { status: saved.status, note: saved.note });
  } else {
    // Unreachable: person existed above.
    return NextResponse.json({ error: 'Person not found or inactive' }, { status: 404 });
  }

  return NextResponse.json({ date, row });
}
