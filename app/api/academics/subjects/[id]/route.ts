import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiPermission } from '@/lib/api-guard';

/** DELETE /api/academics/subjects/[id] — only when nothing references it. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission('academics.manage');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const subject = await prisma.subject.findUnique({
    where: { id },
    include: {
      _count: { select: { allocations: true, timetableSlots: true, examSchedules: true, periodAttendance: true } },
    },
  });
  if (!subject) return NextResponse.json({ error: 'Subject not found' }, { status: 404 });

  const blockers: string[] = [];
  if (subject._count.allocations > 0) blockers.push(`${subject._count.allocations} subject allocation(s)`);
  if (subject._count.timetableSlots > 0) blockers.push(`${subject._count.timetableSlots} timetable slot(s)`);
  if (subject._count.examSchedules > 0) blockers.push(`${subject._count.examSchedules} exam schedule(s)`);
  if (subject._count.periodAttendance > 0) blockers.push(`${subject._count.periodAttendance} attendance record(s)`);
  if (blockers.length > 0) {
    return NextResponse.json(
      { error: `Cannot delete "${subject.name}": still referenced by ${blockers.join(', ')}.` },
      { status: 409 },
    );
  }

  await prisma.subject.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
