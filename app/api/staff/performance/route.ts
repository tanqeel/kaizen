import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';
import { can } from '@/lib/rbac';
import { todayPKT } from '@/lib/format';

export interface TeacherPerformanceRow {
  teacherId: string;
  name: string;
  employeeId: string;
  /** Weekly periods assigned to the teacher in the master timetable. */
  periodsTimetabled: number;
  /** PeriodAttendance rows this teacher marked (via their user account). null when they have no login. */
  registersSubmitted: number | null;
  /** Distinct PKT dates on which they submitted at least one register. null when they have no login. */
  registerDays: number | null;
  /**
   * Submission rate = registersSubmitted ÷ (registerDays × periodsTimetabled),
   * clamped at 100. This is register SUBMISSION, not on-time submission —
   * markedAt time-of-day is not compared against slot times, so no on-time
   * claim is made. null where it can't be computed.
   */
  submissionRatePct: number | null;
  /** Average obtained/total × 100 across all ExamResults in the teacher's allocated subjects. null where no results. */
  classAvgPct: number | null;
  /** DiaryEntry rows by this teacher in the last 30 PKT days. */
  diaryLast30d: number;
}

export interface StaffPerformance {
  teachers: TeacherPerformanceRow[];
}

/**
 * GET /api/staff/performance[?teacherId=] — per-teacher performance metrics
 * computed from real tables only; nulls wherever there is no data.
 *
 * Access: 'staff.manage' sees everyone (optional ?teacherId= filter);
 * a TEACHER with 'staff.attendance.view' sees only their own row
 * (?teacherId= must be omitted or match their own teacher record).
 */
export async function GET(req: Request) {
  const auth = await apiUser(['staff.manage', 'staff.attendance.view']);
  if (auth.error) return auth.error;
  const { user } = auth;

  const url = new URL(req.url);
  const teacherIdParam = url.searchParams.get('teacherId')?.trim() ?? '';

  const manager = can(user.role, 'staff.manage');
  let selfTeacherId: string | null = null;
  if (!manager) {
    if (user.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const self = await prisma.teacher.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!self) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    selfTeacherId = self.id;
    if (teacherIdParam && teacherIdParam !== selfTeacherId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const filterId = manager ? (teacherIdParam || undefined) : selfTeacherId!;

  const teachers = await prisma.teacher.findMany({
    where: { isActive: true, ...(filterId ? { id: filterId } : {}) },
    select: {
      id: true,
      employeeId: true,
      userId: true,
      user: { select: { name: true } },
      allocations: { select: { subjectId: true } },
    },
    orderBy: { user: { name: 'asc' } },
  });

  const d = new Date(`${todayPKT()}T00:00:00`);
  d.setDate(d.getDate() - 30);
  const thirtyDaysAgo = d.toISOString().slice(0, 10);

  const rows: TeacherPerformanceRow[] = await Promise.all(
    teachers.map(async (t) => {
      const subjectIds = t.allocations.map((a) => a.subjectId);
      const [timetabled, submitted, days, results, diary] = await Promise.all([
        prisma.timetableSlot.count({ where: { teacherId: t.id } }),
        t.userId ? prisma.periodAttendance.count({ where: { markedById: t.userId } }) : null,
        t.userId
          ? prisma.periodAttendance
              .findMany({ where: { markedById: t.userId }, select: { date: true }, distinct: ['date'] })
              .then((rs) => rs.length)
          : null,
        subjectIds.length === 0
          ? []
          : prisma.examResult.findMany({
              where: { examSchedule: { subjectId: { in: subjectIds } } },
              select: { obtainedMarks: true, examSchedule: { select: { totalMarks: true } } },
            }),
        prisma.diaryEntry.count({ where: { teacherId: t.id, date: { gte: thirtyDaysAgo } } }),
      ]);

      let submissionRatePct: number | null = null;
      if (submitted !== null && days !== null && days > 0 && timetabled > 0) {
        const expected = days * timetabled;
        if (expected > 0) submissionRatePct = Math.min(100, Math.round((submitted / expected) * 100));
      }

      let classAvgPct: number | null = null;
      if (results.length > 0) {
        const pcts = results
          .filter((r) => r.examSchedule.totalMarks > 0)
          .map((r) => (r.obtainedMarks / r.examSchedule.totalMarks) * 100);
        if (pcts.length > 0) classAvgPct = Math.round(pcts.reduce((s, x) => s + x, 0) / pcts.length);
      }

      return {
        teacherId: t.id,
        name: t.user?.name ?? '—',
        employeeId: t.employeeId,
        periodsTimetabled: timetabled,
        registersSubmitted: submitted,
        registerDays: days,
        submissionRatePct,
        classAvgPct,
        diaryLast30d: diary,
      };
    }),
  );

  const body: StaffPerformance = { teachers: rows };
  return NextResponse.json(body);
}
