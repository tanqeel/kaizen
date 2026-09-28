import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';
import { pktTime, todayPKT } from '@/lib/format';

export interface ConflictRow {
  id: string;
  date: string;
  status: string;
  student: { id: string; name: string; admissionNo: string; grade: string; section: string };
  gateInDisplay: string | null;
  absentPeriods: Array<{ periodNo: number; subject: string }>;
  note: string | null;
  detail: string;
}

/**
 * GET /api/attendance/conflicts?status=OPEN — conflict list with a human
 * detail line: "Gate IN 7:42 AM · Absent Period 2 (Urdu)".
 */
export async function GET(req: Request) {
  const auth = await apiUser('attendance.conflicts');
  if (auth.error) return auth.error;

  const status = (new URL(req.url).searchParams.get('status') ?? 'OPEN').toUpperCase();
  if (!['OPEN', 'RESOLVED', 'DISMISSED'].includes(status)) {
    return NextResponse.json({ error: 'status must be OPEN, RESOLVED or DISMISSED' }, { status: 400 });
  }

  const conflicts = await prisma.attendanceConflict.findMany({
    where: { status: status as 'OPEN' | 'RESOLVED' | 'DISMISSED' },
    include: {
      student: {
        select: {
          id: true, name: true, admissionNo: true,
          grade: { select: { name: true } },
          section: { select: { name: true } },
        },
      },
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });

  const rows: ConflictRow[] = [];
  for (const c of conflicts) {
    const [gateIn, absent] = await Promise.all([
      prisma.gateCheckIn.findUnique({
        where: { studentId_date: { studentId: c.studentId, date: c.date } },
        select: { checkInTime: true },
      }),
      prisma.periodAttendance.findMany({
        where: { studentId: c.studentId, date: c.date, status: 'ABSENT' },
        include: { subject: { select: { name: true } } },
        orderBy: { periodNo: 'asc' },
      }),
    ]);
    const gateInDisplay = gateIn ? pktTime(gateIn.checkInTime) : null;
    const absentPeriods = absent.map((a) => ({ periodNo: a.periodNo, subject: a.subject.name }));
    const detail =
      `Gate IN ${gateInDisplay ?? '—'}` +
      (absentPeriods.length > 0
        ? ` · Absent Period ${absentPeriods.map((p) => `${p.periodNo} (${p.subject})`).join(', ')}`
        : ' · No absent periods recorded');
    rows.push({
      id: c.id,
      date: c.date,
      status: c.status,
      student: {
        id: c.student.id,
        name: c.student.name,
        admissionNo: c.student.admissionNo,
        grade: c.student.grade.name,
        section: c.student.section.name,
      },
      gateInDisplay,
      absentPeriods,
      note: c.note,
      detail,
    });
  }

  return NextResponse.json({ conflicts: rows, total: rows.length, today: todayPKT() });
}
