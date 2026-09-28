import { prisma } from './db';
import { todayPKT } from './format';
import { gradeBand, pctOf } from './exams';
import type { Role } from '@prisma/client';

/** Weekday number 0=Sun … 6=Sat in Asia/Karachi (matches TimetableSlot.dayOfWeek). */
export function weekdayPKT(d = new Date()): number {
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const name = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'short' }).format(d);
  return map[name] ?? 1;
}

export type PortalViewer = { id: string; role: Role };

export class PortalError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface ChildLite {
  id: string;
  name: string;
  admissionNo: string;
  grade: string;
  section: string;
}

export type JourneyStatus = 'PRESENT' | 'ABSENT' | 'PENDING' | 'NOT_MARKED';

export interface PortalSummary {
  student: ChildLite & { room: string | null };
  children: ChildLite[];
  date: string;
  /** The date the journey actually shows (today when it has data, else the latest school day with records). */
  displayDate: string;
  displayDateIsToday: boolean;
  campus: {
    atSchool: boolean;
    arrivalTime: string | null;
    arrivalMethod: string | null;
    checkedOut: boolean;
    checkoutTime: string | null;
  };
  journey: Array<{
    periodNo: number;
    subject: string;
    subjectCode: string;
    teacher: string;
    room: string | null;
    startTime: string;
    endTime: string;
    status: JourneyStatus;
  }>;
  diary: Array<{
    date: string;
    subject: string | null;
    teacher: string;
    taughtToday: string | null;
    classwork: string | null;
    homework: string | null;
    note: string | null;
  }>;
  notices: Array<{
    title: string;
    body: string;
    priority: string;
    createdAt: string;
  }>;
  dateSheet: Array<{
    date: string;
    subject: string;
    startTime: string;
    totalMarks: number;
    termName: string;
  }>;
  fees: {
    vouchers: Array<{
      id: string;
      monthLabel: string;
      totalAmount: number;
      paidAmount: number;
      balance: number;
      status: string;
      overdue: boolean;
    }>;
    totalOutstanding: number;
  };
  exams: {
    termId: string;
    termName: string;
    rows: Array<{
      subject: string;
      obtained: number;
      total: number;
      pct: number;
      grade: string;
      remarks: string | null;
    }>;
  } | null;
  notificationsNote: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Resolve which child the viewer is looking at. Throws PortalError on any
 * scoping violation: parents see only their own children (unknown/forbidden
 * ids → 403), admins/principals need an explicit ?studentId=, everyone else 403.
 */
export async function resolvePortalChild(
  viewer: PortalViewer,
  studentId?: string,
): Promise<{ children: ChildLite[]; selected: ChildLite & { room: string | null } }> {
  if (viewer.role === 'PARENT') {
    const parent = await prisma.parent.findFirst({
      where: { userId: viewer.id },
      include: {
        children: {
          include: { student: { include: { grade: true, section: true } } },
        },
      },
    });
    const kids = parent?.children.map((c) => c.student) ?? [];
    if (kids.length === 0) throw new PortalError(404, 'No children are linked to this parent account.');
    if (studentId && !kids.some((k) => k.id === studentId)) {
      throw new PortalError(403, 'You can only view your own children.');
    }
    const selected = kids.find((k) => k.id === studentId) ?? kids[0];
    const lite = (k: (typeof kids)[number]): ChildLite => ({
      id: k.id,
      name: k.name,
      admissionNo: k.admissionNo,
      grade: k.grade.name,
      section: k.section.name,
    });
    return {
      children: kids.map(lite),
      selected: { ...lite(selected), room: selected.section.room },
    };
  }
  if (viewer.role === 'SUPER_ADMIN' || viewer.role === 'PRINCIPAL') {
    if (!studentId) throw new PortalError(400, 'Pass ?studentId= to view a child as support staff.');
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { grade: true, section: true },
    });
    if (!student) throw new PortalError(404, 'Student not found.');
    const lite: ChildLite & { room: string | null } = {
      id: student.id,
      name: student.name,
      admissionNo: student.admissionNo,
      grade: student.grade.name,
      section: student.section.name,
      room: student.section.room,
    };
    return { children: [lite], selected: lite };
  }
  throw new PortalError(403, 'Forbidden: parent portal is not available to your role.');
}

