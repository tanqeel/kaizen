import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';

/**
 * DELETE /api/materials/[id] — delete a study material. materials.manage;
 * teachers may delete only their own uploads; principal/super-admin may
 * delete any material.
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('materials.manage');
  if (auth.error) return auth.error;
  const { user } = auth;

  const { id } = await ctx.params;

  const material = await prisma.studyMaterial.findUnique({
    where: { id },
    select: { id: true, teacher: { select: { userId: true } } },
  });
  if (!material) return NextResponse.json({ error: 'Material not found' }, { status: 404 });

  if (user.role === 'TEACHER' && material.teacher.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden: not your material' }, { status: 403 });
  }

  await prisma.studyMaterial.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
