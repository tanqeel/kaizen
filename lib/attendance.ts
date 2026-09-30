import { prisma } from './db';
import { createManyCompat } from './prisma-batch';

/**
 * Attendance-domain helpers shared by pages and API routes.
 * Safety rules enforced here:
 *  - PENDING never counts as absent in any count, percentage, or notification.
 *  - Absence notifications only fire via notifyAbsences(), and only when the
 *    whole section day is submitted (sectionDayComplete()).
 *  - No records are ever invented; functions return counts/booleans from real rows.
 */

const PKT = 'Asia/Karachi';

/**
 * Day of week (0=Sun..6=Sat) in Asia/Karachi.
 * Accepts a YYYY-MM-DD string (interpreted as the PKT calendar day) or a Date.
 */
export function dayOfWeekPKT(input?: string | Date): number {
  if (typeof input === 'string') {
    const [y, m, d] = input.split('-').map(Number);
    if (!y || !m || !d) return new Date().getDay();
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  }
  const d = input ?? new Date();
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: PKT, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
  const [y, m, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).getUTCDay();
}

/**
 * Conflict detection: for every gate check-in on `dateStr`, look for that
 * student's PeriodAttendance rows the same date with status ABSENT. Creates an
 * OPEN AttendanceConflict (GATE_PRESENT_LECTURE_ABSENT) per student, deduped
 * strictly on the (date, studentId, type) unique key. Returns rows created.
 */
export async function detectConflicts(dateStr: string): Promise<number> {
  const checkIns = await prisma.gateCheckIn.findMany({
    where: { date: dateStr },
    select: { studentId: true },
  });
  if (checkIns.length === 0) return 0;
  const studentIds = [...new Set(checkIns.map((c) => c.studentId))];

  const absentGroups = await prisma.periodAttendance.groupBy({
    by: ['studentId'],
    where: { date: dateStr, studentId: { in: studentIds }, status: 'ABSENT' },
  });
  if (absentGroups.length === 0) return 0;
  const absentIds = absentGroups.map((g) => g.studentId);

  // Strict dedupe: never create when ANY row already exists for the unique key
  // (the @@unique([date, studentId, type]) would reject it anyway).
  const existing = await prisma.attendanceConflict.findMany({
    where: {
      date: dateStr,
      studentId: { in: absentIds },
      type: 'GATE_PRESENT_LECTURE_ABSENT',
    },
    select: { studentId: true },
  });
  const have = new Set(existing.map((e) => e.studentId));
  const fresh = absentIds.filter((id) => !have.has(id));
  if (fresh.length === 0) return 0;

  // NOTE: prisma.createMany throws "Transactions are not supported in HTTP
  // mode" on the Neon HTTP driver — insert individually in chunks instead.
  const count = await createManyCompat(
    (data) => prisma.attendanceConflict.create({ data }),
    fresh.map((studentId) => ({
      date: dateStr,
      studentId,
      type: 'GATE_PRESENT_LECTURE_ABSENT' as const,
      status: 'OPEN' as const,
    })),
  );
  return count;
}

/**
 * True when every TimetableSlot for the section on that weekday has at least
 * one PeriodAttendance row for (sectionId, dateStr, periodNo).
 */
export async function sectionDayComplete(sectionId: string, dateStr: string): Promise<boolean> {
  const slots = await prisma.timetableSlot.findMany({
    where: { sectionId, dayOfWeek: dayOfWeekPKT(dateStr) },
    select: { periodNo: true },
  });
  const periodNos = [...new Set(slots.map((s) => s.periodNo))];
  if (periodNos.length === 0) return false; // no school for this section today — not "complete"

  const submitted = await prisma.periodAttendance.groupBy({
    by: ['periodNo'],
    where: { sectionId, date: dateStr, periodNo: { in: periodNos } },
  });
  const done = new Set(submitted.map((s) => s.periodNo));
  return periodNos.every((p) => done.has(p));
}

interface AbsenceCandidate {
  id: string;
  name: string;
  parentUserIds: Array<string | null>;
}

/**
 * Full-day absence notifications. Only when the section day is complete:
 * for each active student in the section with NO gate check-in that date AND
 * ABSENT in every period row submitted for them that date (PENDING never
 * counts), create a SENT IN_APP LECTURE_ABSENCE NotificationLog addressed to
 * the linked parent user(s). Returns rows created. Idempotent per (student, date).
 */
export async function notifyAbsences(sectionId: string, dateStr: string): Promise<number> {
  if (!(await sectionDayComplete(sectionId, dateStr))) return 0;

  const students: AbsenceCandidate[] = await prisma.student.findMany({
    where: { sectionId, isActive: true },
    select: {
      id: true,
      name: true,
      parents: { select: { parent: { select: { userId: true } } } },
    },
  }).then((rows) =>
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      parentUserIds: r.parents.map((p) => p.parent.userId),
    })),
  );
  if (students.length === 0) return 0;

  const checkIns = await prisma.gateCheckIn.findMany({
    where: { date: dateStr, studentId: { in: students.map((s) => s.id) } },
    select: { studentId: true },
  });
  const checkedIn = new Set(checkIns.map((c) => c.studentId));
  const candidates = students.filter((s) => !checkedIn.has(s.id));
  if (candidates.length === 0) return 0;

  const rows = await prisma.periodAttendance.findMany({
    where: { sectionId, date: dateStr, studentId: { in: candidates.map((c) => c.id) } },
    select: { studentId: true, status: true },
  });
  const byStudent = new Map<string, string[]>();
  for (const r of rows) {
    const arr = byStudent.get(r.studentId) ?? [];
    arr.push(r.status);
    byStudent.set(r.studentId, arr);
  }
  // Full-day absent: has at least one submitted row and every row is ABSENT.
  const absentees = candidates.filter((c) => {
    const sts = byStudent.get(c.id);
    return !!sts && sts.length > 0 && sts.every((s) => s === 'ABSENT');
  });
  if (absentees.length === 0) return 0;

  // Idempotency: skip students already notified for this date.
  const already = await prisma.notificationLog.findMany({
    where: {
      type: 'LECTURE_ABSENCE',
      studentId: { in: absentees.map((a) => a.id) },
      message: { contains: dateStr },
    },
    select: { studentId: true },
  });
  const notified = new Set(already.map((n) => n.studentId));
  const fresh = absentees.filter((a) => !notified.has(a.id));
  if (fresh.length === 0) return 0;

  const periodCounts = new Map<string, number>();
  for (const r of rows) {
    periodCounts.set(r.studentId, (periodCounts.get(r.studentId) ?? 0) + 1);
  }

  let created = 0;
  for (const a of fresh) {
    const periods = periodCounts.get(a.id) ?? 0;
    const message =
      `${a.name} was marked absent in all ${periods} submitted period${periods === 1 ? '' : 's'} ` +
      `on ${dateStr} and did not check in at the gate. Please contact the school office.`;
    const targets = a.parentUserIds.length > 0 ? a.parentUserIds : [null];
    for (const userId of targets) {
      await prisma.notificationLog.create({
        data: {
          userId,
          studentId: a.id,
          type: 'LECTURE_ABSENCE',
          channel: 'IN_APP',
          message,
          status: 'SENT',
        },
      });
      created += 1;
    }
  }
  return created;
}
