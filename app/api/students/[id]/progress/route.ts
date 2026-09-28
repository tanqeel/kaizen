import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';
import { childStudentIds } from '@/lib/parents';
import { todayPKT } from '@/lib/format';
import { balanceDue, effectiveTotal } from '@/lib/fees';

export interface ProgressMonthAttendance {
  /** 'YYYY-MM' */
  month: string;
  /** Period registers marked for the student that month (PRESENT + ABSENT + PENDING). */
  marked: number;
  present: number;
  absent: number;
  /** PENDING rows — never counted as absent. */
  pending: number;
  /** present / marked × 100 (PENDING lowers the bar instead of being dropped). null when marked = 0. */
  presentPct: number | null;
}

export interface ProgressTermResult {
  termId: string;
  termName: string;
  /** Aggregate obtained/total × 100 across published subjects. null when the term has no results. */
  pct: number | null;
  grade: string | null;
}

export interface ProgressFees {
  billed: number;
  paid: number;
  outstanding: number;
}

export interface StudentProgress {
  studentId: string;
  attendance: ProgressMonthAttendance[];
  results: ProgressTermResult[];
  fees: ProgressFees;
}

function gradeBand(pct: number): string {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}

/**
 * GET /api/students/[id]/progress — analytics rollup for one student:
 * attendance trend (last 6 calendar months), results grouped by exam term,
 * and fee standing (billed / paid / outstanding).
 *
 * Scope: 'students.view' then role-checked inside —
 * PARENT (one of their children), STUDENT (own profile),
 * TEACHER (student sits in a section they teach via timetable or class-teacher
 * assignment), SUPER_ADMIN/PRINCIPAL/STAFF (all).
 *
 * Attendance honesty: PENDING is reported separately and never counted as
 * absent; presentPct is present ÷ marked (all marked rows).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('students.view');
  if (auth.error) return auth.error;
  const { user } = auth;
  const { id } = await params;

  const student = await prisma.student.findFirst({
    where: { id, isActive: true },
    select: { id: true, sectionId: true },
  });
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  if (user.role === 'PARENT') {
    const ids = await childStudentIds(user.id);
    if (!ids.includes(id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } else if (user.role === 'STUDENT') {
    const me = await prisma.student.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!me || me.id !== id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } else if (user.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: user.id },
      include: {
        timetableSlots: { select: { sectionId: true } },
        classSections: { select: { id: true } },
      },
    });
    if (!teacher) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const taught = new Set([
      ...teacher.timetableSlots.map((s) => s.sectionId),
      ...teacher.classSections.map((s) => s.id),
    ]);
    if (!taught.has(student.sectionId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const today = todayPKT();
  const y = parseInt(today.slice(0, 4), 10);
  const m = parseInt(today.slice(5, 7), 10);
  const prefixes: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    prefixes.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }

  const [attRows, results, vouchers] = await Promise.all([
    prisma.periodAttendance.findMany({
      where: { studentId: id, OR: prefixes.map((p) => ({ date: { startsWith: p } })) },
      select: { date: true, status: true },
    }),
    prisma.examResult.findMany({
      where: { studentId: id },
      select: {
        obtainedMarks: true,
        examSchedule: {
          select: {
            totalMarks: true,
            examTerm: { select: { id: true, name: true, endDate: true } },
          },
        },
      },
    }),
    prisma.feeVoucher.findMany({
      where: { studentId: id },
      select: {
        totalAmount: true,
        discountAmount: true,
        fineAmount: true,
        payments: { select: { amount: true } },
      },
    }),
  ]);

  const byMonth = new Map<string, { marked: number; present: number; absent: number; pending: number }>();
  for (const p of prefixes) byMonth.set(p, { marked: 0, present: 0, absent: 0, pending: 0 });
  for (const r of attRows) {
    const key = r.date.slice(0, 7);
    const agg = byMonth.get(key);
    if (!agg) continue;
    agg.marked += 1;
    if (r.status === 'PRESENT') agg.present += 1;
    else if (r.status === 'ABSENT') agg.absent += 1;
    else agg.pending += 1;
  }
  const attendance: ProgressMonthAttendance[] = prefixes.map((p) => {
    const a = byMonth.get(p)!;
    return {
      month: p,
      marked: a.marked,
      present: a.present,
      absent: a.absent,
      pending: a.pending,
      presentPct: a.marked === 0 ? null : Math.round((a.present / a.marked) * 100),
    };
  });

  const byTerm = new Map<string, { termName: string; endDate: Date; obtained: number; total: number; rows: number }>();
  for (const r of results) {
    const t = r.examSchedule.examTerm;
    const cur = byTerm.get(t.id) ?? { termName: t.name, endDate: t.endDate, obtained: 0, total: 0, rows: 0 };
    cur.obtained += r.obtainedMarks;
    cur.total += r.examSchedule.totalMarks;
    cur.rows += 1;
    byTerm.set(t.id, cur);
  }
  const termResults: ProgressTermResult[] = [...byTerm.entries()]
    .sort((a, b) => a[1].endDate.getTime() - b[1].endDate.getTime())
    .map(([termId, t]) => {
      const pct = t.rows === 0 || t.total === 0 ? null : Math.round((t.obtained / t.total) * 100);
      return { termId, termName: t.termName, pct, grade: pct === null ? null : gradeBand(pct) };
    });

  const billed = vouchers.reduce((s, v) => s + effectiveTotal(v), 0);
  const paid = vouchers.reduce((s, v) => s + v.payments.reduce((p, x) => p + x.amount, 0), 0);
  const outstanding = vouchers.reduce(
    (s, v) => s + Math.max(0, balanceDue(v, v.payments)),
    0,
  );

  const body: StudentProgress = {
    studentId: id,
    attendance,
    results: termResults,
    fees: { billed, paid, outstanding },
  };
  return NextResponse.json(body);
}
