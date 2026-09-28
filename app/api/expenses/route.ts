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

export interface ExpenseRow {
  id: string;
  date: string;
  amount: number;
  description: string | null;
  head: { id: string; name: string };
  source: { id: string; name: string };
  addedBy: string | null;
}

/**
 * GET /api/expenses?month=YYYY-MM&format
 * Lists expenses (newest first). format=csv returns a CSV download.
 */
export async function GET(req: Request) {
  const auth = await apiUser('finance.manage');
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const monthStr = url.searchParams.get('month');
  const format = url.searchParams.get('format');

  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  const where: { schoolId: string; date?: { gte: Date; lt: Date } } = { schoolId: sres.schoolId };
  if (monthStr) {
    const window = monthWindow(monthStr);
    if (!window) return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 });
    where.date = { gte: window.start, lt: window.end };
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: {
      head: { select: { id: true, name: true } },
      source: { select: { id: true, name: true } },
      addedBy: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
    take: 500,
  });

  const rows: ExpenseRow[] = expenses.map((e) => ({
    id: e.id,
    date: e.date.toISOString(),
    amount: e.amount,
    description: e.description,
    head: e.head,
    source: e.source,
    addedBy: e.addedBy?.name ?? null,
  }));

  if (format === 'csv') {
    const header = 'Date,Head,Source,Amount (PKR),Description,Added By';
    const lines = rows.map((r) =>
      [r.date.slice(0, 10), r.head.name, r.source.name, r.amount, `"${(r.description ?? '').replace(/"/g, '""')}"`, r.addedBy ?? ''].join(','),
    );
    return new NextResponse([header, ...lines].join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="expenses-${monthStr ?? 'all'}.csv"`,
      },
    });
  }

  return NextResponse.json({
    expenses: rows,
    total: rows.reduce((s, r) => s + r.amount, 0),
  });
}

/** POST /api/expenses { date, headId, sourceId, amount, description? } */
export async function POST(req: Request) {
  const auth = await apiUser('finance.manage');
  if (auth.error) return auth.error;
  const { user } = auth;

  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  let body: { date?: string; headId?: string; sourceId?: string; amount?: number; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive whole number (PKR)' }, { status: 400 });
  }
  const date = body.date ? new Date(body.date) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: 'date is required (YYYY-MM-DD)' }, { status: 400 });
  }
  if (!body.headId || !body.sourceId) {
    return NextResponse.json({ error: 'headId and sourceId are required' }, { status: 400 });
  }
  const [head, source] = await Promise.all([
    prisma.expenseHead.findFirst({ where: { id: body.headId, schoolId: sres.schoolId } }),
    prisma.paymentSource.findFirst({ where: { id: body.sourceId, schoolId: sres.schoolId } }),
  ]);
  if (!head || !source) {
    return NextResponse.json({ error: 'Unknown expense head or payment source' }, { status: 400 });
  }

  const expense = await prisma.expense.create({
    data: {
      schoolId: sres.schoolId,
      date,
      headId: head.id,
      sourceId: source.id,
      amount,
      description: body.description?.trim() ? body.description.trim().slice(0, 500) : null,
      addedById: user.id,
    },
  });
  return NextResponse.json({ ok: true, id: expense.id }, { status: 201 });
}
