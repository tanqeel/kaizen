import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser, schoolIdOr400 } from '@/lib/api-auth';

/**
 * DELETE /api/live-classes/:id — cancel a live class (liveclasses.manage).
 * Teachers may delete only their own classes; principals / super-admins may
 * delete any class.
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('liveclasses.manage');
  if (auth.error) return auth.error;
  const { user } = auth;

  const sch = await schoolIdOr400();
  if ('error' in sch) return sch.error;

  const { id } = await ctx.params;
  const lc = await prisma.liveClass.findFirst({
    where: { id, schoolId: sch.schoolId },
    select: { id: true, teacherId: true },
  });
  if (!lc) return NextResponse.json({ error: 'Live class not found' }, { status: 404 });

  if (user.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!teacher || teacher.id !== lc.teacherId) {
      return NextResponse.json(
        { error: 'Forbidden: you can only delete your own live classes' },
        { status: 403 },
      );
    }
  }

  await prisma.liveClass.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
