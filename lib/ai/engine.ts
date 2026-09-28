/**
 * Kaizen AI — deterministic intent engine (rule-based DB core).
 *
 * Every data answer below comes from a REAL Prisma query scoped to the
 * requester's role. HARD RULE: if no record exists, the answer says so
 * plainly. Records are NEVER invented.
 *
 * Each data tool returns { reply, sources } where `sources` is a one-line
 * citation of the records consulted (e.g. "Source: 6 period records, 1 gate
 * check-in — 28 Sep 2026"). Every data answer must state that it comes from
 * school records.
 */
import type { PrismaClient, Role } from '@prisma/client';
import type { SafeUser } from '../auth';
import { pkr, todayPKT, pktDate, pktTime } from '../format';

// ── Intent taxonomy ─────────────────────────────────────────────────────────

export type Intent =
  | 'help'
  | 'child_attendance'
  | 'child_arrival'
  | 'child_fees'
  | 'child_results'
  | 'school_stats'
  | 'conflicts'
  | 'fee_defaulters'
  | 'pending_submissions'
  | 'my_schedule'
  | 'class_absentees'
  | 'my_attendance'
  | 'study_help'
  | 'general';

/** Data intents answered from the rule-based DB engine (never generative). */
export const DATA_INTENTS: ReadonlySet<Intent> = new Set([
  'child_attendance',
  'child_arrival',
  'child_fees',
  'child_results',
  'school_stats',
  'conflicts',
  'fee_defaulters',
  'pending_submissions',
  'my_schedule',
  'class_absentees',
  'my_attendance',
]);

/** Which roles may invoke each data intent. Server-side enforced in runIntent. */
const INTENT_ROLES: Record<Intent, readonly Role[]> = {
  help: ['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER', 'STAFF', 'PARENT', 'STUDENT'],
  child_attendance: ['PARENT'],
  child_arrival: ['PARENT'],
  child_fees: ['PARENT'],
  child_results: ['PARENT'],
  school_stats: ['SUPER_ADMIN', 'PRINCIPAL'],
  conflicts: ['SUPER_ADMIN', 'PRINCIPAL'],
  fee_defaulters: ['SUPER_ADMIN', 'PRINCIPAL', 'STAFF'],
  pending_submissions: ['SUPER_ADMIN', 'PRINCIPAL'],
  my_schedule: ['TEACHER', 'SUPER_ADMIN', 'PRINCIPAL'],
  class_absentees: ['TEACHER', 'SUPER_ADMIN', 'PRINCIPAL'],
  my_attendance: ['STUDENT'],
  study_help: ['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER', 'STAFF', 'PARENT', 'STUDENT'],
  general: ['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER', 'STAFF', 'PARENT', 'STUDENT'],
};

export function intentAllowed(intent: Intent, role: Role): boolean {
  return INTENT_ROLES[intent].includes(role);
}

// ── Classification (keyword/regex, no ML) ───────────────────────────────────

const RX = {
  help: /\b(help|what can you do|commands?|capabilit|how (do|can) i use|assist)/i,
  conflict: /\bconflict/i,
  feeDefaulter:
    /\b(defaulters?|fee collection|collection (report|summary)|unpaid students|who (hasn.?t|has not) paid|overdue (fees?|vouchers?|list))\b/i,
  fee: /\b(fees?|vouchers?|dues?|balances?|payments?|paid|payable|overdue|challan)\b/i,
  arrival: /\b(arriv\w*|(reach|reached) (school|campus)|check.?in|at school|came to school|reached at|gate)\b/i,
  result: /\b(results?|marks|exam|report card|reportcard|grade(?!s? (1|2|3|4|5)\b)|score|percentage|position)\b/i,
  attendance: /\b(attendance|present|absent|marked|register)\b/i,
  classAbsentees: /\b(absentees?|who.{0,25}absent|absent students|absent in (my|the) class)\b/i,
  schoolStats:
    /\b(school (stats|statistics|summary|overview)|total students|how many students|school today|overall attendance)\b/i,
  pendingSubmissions:
    /\b(pending submissions?|submissions? pending|not submitted|missing registers?|register(s)? (pending|missing)|lectures? (not |un)marked)\b/i,
  schedule: /\b(schedule|my classes|timetable|time table|my periods|classes today|today.?s classes|periods today)\b/i,
  myAttendance: /\bmy attendance\b|am i (present|marked)|my presence/i,
  studyHelp:
    /\b(explain|teach( me)?|what is|what are|how does|how do|why does|why do|define|meaning of|help me (study|learn|revise|understand)|study (about|for)|revise|learn about|tell me about|notes on|summar(y|ize|ise))\b/i,
} as const;

