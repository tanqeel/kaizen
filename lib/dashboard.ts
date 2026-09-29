import type { Role } from '@prisma/client';
import { unstable_cache, revalidateTag } from 'next/cache';
import type { SafeUser } from './auth';
import { prisma } from './db';
import { todayPKT } from './format';
import { balanceDue, displayStatus } from './fees';
import { dayOfWeekPKT } from './attendance';

/**
 * Dashboard summary engine. Role-shaped JSON/props for both the dashboard
 * page and GET /api/dashboard/summary. All numbers come from real Prisma
 * queries; PENDING never counts as absent anywhere.
 */

export interface DashboardSummary {
  role: Role;
  date: string;
  kpis?: { students: number; teachers: number; staff: number; sections: number };
  attendanceToday?: {
    present: number;
    absent: number;
    total: number;
    pct: number;
    sections: Array<{ sectionId: string; label: string; present: number; total: number; pct: number }>;
  };
  alerts?: {
    pendingSubmissions: Array<{ sectionId: string; label: string; missingPeriods: number[] }>;
    openConflicts: number;
    overdueVouchers: number;
    overdueOutstanding: number;
  };
  trend?: Array<{ date: string; present: number; total: number; pct: number }>;
  atRisk?: Array<{ studentId: string; name: string; admissionNo: string; label: string; pct: number; records: number }>;
  teacher?: {
    name: string;
    schedule: Array<{ periodNo: number; time: string; subject: string; section: string; room: string | null }>;
    pendingSections: Array<{ sectionId: string; label: string }>;
  };
  staffGate?: { checkIns: number; present: number; absent: number; checkOuts: number };
  staffType?: string | null;
  student?: {
    name: string;
    monthPct: number | null;
    presentDays: number;
    absentDays: number;
    upcomingExams: Array<{ subject: string; date: string; time: string; totalMarks: number }>;
    feeBalance: number;
    streak: number;
  };
}

function sectionLabel(g: string, s: string): string {
  return `${g} – Section ${s}`;
}

