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

/**
 * PATCH /api/comms/announcements/[id] — edit title/body/priority/audience.
 * comms.manage only.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('comms.manage');
  if (auth.error) return auth.error;

  const { id } = await params;
  const announcement = await prisma.announcement.findUnique({ where: { id }, select: { id: true } });
  if (!announcement) return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });

  let body: { title?: string; body?: string; priority?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const data: { title?: string; body?: string; priority?: 'NORMAL' | 'URGENT' } = {};
  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim().slice(0, 200);
  if (typeof body.body === 'string' && body.body.trim()) data.body = body.body.trim().slice(0, 4000);
  if (body.priority === 'NORMAL' || body.priority === 'URGENT') data.priority = body.priority;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const updated = await prisma.announcement.update({ where: { id }, data });
  return NextResponse.json({ announcement: { id: updated.id, title: updated.title } });
}