/** Full portal summary for one child. Never invents records — empty states are honest. */
export async function getPortalSummary(viewer: PortalViewer, studentId?: string): Promise<PortalSummary> {
  const { children, selected } = await resolvePortalChild(viewer, studentId);
  const today = todayPKT();

  const [checkIn, checkOut, student] = await Promise.all([
    prisma.gateCheckIn.findUnique({ where: { studentId_date: { studentId: selected.id, date: today } } }),
    prisma.gateCheckOut.findUnique({ where: { studentId_date: { studentId: selected.id, date: today } } }),
    prisma.student.findUnique({
      where: { id: selected.id },
      include: {
        vouchers: { include: { payments: true }, orderBy: [{ year: 'desc' }, { month: 'desc' }] },
        examResults: {
          include: { examSchedule: { include: { subject: true, examTerm: true } } },
          orderBy: { examSchedule: { date: 'desc' } },
        },
      },
    }),
  ]);
  if (!student) throw new PortalError(404, 'Student not found.');

  // ── which day to show: today when it has timetable/marks, else the latest
  // school day with period-attendance records for this section. This keeps the
  // portal useful every day instead of going blank when "today" has no rows
  // yet (the stale-demo-data problem), and it is labelled honestly in the UI.
  const [todayMarks, latestMark] = await Promise.all([
    prisma.periodAttendance.count({ where: { studentId: selected.id, date: today } }),
    prisma.periodAttendance.findFirst({
      where: { sectionId: student.sectionId },
      orderBy: { date: 'desc' },
      select: { date: true },
    }),
  ]);
  const todaySlots = await prisma.timetableSlot.count({
    where: { sectionId: student.sectionId, dayOfWeek: weekdayPKT() },
  });
  const displayDate = todayMarks > 0 || todaySlots > 0 ? today : (latestMark?.date ?? today);
  const displayDateIsToday = displayDate === today;
  const displayWeekday = weekdayPKT(new Date(`${displayDate}T12:00:00+05:00`));

  // ── subject journey: timetable + period attendance for the display day ──
  const [slots, marks] = await Promise.all([
    prisma.timetableSlot.findMany({
      where: { sectionId: student.sectionId, dayOfWeek: displayWeekday },
      include: { subject: true, teacher: { include: { user: true } } },
      orderBy: { periodNo: 'asc' },
    }),
    prisma.periodAttendance.findMany({
      where: { studentId: selected.id, date: displayDate },
      select: { periodNo: true, subjectId: true, status: true },
    }),
  ]);
  const journey = slots.map((s) => {
    // Exact (period, subject) match first; fall back to any row for the period.
    const m =
      marks.find((x) => x.periodNo === s.periodNo && x.subjectId === s.subjectId) ??
      marks.find((x) => x.periodNo === s.periodNo);
    const status: JourneyStatus =
      m?.status === 'PRESENT' ? 'PRESENT' : m?.status === 'ABSENT' ? 'ABSENT' : m?.status === 'PENDING' ? 'PENDING' : 'NOT_MARKED';
    return {
      periodNo: s.periodNo,
      subject: s.subject.name,
      subjectCode: s.subject.code,
      teacher: s.teacher.user?.name ?? 'Teacher',
      room: s.room,
      startTime: s.startTime,
      endTime: s.endTime,
      status,
    };
  });

  // ── fee snapshot (OVERDUE computed, never stored) ──
  const todayStart = new Date(`${today}T00:00:00+05:00`);
  const vouchers = student.vouchers.map((v) => {
    const paidAmount = v.payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = v.totalAmount - v.discountAmount + v.fineAmount - paidAmount;
    const overdue = v.dueDate < todayStart && v.status !== 'PAID';
    return {
      id: v.id,
      monthLabel: `${MONTHS[v.month - 1] ?? ''} ${v.year}`,
      totalAmount: v.totalAmount,
      paidAmount,
      balance: Math.max(0, balance),
      status: overdue ? 'OVERDUE' : v.status,
      overdue,
    };
  });
  const totalOutstanding = vouchers.filter((v) => v.status !== 'PAID').reduce((s, v) => s + v.balance, 0);

  // ── exam results summary: latest term with real results ──
  let exams: PortalSummary['exams'] = null;
  if (student.examResults.length > 0) {
    const latestTermId = student.examResults
      .slice()
      .sort((a, b) => +b.examSchedule.examTerm.startDate - +a.examSchedule.examTerm.startDate)[0]
      .examSchedule.examTermId;
    const rows = student.examResults
      .filter((r) => r.examSchedule.examTermId === latestTermId)
      .sort((a, b) => +a.examSchedule.date - +b.examSchedule.date)
      .map((r) => {
        const pct = pctOf(r.obtainedMarks, r.examSchedule.totalMarks);
        return {
          subject: r.examSchedule.subject.name,
          obtained: r.obtainedMarks,
          total: r.examSchedule.totalMarks,
          pct,
          grade: gradeBand(pct),
          remarks: r.remarks,
        };
      });
    exams = {
      termId: latestTermId,
      termName: student.examResults.find((r) => r.examSchedule.examTermId === latestTermId)!.examSchedule.examTerm.name,
      rows,
    };
  }

  // ── diary (last 7 days for this section), notices for parents, upcoming
  // date sheet for this grade — batched so the portal stays fast ──
  const weekAgo = (() => {
    const d = new Date(`${today}T12:00:00+05:00`);
    d.setDate(d.getDate() - 7);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  })();
  const [diaryRows, noticeRows, scheduleRows] = await Promise.all([
    prisma.diaryEntry.findMany({
      where: { sectionId: student.sectionId, date: { gte: weekAgo } },
      include: {
        subject: { select: { name: true } },
        teacher: { include: { user: { select: { name: true } } } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    }),
    prisma.announcement.findMany({
      where: {
        OR: [
          { audience: 'ALL' },
          { audience: 'PARENTS' },
          { audience: 'GRADES', gradeId: student.gradeId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.examSchedule.findMany({
      where: { gradeId: student.gradeId, date: { gte: new Date(`${today}T00:00:00+05:00`) } },
      include: { subject: { select: { name: true } }, examTerm: { select: { name: true } } },
      orderBy: { date: 'asc' },
      take: 8,
    }),
  ]);

  return {
    student: selected,
    children,
    date: today,
    displayDate,
    displayDateIsToday,
    campus: {
      atSchool: !!checkIn && !checkOut,
      arrivalTime: checkIn ? checkIn.checkInTime.toISOString() : null,
      arrivalMethod: checkIn ? checkIn.method : null,
      checkedOut: !!checkOut,
      checkoutTime: checkOut ? checkOut.checkOutTime.toISOString() : null,
    },
    journey,
    diary: diaryRows.map((e) => ({
      date: e.date,
      subject: e.subject?.name ?? null,
      teacher: e.teacher.user?.name ?? 'Teacher',
      taughtToday: e.taughtToday,
      classwork: e.classwork,
      homework: e.homework,
      note: e.note,
    })),
    notices: noticeRows.map((n) => ({
      title: n.title,
      body: n.body,
      priority: n.priority,
      createdAt: n.createdAt.toISOString(),
    })),
    dateSheet: scheduleRows.map((s) => ({
      date: s.date.toISOString(),
      subject: s.subject.name,
      startTime: s.startTime,
      totalMarks: s.totalMarks,
      termName: s.examTerm.name,
    })),
    fees: { vouchers, totalOutstanding },
    exams,
    notificationsNote:
      'Arrival, departure and absence alerts for your child are logged to the school notification log ' +
      'and shown in-app here. Make sure your phone number on file with the school office is current.',
  };
}
