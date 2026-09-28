import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';

/** DELETE /api/comms/announcements/[id] — removes an announcement. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('comms.manage');
  if (auth.error) return auth.error;

  const { id } = await params;
  const announcement = await prisma.announcement.findUnique({ where: { id }, select: { id: true } });
  if (!announcement) return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });

  await prisma.announcement.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