function mentionsChild(text: string): boolean {
  return /\b(child|kid|son|daughter|my ward)\b/i.test(text);
}

/** Deterministic intent classification. Order matters: most specific first. */
export function classifyIntent(message: string, role: Role): Intent {
  const t = message.toLowerCase();

  if (RX.help.test(t)) return 'help';

  // Parent intents first when the message is clearly about a child or the
  // requester is a parent asking about fees/arrival/results/attendance.
  const isParent = role === 'PARENT';
  if (RX.conflict.test(t)) return 'conflicts';
  if (RX.feeDefaulter.test(t)) return 'fee_defaulters';
  if (isParent || mentionsChild(t)) {
    if (RX.fee.test(t)) return 'child_fees';
    if (RX.arrival.test(t)) return 'child_arrival';
    if (RX.result.test(t)) return 'child_results';
    if (RX.attendance.test(t)) return 'child_attendance';
  }

  if (RX.schoolStats.test(t)) return 'school_stats';
  if (RX.pendingSubmissions.test(t)) return 'pending_submissions';
  if (RX.classAbsentees.test(t)) return 'class_absentees';
  if (RX.fee.test(t)) return isParent ? 'child_fees' : 'fee_defaulters';
  if (RX.result.test(t)) return isParent ? 'child_results' : 'general';
  if (RX.schedule.test(t)) return 'my_schedule';
  if (RX.myAttendance.test(t) || (role === 'STUDENT' && RX.attendance.test(t))) return 'my_attendance';
  if (RX.attendance.test(t)) return isParent ? 'child_attendance' : 'general';
  if (RX.arrival.test(t)) return isParent ? 'child_arrival' : 'general';
  if (RX.studyHelp.test(t)) return 'study_help';

  return 'general';
}

// ── Result shape ────────────────────────────────────────────────────────────

export interface DataAnswer {
  reply: string;
  sources: string;
}

function sourceLine(records: string, date = todayPKT()): string {
  return `Source: school records — ${records} · checked ${pktDate(date)}.`;
}

const RECORDS_NOTE = '\n\nThis answer comes from the school database, not from memory.';

// ── Role-scoped record resolution ───────────────────────────────────────────

async function childrenOfParent(db: PrismaClient, user: SafeUser) {
  const parent = await db.parent.findUnique({
    where: { userId: user.id },
    include: { children: { include: { student: { include: { grade: true, section: true } } } } },
  });
  return parent ? parent.children.map((c) => c.student) : [];
}

async function studentOfUser(db: PrismaClient, user: SafeUser) {
  return db.student.findUnique({
    where: { userId: user.id },
    include: { grade: true, section: true },
  });
}

async function teacherOfUser(db: PrismaClient, user: SafeUser) {
  return db.teacher.findUnique({ where: { userId: user.id } });
}

function sectionLabel(s: { grade: { name: string }; section: { name: string } }): string {
  return `${s.grade.name}-${s.section.name}`;
}

/** This month's attendance % from period records: PRESENT / (PRESENT + ABSENT). PENDING is excluded, never counted as absent. */
async function monthAttendancePct(
  db: PrismaClient,
  studentId: string,
  today: string,
): Promise<{ pct: number | null; present: number; counted: number }> {
  const monthStart = today.slice(0, 7) + '-01';
  const rows = await db.periodAttendance.groupBy({
    by: ['status'],
    where: { studentId, date: { gte: monthStart, lte: today } },
    _count: { status: true },
  });
  let present = 0;
  let absent = 0;
  for (const r of rows) {
    if (r.status === 'PRESENT') present = r._count.status;
    else if (r.status === 'ABSENT') absent = r._count.status;
  }
  const counted = present + absent;
  return { pct: counted === 0 ? null : Math.round((present / counted) * 100), present, counted };
}

