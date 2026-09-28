import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';

/**
 * DELETE /api/events/[id] — delete a school event. events.manage
 * (SUPER_ADMIN/PRINCIPAL/STAFF). Staff may delete only events they created;
 * principal and super-admin may delete any event.
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('events.manage');
  if (auth.error) return auth.error;
  const { user } = auth;

  const { id } = await ctx.params;

  const event = await prisma.schoolEvent.findUnique({
    where: { id },
    select: { id: true, createdById: true },
  });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  if (user.role !== 'SUPER_ADMIN' && user.role !== 'PRINCIPAL' && event.createdById !== user.id) {
    return NextResponse.json({ error: 'Forbidden: not your event' }, { status: 403 });
  }

  await prisma.schoolEvent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
