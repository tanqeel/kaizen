import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiPermission } from '@/lib/api-guard';
import { teacherGradeIds, parentChildIds, ownStudentId } from '@/lib/exams';
import { invalidateDashboard } from '@/lib/dashboard';
import { createManyCompat } from '@/lib/prisma-batch';

/**
 * Scope the student list of a schedule's grade to the viewer.
 * Returns { students } or { forbidden: message }.
 */
async function scopedStudentIds(
  userId: string,
  role: string,
  gradeId: string,
): Promise<{ ids: string[] | null; forbidden?: string }> {
  if (role === 'SUPER_ADMIN' || role === 'PRINCIPAL') return { ids: null }; // all
  if (role === 'PARENT') return { ids: await parentChildIds(userId) };
  if (role === 'STUDENT') {
    const self = await ownStudentId(userId);
    return { ids: self ? [self] : [] };
  }
  if (role === 'TEACHER') {
    const own = await teacherGradeIds(userId);
    if (!own.includes(gradeId)) return { ids: [], forbidden: 'You can only manage exams for grades you teach' };
    return { ids: null };
  }
  return { ids: [], forbidden: 'Forbidden' };
}

/**
 * GET /api/exams/results?scheduleId= — entry grid data: schedule + grade
 * students + existing results, all scoped to the viewer.
 */
export async function GET(req: Request) {
  const auth = await requireApiPermission('exams.view');
  if (auth instanceof NextResponse) return auth;

  const scheduleId = new URL(req.url).searchParams.get('scheduleId');
  if (!scheduleId) return NextResponse.json({ error: 'scheduleId is required' }, { status: 400 });

  const schedule = await prisma.examSchedule.findUnique({
    where: { id: scheduleId },
    include: { subject: true, grade: true, examTerm: true },
  });
  if (!schedule) return NextResponse.json({ error: 'Exam schedule not found' }, { status: 404 });

  const scope = await scopedStudentIds(auth.id, auth.role, schedule.gradeId);
  if (scope.forbidden) return NextResponse.json({ error: `Forbidden: ${scope.forbidden}` }, { status: 403 });

  const students = await prisma.student.findMany({
    where: {
      gradeId: schedule.gradeId,
      isActive: true,
      ...(scope.ids ? { id: { in: scope.ids } } : {}),
    },
    include: { section: true },
    orderBy: [{ section: { name: 'asc' } }, { name: 'asc' }],
  });
  const results = await prisma.examResult.findMany({ where: { examScheduleId: scheduleId } });

  return NextResponse.json({
    schedule: {
      id: schedule.id,
      subject: schedule.subject.name,
      grade: schedule.grade.name,
      term: schedule.examTerm.name,
      date: schedule.date.toISOString(),
      startTime: schedule.startTime,
      totalMarks: schedule.totalMarks,
    },
    students: students.map((s) => ({
      id: s.id,
      name: s.name,
      admissionNo: s.admissionNo,
      section: s.section.name,
    })),
    results: results.map((r) => ({ studentId: r.studentId, obtainedMarks: r.obtainedMarks, remarks: r.remarks })),
  });
}

interface ResultRow { studentId?: string; obtainedMarks?: unknown; remarks?: unknown }

/**
 * POST /api/exams/results { scheduleId, rows: [{ studentId, obtainedMarks, remarks? }] }
 * Bulk upsert. Every row is validated: student in the schedule's grade and
 * 0 ≤ obtainedMarks ≤ totalMarks. Never invents records — invalid rows are
 * rejected with per-row errors and nothing is saved.
 */
export async function POST(req: Request) {
  const auth = await requireApiPermission('exams.manage');
  if (auth instanceof NextResponse) return auth;

  let body: { scheduleId?: string; rows?: ResultRow[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { scheduleId } = body;
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!scheduleId) return NextResponse.json({ error: 'scheduleId is required' }, { status: 400 });
  if (rows.length === 0) return NextResponse.json({ error: 'No result rows provided' }, { status: 400 });

  const schedule = await prisma.examSchedule.findUnique({ where: { id: scheduleId } });
  if (!schedule) return NextResponse.json({ error: 'Exam schedule not found' }, { status: 404 });

  if (auth.role === 'TEACHER') {
    const own = await teacherGradeIds(auth.id);
    if (!own.includes(schedule.gradeId)) {
      return NextResponse.json({ error: 'Forbidden: you can only enter results for grades you teach' }, { status: 403 });
    }
  }

  const gradeStudents = await prisma.student.findMany({
    where: { gradeId: schedule.gradeId, isActive: true },
    select: { id: true, name: true },
  });
  const validIds = new Map(gradeStudents.map((s) => [s.id, s.name]));

  const errors: Array<{ studentId: string; error: string }> = [];
  const clean: Array<{ studentId: string; obtainedMarks: number; remarks: string | null }> = [];
  for (const row of rows) {
    const studentId = typeof row.studentId === 'string' ? row.studentId : '';
    const name = validIds.get(studentId);
    if (!name) {
      errors.push({ studentId, error: 'Student is not in this exam\u2019s grade' });
      continue;
    }
    const marks = Number(row.obtainedMarks);
    if (!Number.isInteger(marks) || marks < 0 || marks > schedule.totalMarks) {
      errors.push({
        studentId,
        error: `${name}: marks must be a whole number between 0 and ${schedule.totalMarks}`,
      });
      continue;
    }
    const remarks = typeof row.remarks === 'string' && row.remarks.trim() ? row.remarks.trim().slice(0, 200) : null;
    clean.push({ studentId, obtainedMarks: marks, remarks });
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: 'Some rows failed validation — nothing was saved', errors }, { status: 400 });
  }

  // Neon HTTP adapter does not support $transaction — upserts are idempotent
  // (same unique key), so chunked sequential writes are safely retryable.
  await createManyCompat(
    (r) =>
      prisma.examResult.upsert({
        where: { examScheduleId_studentId: { examScheduleId: scheduleId, studentId: r.studentId } },
        update: { obtainedMarks: r.obtainedMarks, remarks: r.remarks },
        create: {
          examScheduleId: scheduleId,
          studentId: r.studentId,
          obtainedMarks: r.obtainedMarks,
          remarks: r.remarks,
        },
      }),
    clean,
  );
  invalidateDashboard();
  return NextResponse.json({ ok: true, saved: clean.length });
}