// ── Data tools ──────────────────────────────────────────────────────────────

async function runChildAttendance(db: PrismaClient, user: SafeUser): Promise<DataAnswer> {
  const children = await childrenOfParent(db, user);
  if (children.length === 0) {
    return {
      reply: `I couldn't find any children linked to your account in the school records. Please contact the school office to link your parent profile.${RECORDS_NOTE}`,
      sources: sourceLine('no child links found'),
    };
  }
  const today = todayPKT();
  const blocks: string[] = [];
  let recordCount = 0;
  for (const child of children) {
    const records = await db.periodAttendance.findMany({
      where: { studentId: child.id, date: today },
      include: { subject: true },
      orderBy: { periodNo: 'asc' },
    });
    recordCount += records.length;
    const { pct } = await monthAttendancePct(db, child.id, today);
    let line = `**${child.name}** (${sectionLabel(child)}, today ${pktDate(today)})`;
    if (records.length === 0) {
      line += `\n- No attendance has been marked for ${child.name}'s section today yet.`;
    } else {
      const symbol: Record<string, string> = { PRESENT: 'Present', ABSENT: 'Absent', PENDING: 'Pending' };
      for (const r of records) {
        line += `\n- Period ${r.periodNo} (${r.subject.name}): ${symbol[r.status]}`;
      }
    }
    line += `\n- This-month attendance: ${pct === null ? 'no marked records this month' : `${pct}%`}`;
    blocks.push(line);
  }
  return {
    reply: `${blocks.join('\n\n')}${RECORDS_NOTE}`,
    sources: sourceLine(`${recordCount} period records across ${children.length} child(ren)`),
  };
}

async function runChildArrival(db: PrismaClient, user: SafeUser): Promise<DataAnswer> {
  const children = await childrenOfParent(db, user);
  if (children.length === 0) {
    return {
      reply: `I couldn't find any children linked to your account in the school records. Please contact the school office to link your parent profile.${RECORDS_NOTE}`,
      sources: sourceLine('no child links found'),
    };
  }
  const today = todayPKT();
  const blocks: string[] = [];
  for (const child of children) {
    const checkIn = await db.gateCheckIn.findUnique({
      where: { studentId_date: { studentId: child.id, date: today } },
    });
    const checkOut = await db.gateCheckOut.findUnique({
      where: { studentId_date: { studentId: child.id, date: today } },
    });
    let line = `**${child.name}** (${sectionLabel(child)})`;
    if (!checkIn) {
      line += `\n- No check-in recorded today (${pktDate(today)}). Your child has not been scanned at the gate yet.`;
    } else {
      line += `\n- Arrived at ${pktTime(checkIn.checkInTime)} via ${checkIn.method.toLowerCase().replace('_', ' ')}`;
      line += checkOut
        ? `\n- Dismissed at ${pktTime(checkOut.checkOutTime)}`
        : `\n- Not yet dismissed (no check-out recorded).`;
    }
    blocks.push(line);
  }
  return {
    reply: `${blocks.join('\n\n')}${RECORDS_NOTE}`,
    sources: sourceLine('gate check-in / check-out records'),
  };
}

async function voucherBalance(db: PrismaClient, voucherId: string, voucher: { totalAmount: number; discountAmount: number }) {
  const paid = await db.payment.aggregate({
    where: { voucherId },
    _sum: { amount: true },
  });
  const paidSum = paid._sum.amount ?? 0;
  const balance = voucher.totalAmount - voucher.discountAmount - paidSum;
  return { paid: paidSum, balance };
}

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

