import { NextResponse } from 'next/server';
import { MaterialType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { apiUser, schoolIdOr400 } from '@/lib/api-auth';
import { childStudentIds } from '@/lib/parents';

/**
 * GET /api/materials?subjectId=&gradeId=&type=&q= — study materials, scoped:
 * student → own grade, own section or grade-wide materials; parent → union of
 * children's grades (same section rule per child); teacher/staff/principal/
 * super-admin → all materials.
 *
 * POST /api/materials — upload a link-based material. materials.manage;
 * teachers may only upload for subjects they teach (SubjectAllocation or
 * TimetableSlot). No file storage in Phase 2 — fileUrl must be an http(s) link.
 */

const TYPES = Object.values(MaterialType);
const URL_RE = /^https?:\/\//;

/** Role scoping for the materials list. 'ALL' = no restriction, null = no access. */
async function scopeClause(
  userId: string,
  role: string,
): Promise<'ALL' | Record<string, unknown> | null> {
  if (role === 'SUPER_ADMIN' || role === 'PRINCIPAL' || role === 'STAFF' || role === 'TEACHER') return 'ALL';
  if (role === 'STUDENT') {
    const student = await prisma.student.findUnique({
      where: { userId },
      select: { gradeId: true, sectionId: true },
    });
    if (!student) return null;
    return {
      gradeId: student.gradeId,
      OR: [{ sectionId: null }, { sectionId: student.sectionId }],
    };
  }
  if (role === 'PARENT') {
    const kids = await childStudentIds(userId);
    if (kids.length === 0) return null;
    const students = await prisma.student.findMany({
      where: { id: { in: kids } },
      select: { gradeId: true, sectionId: true },
    });
    if (students.length === 0) return null;
    return {
      OR: students.map((s) => ({
        gradeId: s.gradeId,
        OR: [{ sectionId: null }, { sectionId: s.sectionId }],
      })),
    };
  }
  return null;
}

function shape(m: {
  id: string;
  title: string;
  description: string | null;
  type: MaterialType;
  fileUrl: string | null;
  createdAt: Date;
  teacherId: string;
  subject: { id: string; name: string; code: string };
  grade: { id: string; name: string } | null;
  section: { id: string; name: string } | null;
  teacher: { user: { name: string } | null };
}, myTeacherId: string | null) {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    type: m.type,
    fileUrl: m.fileUrl,
    createdAt: m.createdAt.toISOString(),
    subject: { id: m.subject.id, name: m.subject.name, code: m.subject.code },
    grade: m.grade ? { id: m.grade.id, name: m.grade.name } : null,
    section: m.section ? { id: m.section.id, name: m.section.name } : null,
    teacher: m.teacher.user?.name ?? 'Teacher',
    teacherId: m.teacherId,
    mine: myTeacherId !== null && myTeacherId === m.teacherId,
  };
}

