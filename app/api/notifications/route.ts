import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';

/**
 * GET /api/notifications — the current user's IN_APP inbox, newest first.
 * ?count=1 — cheap unread count only ({ unreadCount }).
 */
export async function GET(req: Request) {
  const auth = await apiUser('notifications.view');
  if (auth.error) return auth.error;
  const { user } = auth;

  const unreadWhere = { userId: user.id, channel: 'IN_APP' as const, readAt: null };

  const url = new URL(req.url);
  if (url.searchParams.get('count') === '1') {
    const unreadCount = await prisma.notificationLog.count({ where: unreadWhere });
    return NextResponse.json({ unreadCount });
  }

  const notifications = await prisma.notificationLog.findMany({
    where: { userId: user.id, channel: 'IN_APP' },
    select: { id: true, type: true, message: true, sentAt: true, readAt: true },
    orderBy: { sentAt: 'desc' },
    take: 100,
  });
  const unreadCount = notifications.filter((n) => n.readAt === null).length;

  return NextResponse.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      message: n.message,
      sentAt: n.sentAt.toISOString(),
      readAt: n.readAt ? n.readAt.toISOString() : null,
    })),
    unreadCount,
  });
}
