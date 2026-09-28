import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser, schoolIdOr400 } from '@/lib/api-auth';

/** PKT month window [start, end) for a YYYY-MM string, or null when invalid. */
function monthWindow(monthStr: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(monthStr);
  if (!m) return null;
  const month = parseInt(m[2], 10);
  if (month < 1 || month > 12) return null;
  const start = new Date(`${m[1]}-${m[2]}-01T00:00:00+05:00`);
  const next =
    month === 12 ? `${parseInt(m[1], 10) + 1}-01` : `${m[1]}-${String(month + 1).padStart(2, '0')}`;
  return { start, end: new Date(`${next}-01T00:00:00+05:00`) };
}

export interface PnlResult {
  month: string;
  income: number;
  expenses: number;
  net: number;
  byHead: Array<{ head: string; amount: number }>;
  byMethod: Array<{ method: string; amount: number }>;
}

/**
 * GET /api/finance/pnl?month=YYYY-MM
 * Monthly P&L: income = sum of payments by paidAt in the month,
 * expenses = sum of expenses by date in the month, plus net,
 * an expense breakdown by head, and an income breakdown by payment method.
 */
export async function GET(req: Request) {
  const auth = await apiUser('finance.manage');
  if (auth.error) return auth.error;
  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  const url = new URL(req.url);
  const monthStr = url.searchParams.get('month');
  const window = monthStr ? monthWindow(monthStr) : monthWindow(currentMonthStr());
  if (!window) return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 });

  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: { paidAt: { gte: window.start, lt: window.end } },
      select: { amount: true, method: true },
    }),
    prisma.expense.findMany({
      where: { schoolId: sres.schoolId, date: { gte: window.start, lt: window.end } },
      include: { head: { select: { name: true } } },
    }),
  ]);

  const income = payments.reduce((s, p) => s + p.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const headTotals = new Map<string, number>();
  for (const e of expenses) {
    headTotals.set(e.head.name, (headTotals.get(e.head.name) ?? 0) + e.amount);
  }
  const byHead = [...headTotals.entries()]
    .map(([head, amount]) => ({ head, amount }))
    .sort((a, b) => b.amount - a.amount);

  const methodTotals = new Map<string, number>();
  for (const p of payments) {
    methodTotals.set(p.method, (methodTotals.get(p.method) ?? 0) + p.amount);
  }
  const byMethod = [...methodTotals.entries()]
    .map(([method, amount]) => ({ method, amount }))
    .sort((a, b) => b.amount - a.amount);

  const result: PnlResult = {
    month: monthStr ?? currentMonthStr(),
    income,
    expenses: totalExpenses,
    net: income - totalExpenses,
    byHead,
    byMethod,
  };
  return NextResponse.json(result);
}

function currentMonthStr(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit',
  }).format(new Date());
  return parts.slice(0, 7);
}
