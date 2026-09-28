import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';

/** POST /api/notifications/[id]/read — mark one of the user's own notifications as read. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('notifications.view');
  if (auth.error) return auth.error;
  const { user } = auth;

  const { id } = await params;
  const row = await prisma.notificationLog.findUnique({
    where: { id },
    select: { id: true, userId: true, readAt: true },
  });
  if (!row) return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
  if (row.userId !== user.id) {
    return NextResponse.json({ error: 'You can only mark your own notifications as read' }, { status: 403 });
  }

  if (row.readAt === null) {
    await prisma.notificationLog.update({ where: { id }, data: { readAt: new Date() } });
  }
  return NextResponse.json({ ok: true });
}
