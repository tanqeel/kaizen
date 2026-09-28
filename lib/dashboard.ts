import type { Role, User } from '@prisma/client';
import { prisma } from './db';
import { todayPKT } from './format';
import { balanceDue, displayStatus } from './fees';
import { dayOfWeekPKT, sectionDayComplete } from './attendance';

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

export async function getDashboardSummary(user: User): Promise<DashboardSummary> {
  const today = todayPKT();
  const dow = dayOfWeekPKT(today);
  const summary: DashboardSummary = { role: user.role, date: today };

  if (user.role === 'SUPER_ADMIN' || user.role === 'PRINCIPAL') {
    const [students, teachers, staff, sections] = await Promise.all([
      prisma.student.count({ where: { isActive: true } }),
      prisma.teacher.count({ where: { isActive: true } }),
      prisma.staffMember.count({ where: { isActive: true } }),
      prisma.section.count(),
    ]);
    summary.kpis = { students, teachers, staff, sections };

    const activeStudents = await prisma.student.findMany({
      where: { isActive: true },
      select: { id: true, sectionId: true },
    });
    const checkIns = await prisma.gateCheckIn.findMany({
      where: { date: today },
      select: { studentId: true },
    });
    const presentIds = new Set(checkIns.map((c) => c.studentId));
    const present = activeStudents.filter((s) => presentIds.has(s.id)).length;
    const total = activeStudents.length;
    const absent = total - present;

    const sectionsWithSlots = await prisma.section.findMany({
      include: {
        grade: { select: { name: true } },
        timetableSlots: { where: { dayOfWeek: dow }, select: { periodNo: true } },
      },
      orderBy: [{ grade: { level: 'asc' } }, { name: 'asc' }],
    });
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
    summary.attendanceToday = { present, absent, total, pct: total === 0 ? 0 : Math.round((present / total) * 100), sections: sectionStats };

    // Pending lecture submissions: sections with slots today whose day is incomplete.
    const pendingSubmissions: NonNullable<DashboardSummary['alerts']>['pendingSubmissions'] = [];
    for (const sec of sectionsWithSlots) {
      const slotPeriods = [...new Set(sec.timetableSlots.map((s) => s.periodNo))];
      if (slotPeriods.length === 0) continue;
      if (!(await sectionDayComplete(sec.id, today))) {
        const submitted = await prisma.periodAttendance.groupBy({
          by: ['periodNo'],
          where: { sectionId: sec.id, date: today, periodNo: { in: slotPeriods } },
        });
        const done = new Set(submitted.map((s) => s.periodNo));
        pendingSubmissions.push({
          sectionId: sec.id,
          label: sectionLabel(sec.grade.name, sec.name),
          missingPeriods: slotPeriods.filter((p) => !done.has(p)).sort((a, b) => a - b),
        });
      }
    }

    const openConflicts = await prisma.attendanceConflict.count({ where: { status: 'OPEN' } });

    const overdue = await prisma.feeVoucher.findMany({
      where: { status: { not: 'PAID' }, dueDate: { lt: new Date(`${today}T00:00:00`) } },
      include: { payments: { select: { amount: true } } },
    });
    const overdueOutstanding = overdue.reduce((s, v) => s + Math.max(0, balanceDue(v, v.payments)), 0);
    summary.alerts = {
      pendingSubmissions,
      openConflicts,
      overdueVouchers: overdue.length,
      overdueOutstanding,
    };

    // 7-day trend (last 7 PKT calendar days, incl. today) from gate check-ins.
    const trend: NonNullable<DashboardSummary['trend']> = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400_000);
      const ds = todayPKT(d);
      const dayIns = await prisma.gateCheckIn.groupBy({
        by: ['studentId'],
        where: { date: ds },
      });
      const pct = total === 0 ? 0 : Math.round((dayIns.length / total) * 100);
      trend.push({ date: ds, present: dayIns.length, total, pct });
    }
    summary.trend = trend;

    // At-risk students: <75% period attendance this month, ≥5 records.
    const monthPrefix = today.slice(0, 7); // YYYY-MM
    const monthRows = await prisma.periodAttendance.findMany({
      where: { date: { startsWith: monthPrefix }, status: { in: ['PRESENT', 'ABSENT'] } },
      select: { studentId: true, status: true },
      take: 20000,
    });
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
      const riskStudents = await prisma.student.findMany({
        where: { id: { in: riskIds }, isActive: true },
        include: { grade: { select: { name: true } }, section: { select: { name: true } } },
      });
      summary.atRisk = riskStudents.map((s) => {
        const agg = perStudent.get(s.id)!;
        return {
          studentId: s.id,
          name: s.name,
          admissionNo: s.admissionNo,
          label: sectionLabel(s.grade.name, s.section.name),
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
      const pendingSections: NonNullable<DashboardSummary['teacher']>['pendingSections'] = [];
      for (const sid of mySectionIds) {
        const sec = slots.find((s) => s.sectionId === sid)!.section;
        if (!(await sectionDayComplete(sid, today))) {
          pendingSections.push({ sectionId: sid, label: sectionLabel(sec.grade.name, sec.name) });
        }
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
    const total = await prisma.student.count({ where: { isActive: true } });
    const checkIns = await prisma.gateCheckIn.count({ where: { date: today } });
    const checkOuts = await prisma.gateCheckOut.count({ where: { date: today } });
    summary.staffGate = {
      checkIns,
      present: checkIns,
      absent: Math.max(0, total - checkIns),
      checkOuts,
    };
  }

  if (user.role === 'STUDENT') {
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      include: { grade: { select: { name: true } }, section: { select: { name: true } } },
    });
    if (student) {
      const monthPrefix = today.slice(0, 7);
      const rows = await prisma.periodAttendance.findMany({
        where: { studentId: student.id, date: { startsWith: monthPrefix }, status: { in: ['PRESENT', 'ABSENT'] } },
        select: { status: true },
      });
      const presentDays = rows.filter((r) => r.status === 'PRESENT').length;
      const absentDays = rows.filter((r) => r.status === 'ABSENT').length;
      const monthPct = rows.length === 0 ? null : Math.round((presentDays / rows.length) * 100);

      const exams = await prisma.examSchedule.findMany({
        where: { gradeId: student.gradeId, date: { gte: new Date(`${today}T00:00:00`) } },
        include: { subject: { select: { name: true } } },
        orderBy: { date: 'asc' },
        take: 6,
      });

      const vouchers = await prisma.feeVoucher.findMany({
        where: { studentId: student.id, status: { not: 'PAID' } },
        include: { payments: { select: { amount: true } } },
      });
      const feeBalance = vouchers.reduce((s, v) => s + Math.max(0, balanceDue(v, v.payments)), 0);

      // Attendance streak: consecutive calendar days with a gate check-in, ending today or yesterday.
      const gateDates = await prisma.gateCheckIn.findMany({
        where: { studentId: student.id },
        select: { date: true },
        orderBy: { date: 'desc' },
        take: 120,
      });
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

/** Compact display status for vouchers (re-exported convenience). */
export { displayStatus };