export async function GET(req: Request) {
  const auth = await apiUser('materials.view');
  if (auth.error) return auth.error;
  const { user } = auth;

  const sch = await schoolIdOr400();
  if ('error' in sch) return sch.error;

  const params = new URL(req.url).searchParams;
  const subjectId = params.get('subjectId') || undefined;
  const gradeId = params.get('gradeId') || undefined;
  const type = params.get('type') || undefined;
  const q = params.get('q')?.trim() || undefined;

  if (type && !TYPES.includes(type as MaterialType)) {
    return NextResponse.json({ error: `type must be one of: ${TYPES.join(', ')}` }, { status: 400 });
  }

  const scope = await scopeClause(user.id, user.role);
  if (scope === null) return NextResponse.json({ materials: [] });

  const me = user.role === 'TEACHER'
    ? await prisma.teacher.findUnique({ where: { userId: user.id }, select: { id: true } })
    : null;

  // Compose every condition under AND so the role-scope OR never gets
  // overwritten by the search-text OR (object spread would merge the keys).
  const and: Record<string, unknown>[] = [];
  if (scope !== 'ALL') and.push(scope);
  if (subjectId) and.push({ subjectId });
  if (gradeId) and.push({ gradeId });
  if (type) and.push({ type: type as MaterialType });
  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
    });
  }

  const materials = await prisma.studyMaterial.findMany({
    where: {
      schoolId: sch.schoolId,
      ...(and.length > 0 ? { AND: and } : {}),
    },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      grade: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      teacher: { include: { user: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return NextResponse.json({
    materials: materials.map((m) => shape(m, me?.id ?? null)),
  });
}

export async function POST(req: Request) {
  const auth = await apiUser('materials.manage');
  if (auth.error) return auth.error;
  const { user } = auth;

  const sch = await schoolIdOr400();
  if ('error' in sch) return sch.error;
  const schoolId = sch.schoolId;

  const body = await req.json().catch(() => null);
  const title = String(body?.title ?? '').trim();
  const description = body?.description ? String(body.description).trim() : null;
  const type = String(body?.type ?? '').trim();
  const subjectId = String(body?.subjectId ?? '').trim();
  const gradeId = body?.gradeId ? String(body.gradeId).trim() : null;
  const sectionId = body?.sectionId ? String(body.sectionId).trim() : null;
  const fileUrl = body?.fileUrl ? String(body.fileUrl).trim() : null;

  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });
  if (title.length > 200) return NextResponse.json({ error: 'title must be 200 characters or fewer' }, { status: 400 });
  if (!TYPES.includes(type as MaterialType)) {
    return NextResponse.json({ error: `type must be one of: ${TYPES.join(', ')}` }, { status: 400 });
  }
  if (!subjectId) return NextResponse.json({ error: 'subjectId is required' }, { status: 400 });
  if (fileUrl && !URL_RE.test(fileUrl)) {
    return NextResponse.json({ error: 'fileUrl must be a valid http(s) link' }, { status: 400 });
  }

  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, schoolId },
    select: { id: true },
  });
  if (!subject) return NextResponse.json({ error: 'Subject not found' }, { status: 404 });

  if (gradeId) {
    const grade = await prisma.grade.findFirst({ where: { id: gradeId, schoolId }, select: { id: true } });
    if (!grade) return NextResponse.json({ error: 'Grade not found' }, { status: 404 });
  }

  if (sectionId) {
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      select: { id: true, grade: { select: { id: true, schoolId: true } } },
    });
    if (!section || section.grade.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }
    if (gradeId && section.grade.id !== gradeId) {
      return NextResponse.json({ error: 'Section does not belong to the selected grade' }, { status: 400 });
    }
  }

  // Attribute the upload to a teacher profile — never invent attribution.
  let teacherId: string;
  if (user.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!teacher) return NextResponse.json({ error: 'No teacher profile linked to your account' }, { status: 403 });
    // Teacher must teach the subject: allocation OR timetable slot.
    const [alloc, slot] = await Promise.all([
      prisma.subjectAllocation.findFirst({ where: { teacherId: teacher.id, subjectId }, select: { id: true } }),
      prisma.timetableSlot.findFirst({ where: { teacherId: teacher.id, subjectId }, select: { id: true } }),
    ]);
    if (!alloc && !slot) {
      return NextResponse.json({ error: 'Forbidden: you do not teach this subject' }, { status: 403 });
    }
    teacherId = teacher.id;
  } else {
    // Principal / super-admin: own teacher profile, or an explicit teacherId.
    const teacher = await prisma.teacher.findUnique({ where: { userId: user.id }, select: { id: true } });
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

  const created = await prisma.studyMaterial.create({
    data: {
      schoolId,
      subjectId,
      gradeId,
      sectionId,
      teacherId,
      title,
      description,
      type: type as MaterialType,
      fileUrl,
    },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      grade: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      teacher: { include: { user: { select: { name: true } } } },
    },
  });

  return NextResponse.json({ ok: true, material: shape(created, teacherId) }, { status: 201 });
}
