import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUserStrict as apiUser, schoolIdOr400 } from '@/lib/api-auth';
import { ANNOUNCEMENT_AUDIENCES, resolveRecipients } from '@/lib/comms';
import type { AnnouncementAudience, AnnouncementPriority } from '@prisma/client';

const PRIORITIES: AnnouncementPriority[] = ['NORMAL', 'URGENT'];

/** GET /api/comms/announcements — newest first, with author name + grade. */
export async function GET() {
  const auth = await apiUser('comms.manage');
  if (auth.error) return auth.error;
  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  const announcements = await prisma.announcement.findMany({
    where: { schoolId: sres.schoolId },
    include: {
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return NextResponse.json({
    announcements: announcements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      priority: a.priority,
      audience: a.audience,
      gradeId: a.gradeId,
      createdBy: a.createdBy.name,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}

/**
 * POST /api/comms/announcements { title, body, priority, audience, gradeId? }
 * Creates the announcement AND writes one IN_APP / SENT NotificationLog row
 * per resolved recipient (message = the announcement title).
 */
export async function POST(req: Request) {
  const auth = await apiUser('comms.manage');
  if (auth.error) return auth.error;
  const { user } = auth;
  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  let body: { title?: string; body?: string; priority?: string; audience?: string; gradeId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const title = body.title?.trim();
  const text = body.body?.trim();
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });
  if (!text) return NextResponse.json({ error: 'body is required' }, { status: 400 });
  if (!PRIORITIES.includes(body.priority as AnnouncementPriority)) {
    return NextResponse.json({ error: 'priority must be NORMAL or URGENT' }, { status: 400 });
  }
  if (!ANNOUNCEMENT_AUDIENCES.includes(body.audience as AnnouncementAudience)) {
    return NextResponse.json({ error: 'Invalid audience' }, { status: 400 });
  }
  const audience = body.audience as AnnouncementAudience;
  if (audience === 'GRADES' && !body.gradeId) {
    return NextResponse.json({ error: 'gradeId is required for the GRADES audience' }, { status: 400 });
  }

  const announcement = await prisma.announcement.create({
    data: {
      schoolId: sres.schoolId,
      title: title.slice(0, 200),
      body: text.slice(0, 4000),
      priority: body.priority as AnnouncementPriority,
      audience,
      gradeId: audience === 'GRADES' ? body.gradeId! : null,
      createdById: user.id,
    },
  });

  const recipients = await resolveRecipients(audience, body.gradeId ?? null);
  if (recipients.length > 0) {
    await prisma.notificationLog.createMany({
      data: recipients.map((r) => ({
        userId: r.userId,
        studentId: r.studentId,
        type: 'ANNOUNCEMENT' as const,
        channel: 'IN_APP' as const,
        message: announcement.title,
        status: 'SENT' as const,
      })),
    });
  }

  return NextResponse.json({ ok: true, id: announcement.id, notified: recipients.length }, { status: 201 });
}
