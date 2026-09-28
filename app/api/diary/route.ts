import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';
import { childStudentIds } from '@/lib/parents';
import { todayPKT } from '@/lib/format';

/**
 * GET /api/diary?sectionId=&date=&from=&to= — class diary entries, scoped:
 * parent → own children's sections, student → own section,
 * teacher → sections they teach (or class-teach), staff → all read-only,
 * principal/super-admin → all.
 *
 * POST /api/diary — create/update one entry (upsert per section+subject+date).
 * diary.manage; teachers may only write for sections they teach or class-teach.
 *
 * DELETE /api/diary?id= — diary.manage; teachers may delete only their own entries.
 */

async function teacherSectionIds(userId: string): Promise<string[] | null> {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    include: {
      timetableSlots: { select: { sectionId: true } },
      classSections: { select: { id: true } },
    },
  });
  if (!teacher) return null;
  const ids = new Set<string>();
  for (const s of teacher.timetableSlots) ids.add(s.sectionId);
  for (const s of teacher.classSections) ids.add(s.id);
  return [...ids];
}

async function readableSectionIds(userId: string, role: string): Promise<string[] | 'ALL'> {
  if (role === 'SUPER_ADMIN' || role === 'PRINCIPAL' || role === 'STAFF') return 'ALL';
  if (role === 'PARENT') {
    const kids = await childStudentIds(userId);
    if (kids.length === 0) return [];
    const students = await prisma.student.findMany({
      where: { id: { in: kids } },
      select: { sectionId: true },
    });
    return [...new Set(students.map((s) => s.sectionId))];
  }
  if (role === 'STUDENT') {
    const student = await prisma.student.findUnique({ where: { userId }, select: { sectionId: true } });
    return student ? [student.sectionId] : [];
  }
  if (role === 'TEACHER') {
    return (await teacherSectionIds(userId)) ?? [];
  }
  return [];
}

export async function GET(req: Request) {
  const auth = await apiUser('diary.view');
  if (auth.error) return auth.error;
  const { user } = auth;

  const params = new URL(req.url).searchParams;
  const sectionId = params.get('sectionId');
  const date = params.get('date');
  const from = params.get('from');
  const to = params.get('to');

  const allowed = await readableSectionIds(user.id, user.role);
  if (allowed !== 'ALL') {
    if (allowed.length === 0) return NextResponse.json({ entries: [] });
    if (sectionId && !allowed.includes(sectionId)) {
      return NextResponse.json({ error: 'Forbidden: not your section' }, { status: 403 });
    }
  }

  const entries = await prisma.diaryEntry.findMany({
    where: {
      ...(sectionId ? { sectionId } : allowed === 'ALL' ? {} : { sectionId: { in: allowed } }),
      ...(date ? { date } : {}),
      ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    },
    include: {
      subject: { select: { name: true, code: true } },
      teacher: { include: { user: { select: { name: true } } } },
      section: { include: { grade: { select: { name: true } } } },
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 200,
  });

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      date: e.date,
      sectionId: e.sectionId,
      section: `${e.section.grade.name} · ${e.section.name}`,
      subject: e.subject ? `${e.subject.name} (${e.subject.code})` : null,
      subjectId: e.subjectId,
      teacher: e.teacher.user?.name ?? 'Teacher',
      teacherId: e.teacherId,
      taughtToday: e.taughtToday,
      classwork: e.classwork,
      homework: e.homework,
      note: e.note,
      mine: e.teacher.userId === user.id,
    })),
  });
}

export async function POST(req: Request) {
  const auth = await apiUser('diary.manage');
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await req.json().catch(() => null);
  const sectionId = String(body?.sectionId ?? '').trim();
  const date = String(body?.date ?? todayPKT()).trim();
  const subjectId = body?.subjectId ? String(body.subjectId).trim() : null;
  const taughtToday = body?.taughtToday ? String(body.taughtToday).trim() : null;
  const classwork = body?.classwork ? String(body.classwork).trim() : null;
  const homework = body?.homework ? String(body.homework).trim() : null;
  const note = body?.note ? String(body.note).trim() : null;

  if (!sectionId) return NextResponse.json({ error: 'sectionId is required' }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
  if (!taughtToday && !classwork && !homework && !note) {
    return NextResponse.json({ error: 'Write at least one of: taught today, classwork, homework, note' }, { status: 400 });
  }

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: { id: true, grade: { select: { schoolId: true } } },
  });
  if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 });

  // Teachers may only write for their own classes; principal/super-admin anywhere.
  let teacherId: string | null = null;
  if (user.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: user.id },
      include: {
        timetableSlots: { select: { sectionId: true } },
        classSections: { select: { id: true } },
      },
    });
    if (!teacher) return NextResponse.json({ error: 'No teacher profile linked' }, { status: 403 });
    const mine = new Set([
      ...teacher.timetableSlots.map((s) => s.sectionId),
      ...teacher.classSections.map((s) => s.id),
    ]);
    if (!mine.has(sectionId)) {
      return NextResponse.json({ error: 'Forbidden: you do not teach this section' }, { status: 403 });
    }
    teacherId = teacher.id;
  } else {
    // Principal/super-admin writing on behalf: attribute to their teacher profile if any.
    const teacher = await prisma.teacher.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (teacher) {
      teacherId = teacher.id;
    } else {
      // No teacher profile — attribute to the first active teacher as office note? No:
      // never invent attribution. Require a teacherId instead.
      if (!body?.teacherId) {
        return NextResponse.json({ error: 'teacherId is required (no teacher profile linked to your account)' }, { status: 400 });
      }
      const t = await prisma.teacher.findUnique({ where: { id: String(body.teacherId) }, select: { id: true } });
      if (!t) return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
      teacherId = t.id;
    }
  }

  if (subjectId) {
    const subj = await prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true } });
    if (!subj) return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
  }

  // One entry per section+subject+date. findFirst + create/update (not upsert):
  // the unique key contains nullable subjectId, which upsert cannot match in Postgres.
  const existing = await prisma.diaryEntry.findFirst({
    where: { sectionId, date, subjectId },
    select: { id: true },
  });
  const entryData = {
    taughtToday, classwork, homework, note, teacherId,
  };
  const entry = existing
    ? await prisma.diaryEntry.update({ where: { id: existing.id }, data: entryData })
    : await prisma.diaryEntry.create({
        data: {
          schoolId: section.grade.schoolId,
          date,
          sectionId,
          subjectId,
          teacherId,
          taughtToday,
          classwork,
          homework,
          note,
        },
      });

  return NextResponse.json({ ok: true, id: entry.id });
}

export async function DELETE(req: Request) {
  const auth = await apiUser('diary.manage');
  if (auth.error) return auth.error;
  const { user } = auth;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const entry = await prisma.diaryEntry.findUnique({
    where: { id },
    include: { teacher: { select: { userId: true } } },
  });
  if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

  // Teachers may delete only their own entries; principal/super-admin may delete any.
  if (user.role === 'TEACHER' && entry.teacher.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden: not your entry' }, { status: 403 });
  }

  await prisma.diaryEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
