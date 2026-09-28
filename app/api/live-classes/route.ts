import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser, schoolIdOr400 } from '@/lib/api-auth';
import { childStudentIds } from '@/lib/parents';

/**
 * GET /api/live-classes?scope=upcoming|past&sectionId= — live classes, scoped:
 * student → own section; parent → children's sections; teacher → classes they host;
 * principal / super-admin / staff → all (optional ?sectionId= filter).
 * scope=upcoming (default): endsAt >= now, asc. scope=past: started in the last
 * 14 days, desc.
 *
 * POST /api/live-classes — schedule a live class (liveclasses.manage).
 * Teachers may only schedule for sections they teach (timetable slot or
 * class-teacher) and subjects they teach (allocation or timetable slot);
 * the class is attributed to their own teacher profile. Principals /
 * super-admins may schedule for any section, attributed to their own teacher
 * profile when one exists, else an explicit teacherId is required.
 */

const URL_RE = /^https?:\/\//;

/** Role scoping for the live-class list. null = no visible scope (→ empty list). */
async function scopeWhere(
  userId: string,
  role: string,
  sectionFilter?: string,
): Promise<Record<string, unknown> | null> {
  if (role === 'SUPER_ADMIN' || role === 'PRINCIPAL' || role === 'STAFF') {
    return sectionFilter ? { sectionId: sectionFilter } : {};
  }
  if (role === 'STUDENT') {
    const student = await prisma.student.findUnique({
      where: { userId },
      select: { sectionId: true },
    });
    if (!student) return null;
    return { sectionId: student.sectionId };
  }
  if (role === 'PARENT') {
    const kids = await childStudentIds(userId);
    if (kids.length === 0) return null;
    const students = await prisma.student.findMany({
      where: { id: { in: kids }, isActive: true },
      select: { sectionId: true },
    });
    const sectionIds = [...new Set(students.map((s) => s.sectionId))];
    if (sectionIds.length === 0) return null;
    return { sectionId: { in: sectionIds } };
  }
  if (role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!teacher) return null;
    return { teacherId: teacher.id };
  }
  return null;
}

function shape(lc: {
  id: string;
  title: string;
  meetingUrl: string;
  startsAt: Date;
  endsAt: Date;
  teacherId: string;
  subject: { id: string; name: string; code: string } | null;
  section: { id: string; name: string; grade: { name: string } };
  teacher: { user: { name: string } | null };
}, myTeacherId: string | null) {
  return {
    id: lc.id,
    title: lc.title,
    meetingUrl: lc.meetingUrl,
    startsAt: lc.startsAt.toISOString(),
    endsAt: lc.endsAt.toISOString(),
    subject: lc.subject
      ? { id: lc.subject.id, name: lc.subject.name, code: lc.subject.code }
      : null,
    section: { id: lc.section.id, name: lc.section.name, grade: lc.section.grade.name },
    teacher: lc.teacher.user?.name ?? 'Teacher',
    teacherId: lc.teacherId,
    mine: myTeacherId !== null && myTeacherId === lc.teacherId,
  };
}

const INCLUDE = {
  subject: { select: { id: true, name: true, code: true } },
  section: { select: { id: true, name: true, grade: { select: { name: true } } } },
  teacher: { include: { user: { select: { name: true } } } },
};

export async function GET(req: Request) {
  const auth = await apiUser('liveclasses.view');
  if (auth.error) return auth.error;
  const { user } = auth;

  const sch = await schoolIdOr400();
  if ('error' in sch) return sch.error;

  const params = new URL(req.url).searchParams;
  const scope = params.get('scope') === 'past' ? 'past' : 'upcoming';
  const sectionId = params.get('sectionId') || undefined;

  const roleScope = await scopeWhere(user.id, user.role, sectionId);
  if (roleScope === null) return NextResponse.json({ liveClasses: [] });

  const now = new Date();
  const timeWhere =
    scope === 'past'
      ? { startsAt: { gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000), lt: now } }
      : { endsAt: { gte: now } };

  const me = user.role === 'TEACHER'
    ? await prisma.teacher.findUnique({ where: { userId: user.id }, select: { id: true } })
    : null;

  const liveClasses = await prisma.liveClass.findMany({
    where: { schoolId: sch.schoolId, ...timeWhere, ...roleScope },
    include: INCLUDE,
    orderBy: { startsAt: scope === 'past' ? 'desc' : 'asc' },
    take: 100,
  });

  return NextResponse.json({
    liveClasses: liveClasses.map((lc) => shape(lc, me?.id ?? null)),
  });
}

