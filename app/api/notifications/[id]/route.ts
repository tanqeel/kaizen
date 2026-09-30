import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';

/** DELETE /api/notifications/[id] — delete one of the user's own notifications. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('notifications.view');
  if (auth.error) return auth.error;
  const { user } = auth;

  const { id } = await params;
  const row = await prisma.notificationLog.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!row) return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
  if (row.userId !== user.id) {
    return NextResponse.json({ error: 'You can only delete your own notifications' }, { status: 403 });
  }

  await prisma.notificationLog.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
