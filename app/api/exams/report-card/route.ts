import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiPermission } from '@/lib/api-guard';
import { gradeBand, pctOf, remarkFor, teacherGradeIds, parentChildIds, ownStudentId } from '@/lib/exams';

/**
 * GET /api/exams/report-card?studentId=&termId= — report card for one student
 * in one term. Scoped: parent → own children, student → self, teacher → own
 * grades, admin/principal → all. Only real entered results are shown; subjects
 * with no results are listed as "Not entered" — never invented.
 */
export async function GET(req: Request) {
  const auth = await requireApiPermission('exams.view');
  if (auth instanceof NextResponse) return auth;

  const params = new URL(req.url).searchParams;
  const studentId = params.get('studentId');
  const termId = params.get('termId');
  if (!studentId || !termId) {
    return NextResponse.json({ error: 'studentId and termId are required' }, { status: 400 });
  }

  const [student, term] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId }, include: { grade: true, section: true } }),
    prisma.examTerm.findUnique({ where: { id: termId }, include: { session: true } }),
  ]);
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  if (!term) return NextResponse.json({ error: 'Exam term not found' }, { status: 404 });

  // ── scoping ──
  if (auth.role === 'PARENT') {
    const kids = await parentChildIds(auth.id);
    if (!kids.includes(studentId)) return NextResponse.json({ error: 'Forbidden: not your child' }, { status: 403 });
  } else if (auth.role === 'STUDENT') {
    const self = await ownStudentId(auth.id);
    if (self !== studentId) return NextResponse.json({ error: 'Forbidden: not your record' }, { status: 403 });
  } else if (auth.role === 'TEACHER') {
    const own = await teacherGradeIds(auth.id);
    if (!own.includes(student.gradeId)) {
      return NextResponse.json({ error: 'Forbidden: not one of your grades' }, { status: 403 });
    }
  } else if (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PRINCIPAL') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const schedules = await prisma.examSchedule.findMany({
    where: { examTermId: termId, gradeId: student.gradeId },
    include: { subject: true },
    orderBy: { date: 'asc' },
  });
  const results = await prisma.examResult.findMany({
    where: { studentId, examSchedule: { examTermId: termId } },
  });
  const bySchedule = new Map(results.map((r) => [r.examScheduleId, r]));

  const rows = schedules.map((s) => {
    const r = bySchedule.get(s.id);
    const pct = r ? pctOf(r.obtainedMarks, s.totalMarks) : null;
    return {
      scheduleId: s.id,
      subject: s.subject.name,
      obtained: r?.obtainedMarks ?? null,
      total: s.totalMarks,
      pct,
      grade: pct === null ? null : gradeBand(pct),
      remarks: r?.remarks ?? (pct === null ? null : remarkFor(pct)),
    };
  });

  const entered = rows.filter((r) => r.obtained !== null);
  const totalObtained = entered.reduce((n, r) => n + (r.obtained ?? 0), 0);
  const totalMarks = entered.reduce((n, r) => n + r.total, 0);
  const overallPct = entered.length > 0 ? pctOf(totalObtained, totalMarks) : null;

  const school = await prisma.school.findFirst();

  return NextResponse.json({
    student: {
      id: student.id,
      name: student.name,
      admissionNo: student.admissionNo,
      grade: student.grade.name,
      section: student.section.name,
    },
    term: { id: term.id, name: term.name, session: term.session.name },
    school: school ? { name: school.name, address: school.address, phone: school.phone } : null,
    rows,
    enteredCount: entered.length,
    totalSubjects: rows.length,
    overall: overallPct === null ? null : { pct: overallPct, grade: gradeBand(overallPct), totalObtained, totalMarks },
  });
}
