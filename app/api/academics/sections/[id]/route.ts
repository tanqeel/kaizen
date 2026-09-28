import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiPermission } from '@/lib/api-guard';

/** DELETE /api/academics/sections/[id] — only when it has no students/slots/attendance. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission('academics.manage');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const section = await prisma.section.findUnique({
    where: { id },
    include: {
      grade: true,
      _count: { select: { students: true, timetableSlots: true, periodAttendance: true } },
    },
  });
  if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 });

  const blockers: string[] = [];
  if (section._count.students > 0) blockers.push(`${section._count.students} student(s)`);
  if (section._count.timetableSlots > 0) blockers.push(`${section._count.timetableSlots} timetable slot(s)`);
  if (section._count.periodAttendance > 0) blockers.push(`${section._count.periodAttendance} attendance record(s)`);
  if (blockers.length > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete ${section.grade.name}-${section.name}: still has ${blockers.join(', ')}. Move or remove them first.`,
      },
      { status: 409 },
    );
  }

  await prisma.section.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
