import { NextResponse } from 'next/server';
import { AnnouncementAudience, type Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { apiUser, schoolIdOr400 } from '@/lib/api-auth';
import { childStudentIds } from '@/lib/parents';

/**
 * GET /api/events?scope=upcoming|past|all — school events, audience-scoped:
 * SUPER_ADMIN/PRINCIPAL → all; STAFF → ALL+STAFF; TEACHER → ALL+TEACHERS;
 * PARENT → ALL+PARENTS plus GRADES events matching their children's grades;
 * STUDENT → ALL plus GRADES events matching their own grade.
 * scope: upcoming (date >= now, ascending; default), past (date < now, descending),
 * all (descending).
 *
 * POST /api/events — create a school event. events.manage
 * (SUPER_ADMIN/PRINCIPAL/STAFF). gradeId is required when audience is GRADES.
 */

const AUDIENCES = Object.values(AnnouncementAudience);

/** Role-based audience filter. Empty object = no restriction. */
async function audienceClause(userId: string, role: string): Promise<Prisma.SchoolEventWhereInput> {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'PRINCIPAL':
      return {};
    case 'STAFF':
      return { audience: { in: [AnnouncementAudience.ALL, AnnouncementAudience.STAFF] } };
    case 'TEACHER':
      return { audience: { in: [AnnouncementAudience.ALL, AnnouncementAudience.TEACHERS] } };
    case 'STUDENT': {
      const student = await prisma.student.findUnique({ where: { userId }, select: { gradeId: true } });
      const ors: Prisma.SchoolEventWhereInput[] = [{ audience: AnnouncementAudience.ALL }];
      if (student) ors.push({ audience: AnnouncementAudience.GRADES, gradeId: student.gradeId });
      return { OR: ors };
    }
    case 'PARENT': {
      const kids = await childStudentIds(userId);
      const ors: Prisma.SchoolEventWhereInput[] = [
        { audience: { in: [AnnouncementAudience.ALL, AnnouncementAudience.PARENTS] } },
      ];
      if (kids.length > 0) {
        const students = await prisma.student.findMany({
          where: { id: { in: kids } },
          select: { gradeId: true },
        });
        const gradeIds = [...new Set(students.map((s) => s.gradeId))];
        if (gradeIds.length > 0) {
          ors.push({ audience: AnnouncementAudience.GRADES, gradeId: { in: gradeIds } });
        }
      }
      return { OR: ors };
    }
    default:
      return { audience: AnnouncementAudience.ALL };
  }
}

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  date: Date;
  endDate: Date | null;
  audience: AnnouncementAudience;
  venue: string | null;
  createdAt: Date;
  grade: { id: string; name: string } | null;
  createdBy: { name: string };
};

function shape(e: EventRow) {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    date: e.date.toISOString(),
    endDate: e.endDate ? e.endDate.toISOString() : null,
    audience: e.audience,
    venue: e.venue,
    createdBy: e.createdBy.name,
    createdAt: e.createdAt.toISOString(),
    grade: e.grade ? { id: e.grade.id, name: e.grade.name } : null,
  };
}

export async function GET(req: Request) {
  const auth = await apiUser('events.view');
  if (auth.error) return auth.error;
  const { user } = auth;

  const sch = await schoolIdOr400();
  if ('error' in sch) return sch.error;

  const params = new URL(req.url).searchParams;
  const scope = params.get('scope') ?? 'upcoming';
  if (!['upcoming', 'past', 'all'].includes(scope)) {
    return NextResponse.json({ error: 'scope must be upcoming, past, or all' }, { status: 400 });
  }

  const clause = await audienceClause(user.id, user.role);

  const now = new Date();
  const and: Prisma.SchoolEventWhereInput[] = [{ schoolId: sch.schoolId }];
  if (Object.keys(clause).length > 0) and.push(clause);
  if (scope === 'upcoming') and.push({ date: { gte: now } });
  else if (scope === 'past') and.push({ date: { lt: now } });

  const events = await prisma.schoolEvent.findMany({
    where: { AND: and },
    include: {
      grade: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { date: scope === 'upcoming' ? 'asc' : 'desc' },
    take: 200,
  });

  return NextResponse.json({ events: events.map(shape) });
}

export async function POST(req: Request) {
  const auth = await apiUser('events.manage');
  if (auth.error) return auth.error;
  const { user } = auth;

  const sch = await schoolIdOr400();
  if ('error' in sch) return sch.error;

  const body = await req.json().catch(() => null);
  const title = String(body?.title ?? '').trim();
  const description = body?.description ? String(body.description).trim() : null;
  const venue = body?.venue ? String(body.venue).trim() : null;
  const audience = String(body?.audience ?? '').trim();
  const gradeId = body?.gradeId ? String(body.gradeId).trim() : null;

  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });
  if (title.length > 200) return NextResponse.json({ error: 'title must be 200 characters or fewer' }, { status: 400 });
  if (!AUDIENCES.includes(audience as AnnouncementAudience)) {
    return NextResponse.json({ error: `audience must be one of: ${AUDIENCES.join(', ')}` }, { status: 400 });
  }

  const date = new Date(String(body?.date ?? ''));
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: 'date must be a valid ISO date-time' }, { status: 400 });
  }

  let endDate: Date | null = null;
  if (body?.endDate) {
    endDate = new Date(String(body.endDate));
    if (isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'endDate must be a valid ISO date-time' }, { status: 400 });
    }
    if (endDate < date) {
      return NextResponse.json({ error: 'endDate cannot be before date' }, { status: 400 });
    }
  }

  if (description && description.length > 2000) {
    return NextResponse.json({ error: 'description must be 2000 characters or fewer' }, { status: 400 });
  }
  if (venue && venue.length > 200) {
    return NextResponse.json({ error: 'venue must be 200 characters or fewer' }, { status: 400 });
  }

  if (audience === AnnouncementAudience.GRADES) {
    if (!gradeId) {
      return NextResponse.json({ error: 'gradeId is required when audience is GRADES' }, { status: 400 });
    }
    const grade = await prisma.grade.findFirst({
      where: { id: gradeId, schoolId: sch.schoolId },
      select: { id: true },
    });
    if (!grade) return NextResponse.json({ error: 'Grade not found' }, { status: 404 });
  } else if (gradeId) {
    return NextResponse.json({ error: 'gradeId is only used when audience is GRADES' }, { status: 400 });
  }

  const created = await prisma.schoolEvent.create({
    data: {
      schoolId: sch.schoolId,
      title,
      description,
      date,
      endDate,
      audience: audience as AnnouncementAudience,
      gradeId: audience === AnnouncementAudience.GRADES ? gradeId : null,
      venue,
      createdById: user.id,
    },
    include: {
      grade: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
    },
  });

  return NextResponse.json({ ok: true, event: shape(created) }, { status: 201 });
}
