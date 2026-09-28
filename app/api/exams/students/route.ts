import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiPermission } from '@/lib/api-guard';
import { teacherGradeIds, parentChildIds, ownStudentId } from '@/lib/exams';

/**
 * GET /api/exams/students?gradeId= — student picker for the report-card view,
 * scoped: parent → own children, student → self, teacher → own grades,
 * admin/principal → all. gradeId optional (filters when given).
 */
export async function GET(req: Request) {
  const auth = await requireApiPermission('exams.view');
  if (auth instanceof NextResponse) return auth;

  const gradeId = new URL(req.url).searchParams.get('gradeId');

  let idFilter: string[] | null = null; // null = all allowed
  if (auth.role === 'PARENT') idFilter = await parentChildIds(auth.id);
  else if (auth.role === 'STUDENT') {
    const self = await ownStudentId(auth.id);
    idFilter = self ? [self] : [];
  } else if (auth.role === 'TEACHER') {
    const ownGrades = await teacherGradeIds(auth.id);
    if (gradeId && !ownGrades.includes(gradeId)) {
      return NextResponse.json({ error: 'Forbidden: not one of your grades' }, { status: 403 });
    }
    if (!gradeId) {
      const inGrades = await prisma.student.findMany({
        where: { gradeId: { in: ownGrades }, isActive: true },
        select: { id: true },
      });
      idFilter = inGrades.map((s) => s.id);
    }
  }

  const students = await prisma.student.findMany({
    where: {
      isActive: true,
      ...(gradeId ? { gradeId } : {}),
      ...(idFilter ? { id: { in: idFilter } } : {}),
    },
    include: { grade: true, section: true },
    orderBy: [{ grade: { level: 'asc' } }, { section: { name: 'asc' } }, { name: 'asc' }],
    take: 500,
  });

  return NextResponse.json({
    students: students.map((s) => ({
      id: s.id,
      name: s.name,
      admissionNo: s.admissionNo,
      grade: s.grade.name,
      section: s.section.name,
    })),
  });
}
