import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';

/** POST /api/notifications/read-all — mark all of the user's own notifications as read. */
export async function POST() {
  const auth = await apiUser('notifications.view');
  if (auth.error) return auth.error;
  const { user } = auth;

  const result = await prisma.notificationLog.updateMany({
    where: { userId: user.id, channel: 'IN_APP', readAt: null },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true, marked: result.count });
}
