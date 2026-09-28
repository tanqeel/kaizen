import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiPermission } from '@/lib/api-guard';
import { teacherGradeIds } from '@/lib/exams';

/** GET /api/exams/schedules?termId= — schedules with subject/grade and result counts. */
export async function GET(req: Request) {
  const auth = await requireApiPermission('exams.view');
  if (auth instanceof NextResponse) return auth;

  const termId = new URL(req.url).searchParams.get('termId');
  const where = termId ? { examTermId: termId } : {};
  const schedules = await prisma.examSchedule.findMany({
    where,
    include: {
      subject: true,
      grade: true,
      examTerm: true,
      _count: { select: { results: true } },
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
  return NextResponse.json({
    schedules: schedules.map((s) => ({
      id: s.id,
      termId: s.examTermId,
      term: s.examTerm.name,
      subjectId: s.subjectId,
      subject: s.subject.name,
      gradeId: s.gradeId,
      grade: s.grade.name,
      date: s.date.toISOString(),
      startTime: s.startTime,
      totalMarks: s.totalMarks,
      resultCount: s._count.results,
      deletable: s._count.results === 0,
    })),
  });
}

/** POST /api/exams/schedules { examTermId, subjectId, gradeId, date, startTime, totalMarks } */
export async function POST(req: Request) {
  const auth = await requireApiPermission('exams.manage');
  if (auth instanceof NextResponse) return auth;

  let body: {
    examTermId?: string; subjectId?: string; gradeId?: string;
    date?: string; startTime?: string; totalMarks?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { examTermId, subjectId, gradeId } = body;
  const date = body.date ? new Date(body.date) : null;
  const startTime = body.startTime?.trim();
  const totalMarks = Number(body.totalMarks);
  if (!examTermId || !subjectId || !gradeId) {
    return NextResponse.json({ error: 'Term, subject and grade are required' }, { status: 400 });
  }
  if (!date || Number.isNaN(+date)) return NextResponse.json({ error: 'A valid exam date is required' }, { status: 400 });
  if (!startTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
    return NextResponse.json({ error: 'startTime must be HH:MM (24h)' }, { status: 400 });
  }
  if (!Number.isInteger(totalMarks) || totalMarks < 1 || totalMarks > 1000) {
    return NextResponse.json({ error: 'totalMarks must be between 1 and 1000' }, { status: 400 });
  }

  const [term, subject, grade] = await Promise.all([
    prisma.examTerm.findUnique({ where: { id: examTermId } }),
    prisma.subject.findUnique({ where: { id: subjectId } }),
    prisma.grade.findUnique({ where: { id: gradeId } }),
  ]);
  if (!term || !subject || !grade) {
    return NextResponse.json({ error: 'Term, subject or grade not found' }, { status: 404 });
  }

  // Teachers may only schedule exams for grades they teach.
  if (auth.role === 'TEACHER') {
    const own = await teacherGradeIds(auth.id);
    if (!own.includes(gradeId)) {
      return NextResponse.json({ error: 'Forbidden: you can only schedule exams for grades you teach' }, { status: 403 });
    }
  }

  const schedule = await prisma.examSchedule.create({
    data: { examTermId, subjectId, gradeId, date, startTime, totalMarks },
  });
  return NextResponse.json({ schedule }, { status: 201 });
}
