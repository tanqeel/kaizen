import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiPermission } from '@/lib/api-guard';
import { academicScope } from '@/lib/academic-scope';

/** GET /api/academics/allocations — subject → grade → teacher allocations. */
export async function GET() {
  const auth = await requireApiPermission('academics.view');
  if (auth instanceof NextResponse) return auth;

  // Students/parents see only allocations for their own grade(s).
  const scope = await academicScope(auth.id, auth.role);

  const allocations = await prisma.subjectAllocation.findMany({
    where: scope ? { gradeId: { in: scope.gradeIds } } : {},
    include: {
      subject: true,
      grade: true,
      teacher: { include: { user: true } },
    },
    orderBy: [{ grade: { level: 'asc' } }, { subject: { name: 'asc' } }],
  });
  return NextResponse.json({
    allocations: allocations.map((a) => ({
      id: a.id,
      subject: a.subject.name,
      subjectCode: a.subject.code,
      grade: a.grade.name,
      teacher: a.teacher.user?.name ?? 'Teacher',
      teacherId: a.teacherId,
      periodsPerWeek: a.periodsPerWeek,
    })),
  });
}

/** POST /api/academics/allocations { subjectId, gradeId, teacherId, periodsPerWeek } */
export async function POST(req: Request) {
  const auth = await requireApiPermission('academics.manage');
  if (auth instanceof NextResponse) return auth;

  let body: { subjectId?: string; gradeId?: string; teacherId?: string; periodsPerWeek?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { subjectId, gradeId, teacherId } = body;
  const periodsPerWeek = Number(body.periodsPerWeek);
  if (!subjectId || !gradeId || !teacherId) {
    return NextResponse.json({ error: 'Subject, grade and teacher are required' }, { status: 400 });
  }
  if (!Number.isInteger(periodsPerWeek) || periodsPerWeek < 1 || periodsPerWeek > 30) {
    return NextResponse.json({ error: 'Periods per week must be between 1 and 30' }, { status: 400 });
  }

  const [subject, grade, teacher] = await Promise.all([
    prisma.subject.findUnique({ where: { id: subjectId } }),
    prisma.grade.findUnique({ where: { id: gradeId } }),
    prisma.teacher.findUnique({ where: { id: teacherId } }),
  ]);
  if (!subject || !grade || !teacher) {
    return NextResponse.json({ error: 'Subject, grade or teacher not found' }, { status: 404 });
  }
  const dup = await prisma.subjectAllocation.findUnique({
    where: { subjectId_gradeId: { subjectId, gradeId } },
  });
  if (dup) {
    return NextResponse.json(
      { error: `${subject.name} is already allocated in ${grade.name} — delete the existing allocation first` },
      { status: 409 },
    );
  }

  const allocation = await prisma.subjectAllocation.create({
    data: { subjectId, gradeId, teacherId, periodsPerWeek },
  });
  return NextResponse.json({ allocation }, { status: 201 });
}
