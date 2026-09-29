import { NextResponse } from 'next/server';
import { NotificationChannel, NotificationStatus, NotificationType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { apiUserStrict as apiUser } from '@/lib/api-auth';

const TYPES = new Set(Object.values(NotificationType));
const CHANNELS = new Set(Object.values(NotificationChannel));
const STATUSES = new Set(Object.values(NotificationStatus));

/**
 * GET /api/comms/notifications?type&channel&status
 * The notification log: every SENT/FAILED notification — announcements,
 * arrival/departure/absence alerts written by other modules — newest first.
 */
export async function GET(req: Request) {
  const auth = await apiUser('comms.manage');
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const type = url.searchParams.get('type');
  const channel = url.searchParams.get('channel');
  const status = url.searchParams.get('status');

  if (type && !TYPES.has(type as NotificationType)) {
    return NextResponse.json({ error: 'Invalid type filter' }, { status: 400 });
  }
  if (channel && !CHANNELS.has(channel as NotificationChannel)) {
    return NextResponse.json({ error: 'Invalid channel filter' }, { status: 400 });
  }
  if (status && !STATUSES.has(status as NotificationStatus)) {
    return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
  }

  const rows = await prisma.notificationLog.findMany({
    where: {
      ...(type ? { type: type as NotificationType } : {}),
      ...(channel ? { channel: channel as NotificationChannel } : {}),
      ...(status ? { status: status as NotificationStatus } : {}),
    },
    include: {
      user: { select: { name: true } },
      student: { select: { name: true } },
    },
    orderBy: { sentAt: 'desc' },
    take: 300,
  });

  return NextResponse.json({
    notifications: rows.map((n) => ({
      id: n.id,
      type: n.type,
      channel: n.channel,
      status: n.status,
      message: n.message,
      sentAt: n.sentAt.toISOString(),
      user: n.user?.name ?? null,
      student: n.student?.name ?? null,
    })),
  });
}
