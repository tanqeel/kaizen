import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiPermission } from '@/lib/api-guard';

/** DELETE /api/exams/terms/[id] — only when no schedules exist yet. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission('exams.manage');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const term = await prisma.examTerm.findUnique({
    where: { id },
    include: { _count: { select: { schedules: true } } },
  });
  if (!term) return NextResponse.json({ error: 'Exam term not found' }, { status: 404 });
  if (term._count.schedules > 0) {
    return NextResponse.json(
      { error: `Cannot delete "${term.name}": it has ${term._count.schedules} scheduled exam(s). Delete the schedules first.` },
      { status: 409 },
    );
  }

  await prisma.examTerm.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
