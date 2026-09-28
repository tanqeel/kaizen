import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiPermission } from '@/lib/api-guard';

/** DELETE /api/academics/allocations/[id] — allocations have no dependents; free to remove. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission('academics.manage');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const allocation = await prisma.subjectAllocation.findUnique({ where: { id } });
  if (!allocation) return NextResponse.json({ error: 'Allocation not found' }, { status: 404 });

  await prisma.subjectAllocation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
