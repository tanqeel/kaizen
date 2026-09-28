import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';

/** GET /api/discounts/[id] — read-only single discount (edit = delete + recreate). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('finance.manage');
  if (auth.error) return auth.error;

  const { id } = await params;
  const discount = await prisma.discount.findUnique({
    where: { id },
    include: { approvedBy: { select: { name: true } } },
  });
  if (!discount) return NextResponse.json({ error: 'Discount not found' }, { status: 404 });
  return NextResponse.json({ discount });
}

/** DELETE /api/discounts/[id] — remove a discount (no edit endpoint by design). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('finance.manage');
  if (auth.error) return auth.error;

  const { id } = await params;
  const existing = await prisma.discount.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'Discount not found' }, { status: 404 });
  await prisma.discount.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
