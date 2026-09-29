import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUserStrict as apiUser, schoolIdOr400 } from '@/lib/api-auth';

/** DELETE /api/expenses/[id] — removes an expense entry (confirm on the client). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('finance.manage');
  if (auth.error) return auth.error;
  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  const { id } = await params;
  const expense = await prisma.expense.findFirst({
    where: { id, schoolId: sres.schoolId },
    select: { id: true },
  });
  if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
