import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser, schoolIdOr400 } from '@/lib/api-auth';

export interface BudgetRow {
  headId: string;
  head: string;
  planned: number;
  actual: number;
}

/**
 * GET /api/finance/budgets — per expense head: planned (Budget row for the
 * current session, 0 when unset) vs actual (sum of expenses for the head
 * within the current session's date window).
 */
export async function GET() {
  const auth = await apiUser('finance.manage');
  if (auth.error) return auth.error;
  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  const session = await prisma.academicSession.findFirst({ where: { isCurrent: true } });
  if (!session) return NextResponse.json({ error: 'No current academic session' }, { status: 400 });

  const [heads, budgets] = await Promise.all([
    prisma.expenseHead.findMany({
      where: { schoolId: sres.schoolId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.budget.findMany({
      where: { schoolId: sres.schoolId, sessionId: session.id },
      select: { headId: true, plannedAmount: true },
    }),
  ]);
  const plannedByHead = new Map(budgets.map((b) => [b.headId, b.plannedAmount]));

  const actuals = await prisma.expense.groupBy({
    by: ['headId'],
    where: {
      schoolId: sres.schoolId,
      date: { gte: session.startDate, lte: session.endDate },
    },
    _sum: { amount: true },
  });
  const actualByHead = new Map(actuals.map((a) => [a.headId, a._sum.amount ?? 0]));

  const rows: BudgetRow[] = heads.map((h) => ({
    headId: h.id,
    head: h.name,
    planned: plannedByHead.get(h.id) ?? 0,
    actual: actualByHead.get(h.id) ?? 0,
  }));

  return NextResponse.json({
    budgets: rows,
    session: session.name,
    totals: {
      planned: rows.reduce((s, r) => s + r.planned, 0),
      actual: rows.reduce((s, r) => s + r.actual, 0),
    },
  });
}

/** PUT /api/finance/budgets { headId, plannedAmount } — upsert the planned amount. */
export async function PUT(req: Request) {
  const auth = await apiUser('finance.manage');
  if (auth.error) return auth.error;
  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  const session = await prisma.academicSession.findFirst({ where: { isCurrent: true } });
  if (!session) return NextResponse.json({ error: 'No current academic session' }, { status: 400 });

  let body: { headId?: string; plannedAmount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const plannedAmount = Number(body.plannedAmount);
  if (!body.headId) return NextResponse.json({ error: 'headId is required' }, { status: 400 });
  if (!Number.isInteger(plannedAmount) || plannedAmount < 0) {
    return NextResponse.json({ error: 'plannedAmount must be a non-negative whole number (PKR)' }, { status: 400 });
  }

  const head = await prisma.expenseHead.findFirst({
    where: { id: body.headId, schoolId: sres.schoolId },
    select: { id: true },
  });
  if (!head) return NextResponse.json({ error: 'Unknown expense head' }, { status: 400 });

  await prisma.budget.upsert({
    where: { schoolId_sessionId_headId: { schoolId: sres.schoolId, sessionId: session.id, headId: head.id } },
    create: { schoolId: sres.schoolId, sessionId: session.id, headId: head.id, plannedAmount },
    update: { plannedAmount },
  });
  return NextResponse.json({ ok: true });
}