async function runChildFees(db: PrismaClient, user: SafeUser): Promise<DataAnswer> {
  const children = await childrenOfParent(db, user);
  if (children.length === 0) {
    return {
      reply: `I couldn't find any children linked to your account in the school records. Please contact the school office to link your parent profile.${RECORDS_NOTE}`,
      sources: sourceLine('no child links found'),
    };
  }
  const now = new Date();
  const blocks: string[] = [];
  let voucherCount = 0;
  for (const child of children) {
    const vouchers = await db.feeVoucher.findMany({
      where: { studentId: child.id },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 6,
    });
    voucherCount += vouchers.length;
    let line = `**${child.name}** (${sectionLabel(child)})`;
    if (vouchers.length === 0) {
      line += `\n- No fee vouchers found for ${child.name}.`;
    } else {
      for (const v of vouchers) {
        const { paid, balance } = await voucherBalance(db, v.id, v);
        const overdue = v.dueDate < now && balance > 0;
        const label = `${MONTH_NAMES[v.month]} ${v.year}`;
        if (balance <= 0) {
          line += `\n- ${label}: ${pkr(v.totalAmount)} — Paid${v.discountAmount > 0 ? ` (discount ${pkr(v.discountAmount)})` : ''}`;
        } else {
          line += `\n- ${label}: total ${pkr(v.totalAmount)}, paid ${pkr(paid)}, balance ${pkr(balance)}${overdue ? ' — OVERDUE' : ''}`;
        }
      }
    }
    blocks.push(line);
  }
  return {
    reply: `${blocks.join('\n\n')}${RECORDS_NOTE}`,
    sources: sourceLine(`${voucherCount} fee vouchers + payments`),
  };
}

async function runChildResults(db: PrismaClient, user: SafeUser): Promise<DataAnswer> {
  const children = await childrenOfParent(db, user);
  if (children.length === 0) {
    return {
      reply: `I couldn't find any children linked to your account in the school records. Please contact the school office to link your parent profile.${RECORDS_NOTE}`,
      sources: sourceLine('no child links found'),
    };
  }
  const blocks: string[] = [];
  let resultCount = 0;
  for (const child of children) {
    const latestTerm = await db.examTerm.findFirst({ orderBy: { startDate: 'desc' } });
    let line = `**${child.name}** (${sectionLabel(child)})`;
    if (!latestTerm) {
      line += `\n- No exam terms found in the school records yet.`;
      blocks.push(line);
      continue;
    }
    const results = await db.examResult.findMany({
      where: {
        studentId: child.id,
        examSchedule: { examTermId: latestTerm.id, gradeId: child.gradeId },
      },
      include: { examSchedule: { include: { subject: true } } },
      orderBy: { examSchedule: { subject: { name: 'asc' } } },
    });
    resultCount += results.length;
    if (results.length === 0) {
      line += `\n- No results published for "${latestTerm.name}" yet. Results appear here once teachers enter them.`;
    } else {
      line += ` — ${latestTerm.name}`;
      let obtained = 0;
      let total = 0;
      for (const r of results) {
        obtained += r.obtainedMarks;
        total += r.examSchedule.totalMarks;
        line += `\n- ${r.examSchedule.subject.name}: ${r.obtainedMarks}/${r.examSchedule.totalMarks}`;
      }
      const pct = total > 0 ? Math.round((obtained / total) * 100) : 0;
      line += `\n- Aggregate: ${obtained}/${total} (${pct}%)`;
    }
    blocks.push(line);
  }
  return {
    reply: `${blocks.join('\n\n')}${RECORDS_NOTE}`,
    sources: sourceLine(`${resultCount} exam result records`),
  };
}

async function runSchoolStats(db: PrismaClient): Promise<DataAnswer> {
  const today = todayPKT();
  const [students, teachers, sections, checkIns, conflicts, overdueCount] = await Promise.all([
    db.student.count({ where: { isActive: true } }),
    db.teacher.count({ where: { isActive: true } }),
    db.section.count(),
    db.gateCheckIn.count({ where: { date: today } }),
    db.attendanceConflict.count({ where: { status: 'OPEN' } }),
    db.feeVoucher.count({ where: { status: { not: 'PAID' }, dueDate: { lt: new Date() } } }),
  ]);
  const gatePct = students === 0 ? 0 : Math.round((checkIns / students) * 100);
  const reply =
    `**School snapshot — ${pktDate(today)}**\n` +
    `- Enrolled students: ${students}\n` +
    `- Active teachers: ${teachers}\n` +
    `- Sections: ${sections}\n` +
    `- Gate check-ins today: ${checkIns}/${students} (${gatePct}%)\n` +
    `- Open attendance conflicts: ${conflicts}\n` +
    `- Overdue unpaid vouchers: ${overdueCount}${RECORDS_NOTE}`;
  return {
    reply,
    sources: sourceLine('student, teacher, section, gate check-in, conflict & voucher counts'),
  };
}