export async function POST(req: Request) {
  const auth = await apiUser('liveclasses.manage');
  if (auth.error) return auth.error;
  const { user } = auth;

  const sch = await schoolIdOr400();
  if ('error' in sch) return sch.error;
  const schoolId = sch.schoolId;

  const body = await req.json().catch(() => null);
  const title = String(body?.title ?? '').trim();
  const sectionId = String(body?.sectionId ?? '').trim();
  const subjectId = body?.subjectId ? String(body.subjectId).trim() : null;
  const meetingUrl = String(body?.meetingUrl ?? '').trim();
  const startsAt = body?.startsAt ? new Date(String(body.startsAt)) : new Date(NaN);
  const endsAt = body?.endsAt ? new Date(String(body.endsAt)) : new Date(NaN);

  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });
  if (title.length > 200) {
    return NextResponse.json({ error: 'title must be 200 characters or fewer' }, { status: 400 });
  }
  if (!sectionId) return NextResponse.json({ error: 'sectionId is required' }, { status: 400 });
  if (!URL_RE.test(meetingUrl)) {
    return NextResponse.json({ error: 'meetingUrl must be a valid http(s) link' }, { status: 400 });
  }
  if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
    return NextResponse.json({ error: 'startsAt and endsAt must be valid dates' }, { status: 400 });
  }
  if (endsAt <= startsAt) {
    return NextResponse.json({ error: 'endsAt must be after startsAt' }, { status: 400 });
  }

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: { id: true, grade: { select: { id: true, schoolId: true } } },
  });
  if (!section || section.grade.schoolId !== schoolId) {
    return NextResponse.json({ error: 'Section not found' }, { status: 404 });
  }

  if (subjectId) {
    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, schoolId },
      select: { id: true },
    });
    if (!subject) return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
  }

  // Attribute the class to a teacher profile — never invent attribution.
  let teacherId: string;
  if (user.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        timetableSlots: { select: { sectionId: true, subjectId: true } },
        classSections: { select: { id: true } },
        allocations: { select: { subjectId: true } },
      },
    });
    if (!teacher) {
      return NextResponse.json({ error: 'No teacher profile linked to your account' }, { status: 403 });
    }
    // Section must be one the teacher teaches: timetable slot or class-teacher.
    const taughtSectionIds = new Set<string>([
      ...teacher.timetableSlots.map((s) => s.sectionId),
      ...teacher.classSections.map((s) => s.id),
    ]);
    if (!taughtSectionIds.has(sectionId)) {
      return NextResponse.json({ error: 'Forbidden: you do not teach this section' }, { status: 403 });
    }
    if (subjectId) {
      const taughtSubjectIds = new Set<string>([
        ...teacher.allocations.map((a) => a.subjectId),
        ...teacher.timetableSlots.map((s) => s.subjectId),
      ]);
      if (!taughtSubjectIds.has(subjectId)) {
        return NextResponse.json({ error: 'Forbidden: you do not teach this subject' }, { status: 403 });
      }
    }
    teacherId = teacher.id;
  } else {
    // Principal / super-admin: any section; own teacher profile, or explicit teacherId.
    const teacher = await prisma.teacher.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (teacher) {
      teacherId = teacher.id;
    } else {
      const explicit = body?.teacherId ? String(body.teacherId).trim() : '';
      if (!explicit) {
        return NextResponse.json(
          { error: 'teacherId is required (no teacher profile linked to your account)' },
          { status: 400 },
        );
      }
      const t = await prisma.teacher.findUnique({ where: { id: explicit }, select: { id: true } });
      if (!t) return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
      teacherId = t.id;
    }
  }

  const created = await prisma.liveClass.create({
    data: {
      schoolId,
      sectionId,
      subjectId,
      teacherId,
      title,
      meetingUrl,
      startsAt,
      endsAt,
    },
    include: INCLUDE,
  });

  return NextResponse.json({ ok: true, liveClass: shape(created, teacherId) }, { status: 201 });
}
