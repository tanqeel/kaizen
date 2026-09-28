import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser, schoolIdOr400 } from '@/lib/api-auth';

/** POST /api/expense-requests/[id]/reject */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('expenses.approve');
  if (auth.error) return auth.error;
  const { user } = auth;

  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  const { id } = await params;

  const request = await prisma.expenseRequest.findFirst({
    where: { id, schoolId: sres.schoolId },
  });
  if (!request) return NextResponse.json({ error: 'Expense request not found' }, { status: 404 });
  if (request.status !== 'PENDING') {
    return NextResponse.json({ error: `Request is already ${request.status.toLowerCase()}` }, { status: 400 });
  }
  if (request.requestedById === user.id) {
    return NextResponse.json({ error: 'You cannot reject your own request' }, { status: 403 });
  }

  const updated = await prisma.expenseRequest.update({
    where: { id: request.id },
    data: {
      status: 'REJECTED',
      decidedById: user.id,
      decidedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, request: { id: updated.id, status: updated.status } });
}