async function runConflicts(db: PrismaClient): Promise<DataAnswer> {
  const conflicts = await db.attendanceConflict.findMany({
    where: { status: 'OPEN' },
    include: { student: { include: { grade: true, section: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  let reply: string;
  if (conflicts.length === 0) {
    reply = `No open attendance conflicts. Every gate check-in currently matches the lecture registers.${RECORDS_NOTE}`;
  } else {
    const lines = conflicts.map(
      (c) =>
        `- ${c.student.name} (${sectionLabel(c.student)}) — ${pktDate(c.date)}: ${c.note ?? 'checked in at gate but marked absent in a lecture'}`,
    );
    reply = `**${conflicts.length} open attendance conflict(s)**\n${lines.join('\n')}\n\nResolve them from Attendance → Conflicts.${RECORDS_NOTE}`;
  }
  return { reply, sources: sourceLine(`${conflicts.length} open conflict records`) };
}

async function runFeeDefaulters(db: PrismaClient): Promise<DataAnswer> {
  const vouchers = await db.feeVoucher.findMany({
    where: { status: { not: 'PAID' } },
    include: { student: { include: { grade: true, section: true } } },
    orderBy: { dueDate: 'asc' },
    take: 50,
  });
  const now = new Date();
  const rows: Array<{ student: string; month: string; balance: number; overdue: boolean }> = [];
  for (const v of vouchers) {
    const { balance } = await voucherBalance(db, v.id, v);
    if (balance > 0) {
      rows.push({
        student: `${v.student.name} (${sectionLabel(v.student)})`,
        month: `${MONTH_NAMES[v.month]} ${v.year}`,
        balance,
        overdue: v.dueDate < now,
      });
    }
  }
  rows.sort((a, b) => b.balance - a.balance);
  const top = rows.slice(0, 10);
  let reply: string;
  if (top.length === 0) {
    reply = `No outstanding fee balances. All vouchers are fully paid.${RECORDS_NOTE}`;
  } else {
    const lines = top.map(
      (r) => `- ${r.student} — ${r.month}: ${pkr(r.balance)}${r.overdue ? ' (OVERDUE)' : ''}`,
    );
    const total = rows.reduce((s, r) => s + r.balance, 0);
    reply =
      `**Top ${top.length} fee defaulters** (of ${rows.length} vouchers with balance; total outstanding ${pkr(total)})\n` +
      `${lines.join('\n')}${RECORDS_NOTE}`;
  }
  return { reply, sources: sourceLine(`${vouchers.length} unpaid/partial vouchers + payments`) };
}

async function runPendingSubmissions(db: PrismaClient): Promise<DataAnswer> {
  const today = todayPKT();
  const dow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' })).getDay();
  const slots = await db.timetableSlot.findMany({
    where: { dayOfWeek: dow },
    include: { section: { include: { grade: true } } },
    distinct: ['sectionId'],
  });
  const lacking: string[] = [];
  for (const s of slots) {
    const marked = await db.periodAttendance.count({
      where: { sectionId: s.sectionId, date: today },
    });
    if (marked === 0) lacking.push(`${s.section.grade.name}-${s.section.name}`);
  }
  let reply: string;
  if (slots.length === 0) {
    reply = `No classes are timetabled today (${pktDate(today)}), so there are no pending submissions.${RECORDS_NOTE}`;
  } else if (lacking.length === 0) {
    reply = `All ${slots.length} section(s) with classes today have submitted period attendance.${RECORDS_NOTE}`;
  } else {
    reply =
      `**${lacking.length} section(s) with classes today have no period attendance submitted:**\n` +
      lacking.map((l) => `- ${l}`).join('\n') +
      `\n\nTeachers can submit from Attendance → Period Register.${RECORDS_NOTE}`;
  }
  return { reply, sources: sourceLine(`${slots.length} timetabled sections, period attendance rows`) };
}

async function runMySchedule(db: PrismaClient, user: SafeUser): Promise<DataAnswer> {
  const teacher = await teacherOfUser(db, user);
  if (!teacher) {
    return {
      reply: `I couldn't find a teacher profile linked to your account, so I can't load your timetable. Please contact the school office.${RECORDS_NOTE}`,
      sources: sourceLine('no teacher profile found'),
    };
  }
  const today = todayPKT();
  const dow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' })).getDay();
  const slots = await db.timetableSlot.findMany({
    where: { teacherId: teacher.id, dayOfWeek: dow },
    include: { subject: true, section: { include: { grade: true } } },
    orderBy: { periodNo: 'asc' },
  });
  let reply: string;
  if (slots.length === 0) {
    reply = `You have no classes timetabled today (${pktDate(today)}).${RECORDS_NOTE}`;
  } else {
    const lines = slots.map(
      (s) =>
        `- Period ${s.periodNo} (${s.startTime}–${s.endTime}): ${s.subject.name}, ${s.section.grade.name}-${s.section.name}${s.room ? `, Room ${s.room}` : ''}`,
    );
    reply = `**Your classes today — ${pktDate(today)}**\n${lines.join('\n')}${RECORDS_NOTE}`;
  }
  return { reply, sources: sourceLine(`${slots.length} timetable slots`) };
}

async function runClassAbsentees(db: PrismaClient, user: SafeUser): Promise<DataAnswer> {
  const teacher = await teacherOfUser(db, user);
  if (!teacher) {
    return {
      reply: `I couldn't find a teacher profile linked to your account, so I can't check your classes. Please contact the school office.${RECORDS_NOTE}`,
      sources: sourceLine('no teacher profile found'),
    };
  }
  const today = todayPKT();
  const dow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' })).getDay();
  const mySections = await db.timetableSlot.findMany({
    where: { teacherId: teacher.id, dayOfWeek: dow },
    distinct: ['sectionId'],
    select: { sectionId: true },
  });
  const sectionIds = mySections.map((s) => s.sectionId);
  if (sectionIds.length === 0) {
    return {
      reply: `You have no classes timetabled today (${pktDate(today)}), so there are no absentees to report.${RECORDS_NOTE}`,
      sources: sourceLine('timetable slots checked'),
    };
  }
  const absent = await db.periodAttendance.findMany({
    where: { sectionId: { in: sectionIds }, date: today, status: 'ABSENT' },
    include: { student: true, subject: true },
  });
  let reply: string;
  if (absent.length === 0) {
    reply = `No absentees marked in your sections today (${pktDate(today)}). Either everyone is present or attendance hasn't been marked yet — pending marks are not counted as absent.${RECORDS_NOTE}`;
  } else {
    const byStudent = new Map<string, { name: string; periods: string[] }>();
    for (const a of absent) {
      const entry = byStudent.get(a.studentId) ?? { name: a.student.name, periods: [] };
      entry.periods.push(`P${a.periodNo} (${a.subject.name})`);
      byStudent.set(a.studentId, entry);
    }
    const lines = [...byStudent.values()].map((s) => `- ${s.name}: absent in ${s.periods.join(', ')}`);
    reply = `**${byStudent.size} absent student(s) in your sections today — ${pktDate(today)}**\n${lines.join('\n')}${RECORDS_NOTE}`;
  }
  return { reply, sources: sourceLine(`${absent.length} ABSENT period records in your sections`) };
}

async function runMyAttendance(db: PrismaClient, user: SafeUser): Promise<DataAnswer> {
  const student = await studentOfUser(db, user);
  if (!student) {
    return {
      reply: `I couldn't find a student profile linked to your account, so I can't load your attendance. Please contact the school office.${RECORDS_NOTE}`,
      sources: sourceLine('no student profile found'),
    };
  }
  const today = todayPKT();
  const records = await db.periodAttendance.findMany({
    where: { studentId: student.id, date: today },
    include: { subject: true },
    orderBy: { periodNo: 'asc' },
  });
  const checkIn = await db.gateCheckIn.findUnique({
    where: { studentId_date: { studentId: student.id, date: today } },
  });
  const { pct } = await monthAttendancePct(db, student.id, today);
  const symbol: Record<string, string> = { PRESENT: 'Present', ABSENT: 'Absent', PENDING: 'Pending' };
  let reply = `**Your attendance — ${pktDate(today)}** (${sectionLabel(student)})`;
  reply += checkIn
    ? `\n- Gate check-in: ${pktTime(checkIn.checkInTime)}`
    : `\n- No gate check-in recorded today.`;
  if (records.length === 0) {
    reply += `\n- No period attendance has been marked for your section today yet.`;
  } else {
    for (const r of records) {
      reply += `\n- Period ${r.periodNo} (${r.subject.name}): ${symbol[r.status]}`;
    }
  }
  reply += `\n- This-month attendance: ${pct === null ? 'no marked records this month' : `${pct}%`}${RECORDS_NOTE}`;
  return {
    reply,
    sources: sourceLine(`${records.length} period records${checkIn ? ' + 1 gate check-in' : ''}`),
  };
}

// ── Help ────────────────────────────────────────────────────────────────────

const HELP_CAPABILITIES: Record<Role, string[]> = {
  SUPER_ADMIN: [
    'School snapshot — student/teacher counts, today\'s attendance, open conflicts, overdue fees ("school stats")',
    'Open attendance conflicts with student and date details ("show open conflicts")',
    'Top fee defaulters by outstanding balance ("fee defaulters")',
    'Sections that haven\'t submitted period attendance today ("pending submissions")',
  ],
  PRINCIPAL: [
    'School snapshot — student/teacher counts, today\'s attendance, open conflicts, overdue fees ("school stats")',
    'Open attendance conflicts with student and date details ("show open conflicts")',
    'Top fee defaulters by outstanding balance ("fee defaulters")',
    'Sections that haven\'t submitted period attendance today ("pending submissions")',
  ],
  TEACHER: [
    'Your classes today — period, subject, section and room ("my schedule today")',
    'Absentees in your sections today ("who is absent in my class")',
  ],
  STAFF: [
    'Top fee defaulters by outstanding balance ("fee defaulters")',
    'Study help and general questions',
  ],
  PARENT: [
    'Your child\'s attendance today, period by period, plus this-month % ("Was my child marked present today?")',
    'Your child\'s gate arrival time today ("When did my child arrive?")',
    'Outstanding fee vouchers per child ("What fees are pending?")',
    'Latest exam results per child ("Show my child\'s results")',
  ],
  STUDENT: [
    'Your own attendance today plus this-month % ("my attendance")',
    'Study help — ask me to explain any topic ("Explain photosynthesis")',
  ],
};

export function helpReply(role: Role): DataAnswer {
  const caps = HELP_CAPABILITIES[role];
  const reply =
    `**Here's what I can do for you** (I'm Kaizen AI — every data answer comes from the school database):\n` +
    caps.map((c) => `- ${c}`).join('\n') +
    `\n\nI can also explain study topics and answer general questions. Just ask!`;
  return { reply, sources: 'Source: capability list (no records queried).' };
}

// ── Generative fallback (honest, rule-based) ────────────────────────────────

/** Extract a study topic from a free-form question for the guidance template. */
export function extractTopic(message: string): string {
  const cleaned = message
    .replace(/^(please\s+)?(can you\s+)?(explain|teach(\s+me)?|define|describe|tell me about|help me (study|learn|revise|understand)|study|revise|learn about|notes on|summar(y|ize|ise))\b[:\s]*/i, '')
    .replace(/^(what is|what are|how does|how do|why does|why do)\b[:\s]*/i, '')
    .replace(/[?!.]+$/, '')
    .trim();
  return cleaned || 'the topic';
}

/**
 * Honest rule-based guidance used when no generative provider is configured
 * (or a provider errors). Clearly labeled as general guidance — never
 * presented as school data.
 */
export function studyGuidance(message: string): string {
  const topic = extractTopic(message);
  return (
    `**Study guidance: ${topic}**\n` +
    `(General guidance — no AI provider is configured right now, so here's a structured way to learn this topic.)\n\n` +
    `**Key points to understand**\n` +
    `- Break "${topic}" into 3–4 sub-ideas and learn each one separately.\n` +
    `- For each sub-idea, write one definition in your own words.\n` +
    `- Connect it to something from daily life — examples make ideas stick.\n\n` +
    `**Worked example**\n` +
    `- Take one simple example of "${topic}" and walk through it step by step on paper.\n` +
    `- Label each step: what is happening, and why.\n\n` +
    `**Practice question**\n` +
    `- Explain "${topic}" to a friend (or to yourself out loud) in under 2 minutes without looking at your notes.\n` +
    `- If you get stuck, that's exactly the part to revise next.\n\n` +
    `Ask your teacher in class for the textbook page on this topic, and come back here once an AI provider is configured for a full explanation.`
  );
}

/** Fallback for unmatched general questions when no generative provider exists. */
export function generalGuidance(message: string, role: Role): string {
  const { reply } = helpReply(role);
  return (
    `I'm Kaizen AI. Without a configured AI provider I can only answer school-record questions reliably — I won't guess at open-ended answers.\n\n` +
    `You asked: "${message.slice(0, 120)}"\n\n` +
    `Try rephrasing as one of the things below, or ask your administrator to configure an AI provider (Ollama, Hugging Face, or Gemini) for open-ended answers.\n\n${reply}`
  );
}

// ── Dispatcher ──────────────────────────────────────────────────────────────

export interface IntentResult {
  answer: DataAnswer;
  generative: boolean;
}

/**
 * Run an intent for a user. Returns { answer, generative } where generative
 * is true only for study_help/general when a provider MIGHT answer (the route
 * calls generateText); data intents are always deterministic.
 *
 * Server-side role scoping: an intent the role may not invoke gets an honest
 * refusal, never data.
 */
export async function runIntent(
  db: PrismaClient,
  user: SafeUser,
  intent: Intent,
): Promise<IntentResult> {
  if (!intentAllowed(intent, user.role)) {
    return {
      generative: false,
      answer: {
        reply: `That question is available for a different role. Your account is a ${user.role.toLowerCase().replace('_', ' ')} — ${helpReply(user.role).reply}`,
        sources: 'Source: none — role scoping.',
      },
    };
  }
  if (intent === 'help') return { generative: false, answer: helpReply(user.role) };
  switch (intent) {
    case 'child_attendance':
      return { generative: false, answer: await runChildAttendance(db, user) };
    case 'child_arrival':
      return { generative: false, answer: await runChildArrival(db, user) };
    case 'child_fees':
      return { generative: false, answer: await runChildFees(db, user) };
    case 'child_results':
      return { generative: false, answer: await runChildResults(db, user) };
    case 'school_stats':
      return { generative: false, answer: await runSchoolStats(db) };
    case 'conflicts':
      return { generative: false, answer: await runConflicts(db) };
    case 'fee_defaulters':
      return { generative: false, answer: await runFeeDefaulters(db) };
    case 'pending_submissions':
      return { generative: false, answer: await runPendingSubmissions(db) };
    case 'my_schedule':
      return { generative: false, answer: await runMySchedule(db, user) };
    case 'class_absentees':
      return { generative: false, answer: await runClassAbsentees(db, user) };
    case 'my_attendance':
      return { generative: false, answer: await runMyAttendance(db, user) };
    case 'study_help':
    case 'general':
      return { generative: true, answer: { reply: '', sources: '' } };
  }
}

// ── Excellence: role-aware follow-up chips ───────────────────────────────────

export const FOLLOW_UP_CHIPS: Record<Role, string[]> = {
  SUPER_ADMIN: ['School stats', 'Show open conflicts', 'Fee defaulters', 'Pending submissions'],
  PRINCIPAL: ['School stats', 'Show open conflicts', 'Fee defaulters', 'Pending submissions'],
  TEACHER: ['My schedule today', 'Who is absent in my class today?'],
  STAFF: ['Fee defaulters', 'Help'],
  PARENT: ['Was my child marked present today?', 'When did my child arrive?', 'What fees are pending?', "Show my child's results"],
  STUDENT: ['My attendance', 'Explain photosynthesis', 'Help'],
};
