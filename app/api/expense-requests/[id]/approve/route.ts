import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser, schoolIdOr400 } from '@/lib/api-auth';

/** POST /api/expense-requests/[id]/approve { sourceId } */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('expenses.approve');
  if (auth.error) return auth.error;
  const { user } = auth;

  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  const { id } = await params;

  let body: { sourceId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const request = await prisma.expenseRequest.findFirst({
    where: { id, schoolId: sres.schoolId },
    include: { head: { select: { id: true, name: true } } },
  });
  if (!request) return NextResponse.json({ error: 'Expense request not found' }, { status: 404 });
  if (request.status !== 'PENDING') {
    return NextResponse.json({ error: `Request is already ${request.status.toLowerCase()}` }, { status: 400 });
  }
  if (request.requestedById === user.id) {
    return NextResponse.json({ error: 'You cannot approve your own request' }, { status: 403 });
  }
  if (!body.sourceId) return NextResponse.json({ error: 'sourceId is required' }, { status: 400 });

  const source = await prisma.paymentSource.findFirst({
    where: { id: body.sourceId, schoolId: sres.schoolId },
  });
  if (!source) return NextResponse.json({ error: 'Unknown payment source' }, { status: 400 });

  const description = request.description
    ? `${request.title} — ${request.description}`.slice(0, 500)
    : request.title.slice(0, 500);

  // NOTE: Neon HTTP adapter does not support $transaction — the two writes
  // run sequentially. Idempotency: if a previous attempt created the expense
  // but failed before marking the request approved, request.expenseId is set
  // and we reuse it instead of booking a duplicate expense.
  const decidedAt = new Date();
  let expenseId = request.expenseId as string | null;
  if (!expenseId) {
    const expense = await prisma.expense.create({
      data: {
        schoolId: sres.schoolId,
        date: decidedAt,
        headId: request.headId,
        sourceId: source.id,
        amount: request.amount,
        description,
        addedById: user.id,
      },
    });
    expenseId = expense.id;
  }
  const updated = await prisma.expenseRequest.update({
    where: { id: request.id },
    data: {
      status: 'APPROVED',
      decidedById: user.id,
      decidedAt,
      sourceId: source.id,
      expenseId,
    },
  });

  return NextResponse.json({
    ok: true,
    request: { id: updated.id, status: updated.status },
    expense: { id: expenseId, amount: request.amount },
  });
}