export async function computeDashboardSummary(user: SafeUser): Promise<DashboardSummary> {
  const today = todayPKT();
  const dow = dayOfWeekPKT(today);
  const summary: DashboardSummary = { role: user.role, date: today };

  if (user.role === 'SUPER_ADMIN' || user.role === 'PRINCIPAL') {
    // ── Round 1: every independent query in parallel ──
    const [kpis, activeStudents, checkIns, sectionsWithSlots, openConflicts] = await Promise.all([
      Promise.all([
        prisma.student.count({ where: { isActive: true } }),
        prisma.teacher.count({ where: { isActive: true } }),
        prisma.staffMember.count({ where: { isActive: true } }),
        prisma.section.count(),
      ]),
      prisma.student.findMany({
        where: { isActive: true },
        select: { id: true, sectionId: true },
      }),
      prisma.gateCheckIn.findMany({
        where: { date: today },
        select: { studentId: true },
      }),
      prisma.section.findMany({
        include: {
          grade: { select: { name: true } },
          timetableSlots: { where: { dayOfWeek: dow }, select: { periodNo: true } },
        },
        orderBy: [{ grade: { level: 'asc' } }, { name: 'asc' }],
      }),
      prisma.attendanceConflict.count({ where: { status: 'OPEN' } }),
    ]);
    summary.kpis = { students: kpis[0], teachers: kpis[1], staff: kpis[2], sections: kpis[3] };

    const presentIds = new Set(checkIns.map((c) => c.studentId));
    const total = activeStudents.length;
    const present = activeStudents.filter((s) => presentIds.has(s.id)).length;
    const sectionStats = sectionsWithSlots.map((sec) => {
      const members = activeStudents.filter((s) => s.sectionId === sec.id);
      const secPresent = members.filter((s) => presentIds.has(s.id)).length;
      const pct = members.length === 0 ? 0 : Math.round((secPresent / members.length) * 100);
      return {
        sectionId: sec.id,
        label: sectionLabel(sec.grade.name, sec.name),
        present: secPresent,
        total: members.length,
        pct,
      };
    });
    summary.attendanceToday = { present, absent: total - present, total, pct: total === 0 ? 0 : Math.round((present / total) * 100), sections: sectionStats };

    // ── Round 2: batched submissions / overdue / 7-day trend / month rows ──
    const sixDaysAgo = todayPKT(new Date(Date.now() - 6 * 86400_000));
    const monthPrefix = today.slice(0, 7); // YYYY-MM
    const [submittedToday, overdue, trendGroups, monthRows] = await Promise.all([
      prisma.periodAttendance.groupBy({
        by: ['sectionId', 'periodNo'],
        where: { date: today },
      }),
      prisma.feeVoucher.findMany({
        where: { status: { not: 'PAID' }, dueDate: { lt: new Date(`${today}T00:00:00`) } },
        include: { payments: { select: { amount: true } } },
      }),
      prisma.gateCheckIn.groupBy({
        by: ['date', 'studentId'],
        where: { date: { gte: sixDaysAgo } },
      }),
      prisma.periodAttendance.findMany({
        where: { date: { startsWith: monthPrefix }, status: { in: ['PRESENT', 'ABSENT'] } },
        select: { studentId: true, status: true },
        take: 20000,
      }),
    ]);

    // Pending lecture submissions: computed in JS from the single batched groupBy.
    const doneBySection = new Map<string, Set<number>>();
    for (const r of submittedToday) {
      let set = doneBySection.get(r.sectionId);
      if (!set) {
        set = new Set<number>();
        doneBySection.set(r.sectionId, set);
      }
      set.add(r.periodNo);
    }
    const pendingSubmissions: NonNullable<DashboardSummary['alerts']>['pendingSubmissions'] = [];
    for (const sec of sectionsWithSlots) {
      const slotPeriods = [...new Set(sec.timetableSlots.map((s) => s.periodNo))];
      if (slotPeriods.length === 0) continue;
      const done = doneBySection.get(sec.id) ?? new Set<number>();
      if (slotPeriods.every((per) => done.has(per))) continue; // day complete
      pendingSubmissions.push({
        sectionId: sec.id,
        label: sectionLabel(sec.grade.name, sec.name),
        missingPeriods: slotPeriods.filter((per) => !done.has(per)).sort((a, b) => a - b),
      });
    }

    const overdueOutstanding = overdue.reduce((sum, v) => sum + Math.max(0, balanceDue(v, v.payments)), 0);
    summary.alerts = {
      pendingSubmissions,
      openConflicts,
      overdueVouchers: overdue.length,
      overdueOutstanding,
    };

    // 7-day trend (last 7 PKT calendar days, incl. today) from the single batched groupBy.
    const trendCounts = new Map<string, number>();
    for (const g of trendGroups) trendCounts.set(g.date, (trendCounts.get(g.date) ?? 0) + 1);
    const trend: NonNullable<DashboardSummary['trend']> = [];
    for (let i = 6; i >= 0; i--) {
      const ds = todayPKT(new Date(Date.now() - i * 86400_000));
      const dayPresent = trendCounts.get(ds) ?? 0;
      trend.push({ date: ds, present: dayPresent, total, pct: total === 0 ? 0 : Math.round((dayPresent / total) * 100) });
    }
    summary.trend = trend;

    // At-risk students: <75% period attendance this month, ≥5 records.
    const perStudent = new Map<string, { present: number; total: number }>();
    for (const r of monthRows) {
      const agg = perStudent.get(r.studentId) ?? { present: 0, total: 0 };
      agg.total += 1;
      if (r.status === 'PRESENT') agg.present += 1;
      perStudent.set(r.studentId, agg);
    }
    const riskIds = [...perStudent.entries()]
      .filter(([, a]) => a.total >= 5 && a.present / a.total < 0.75)
      .sort((a, b) => a[1].present / a[1].total - b[1].present / b[1].total)
      .slice(0, 10)
      .map(([id]) => id);
    if (riskIds.length > 0) {
      // ── Round 3: only runs when at-risk students exist ──
      const riskStudents = await prisma.student.findMany({
        where: { id: { in: riskIds }, isActive: true },
        include: { grade: { select: { name: true } }, section: { select: { name: true } } },
      });
      summary.atRisk = riskStudents.map((st) => {
        const agg = perStudent.get(st.id)!;
        return {
          studentId: st.id,
          name: st.name,
          admissionNo: st.admissionNo,
          label: sectionLabel(st.grade.name, st.section.name),
          pct: Math.round((agg.present / agg.total) * 100),
          records: agg.total,
        };
      });
    } else {
      summary.atRisk = [];
    }
  }

  if (user.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: user.id },
      select: { id: true, user: { select: { name: true } } },
    });
    if (teacher) {
      const slots = await prisma.timetableSlot.findMany({
        where: { teacherId: teacher.id, dayOfWeek: dow },
        include: {
          subject: { select: { name: true } },
          section: { include: { grade: { select: { name: true } } } },
        },
        orderBy: { periodNo: 'asc' },
      });
      const schedule = slots.map((s) => ({
        periodNo: s.periodNo,
        time: `${s.startTime}–${s.endTime}`,
        subject: s.subject.name,
        section: sectionLabel(s.section.grade.name, s.section.name),
        room: s.room,
      }));
      const mySectionIds = [...new Set(slots.map((s) => s.sectionId))];
      // Batched completeness check: all slots + all submissions for my sections today.
      const [allSlotsToday, submittedMine] = await Promise.all([
        mySectionIds.length === 0
          ? Promise.resolve([])
          : prisma.timetableSlot.findMany({
              where: { sectionId: { in: mySectionIds }, dayOfWeek: dow },
              select: { sectionId: true, periodNo: true },
            }),
        mySectionIds.length === 0
          ? Promise.resolve([])
          : prisma.periodAttendance.groupBy({
              by: ['sectionId', 'periodNo'],
              where: { sectionId: { in: mySectionIds }, date: today },
            }),
      ]);
      const slotPeriodsBySection = new Map<string, Set<number>>();
      for (const s of allSlotsToday) {
        let set = slotPeriodsBySection.get(s.sectionId);
        if (!set) {
          set = new Set<number>();
          slotPeriodsBySection.set(s.sectionId, set);
        }
        set.add(s.periodNo);
      }
      const doneBySection = new Map<string, Set<number>>();
      for (const r of submittedMine) {
        let set = doneBySection.get(r.sectionId);
        if (!set) {
          set = new Set<number>();
          doneBySection.set(r.sectionId, set);
        }
        set.add(r.periodNo);
      }
      const pendingSections: NonNullable<DashboardSummary['teacher']>['pendingSections'] = [];
      for (const sid of mySectionIds) {
        const periods = [...(slotPeriodsBySection.get(sid) ?? [])];
        if (periods.length === 0) continue;
        const done = doneBySection.get(sid) ?? new Set<number>();
        if (periods.every((per) => done.has(per))) continue;
        const sec = slots.find((s) => s.sectionId === sid)!.section;
        pendingSections.push({ sectionId: sid, label: sectionLabel(sec.grade.name, sec.name) });
      }
      summary.teacher = {
        name: teacher.user?.name ?? user.name,
        schedule,
        pendingSections,
      };
    } else {
      summary.teacher = { name: user.name, schedule: [], pendingSections: [] };
    }
  }

  if (user.role === 'STAFF') {
    const [total, checkIns, checkOuts, staffMember] = await Promise.all([
      prisma.student.count({ where: { isActive: true } }),
      prisma.gateCheckIn.count({ where: { date: today } }),
      prisma.gateCheckOut.count({ where: { date: today } }),
      prisma.staffMember.findUnique({ where: { userId: user.id }, select: { staffType: true } }),
    ]);
    summary.staffGate = {
      checkIns,
      present: checkIns,
      absent: Math.max(0, total - checkIns),
      checkOuts,
    };
    summary.staffType = staffMember?.staffType ?? null;
  }

  if (user.role === 'STUDENT') {
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      include: { grade: { select: { name: true } }, section: { select: { name: true } } },
    });
    if (student) {
      const monthPrefix = today.slice(0, 7);
      const [rows, exams, vouchers, gateDates] = await Promise.all([
        prisma.periodAttendance.findMany({
          where: { studentId: student.id, date: { startsWith: monthPrefix }, status: { in: ['PRESENT', 'ABSENT'] } },
          select: { status: true },
        }),
        prisma.examSchedule.findMany({
          where: { gradeId: student.gradeId, date: { gte: new Date(`${today}T00:00:00`) } },
          include: { subject: { select: { name: true } } },
          orderBy: { date: 'asc' },
          take: 6,
        }),
        prisma.feeVoucher.findMany({
          where: { studentId: student.id, status: { not: 'PAID' } },
          include: { payments: { select: { amount: true } } },
        }),
        prisma.gateCheckIn.findMany({
          where: { studentId: student.id },
          select: { date: true },
          orderBy: { date: 'desc' },
          take: 120,
        }),
      ]);
      const presentDays = rows.filter((r) => r.status === 'PRESENT').length;
      const absentDays = rows.filter((r) => r.status === 'ABSENT').length;
      const monthPct = rows.length === 0 ? null : Math.round((presentDays / rows.length) * 100);

      const feeBalance = vouchers.reduce((sum, v) => sum + Math.max(0, balanceDue(v, v.payments)), 0);

      // Attendance streak: consecutive calendar days with a gate check-in, ending today or yesterday.
      const dateSet = new Set(gateDates.map((g) => g.date));
      let streak = 0;
      const cursor = new Date(`${today}T00:00:00`);
      if (!dateSet.has(today)) cursor.setDate(cursor.getDate() - 1);
      while (true) {
        const ds = cursor.toISOString().slice(0, 10);
        if (!dateSet.has(ds)) break;
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }

      summary.student = {
        name: student.name,
        monthPct,
        presentDays,
        absentDays,
        upcomingExams: exams.map((e) => ({
          subject: e.subject.name,
          date: todayPKT(e.date),
          time: e.startTime,
          totalMarks: e.totalMarks,
        })),
        feeBalance,
        streak,
      };
    }
  }

  return summary;
}

/**
 * Cached dashboard summary: 60s TTL per user. Dashboard numbers change a
 * few times a day (attendance submissions, fee payments); a minute of
 * staleness is invisible on a dashboard, but the cache turns every repeat
 * load from ~4s of cross-region DB round trips into a cache hit (~0.5s).
 * Write paths (attendance submit, gate check-in, fee payment) call
 * invalidateDashboard() for immediate freshness.
 */
export async function getDashboardSummary(user: SafeUser): Promise<DashboardSummary> {
  return unstable_cache(
    async () => computeDashboardSummary(user),
    ['dashboard-summary', user.id],
    { revalidate: 60, tags: ['dashboard-summary'] },
  )();
}

/** Drop all cached dashboard summaries (call after attendance/fee/marks writes). */
export function invalidateDashboard(): void {
  // expire: 0 → next dashboard load blocks until fresh data is computed,
  // so a teacher who just submitted attendance never sees stale numbers.
  revalidateTag('dashboard-summary', { expire: 0 });
}

/** Compact display status for vouchers (re-exported convenience). */
export { displayStatus };
