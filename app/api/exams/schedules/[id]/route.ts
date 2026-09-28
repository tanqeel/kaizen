import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiPermission } from '@/lib/api-guard';

/** DELETE /api/exams/schedules/[id] — only when no results entered yet. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission('exams.manage');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const schedule = await prisma.examSchedule.findUnique({
    where: { id },
    include: { subject: true, _count: { select: { results: true } } },
  });
  if (!schedule) return NextResponse.json({ error: 'Exam schedule not found' }, { status: 404 });
  if (schedule._count.results > 0) {
    return NextResponse.json(
      { error: `Cannot delete the ${schedule.subject.name} paper: ${schedule._count.results} result(s) already entered.` },
      { status: 409 },
    );
  }

  await prisma.examSchedule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
