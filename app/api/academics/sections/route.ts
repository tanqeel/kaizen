import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiPermission } from '@/lib/api-guard';
import { academicScope } from '@/lib/academic-scope';

/** GET /api/academics/sections — grades with their sections (teacher, counts). */
export async function GET() {
  const auth = await requireApiPermission('academics.view');
  if (auth instanceof NextResponse) return auth;

  // Students see only their own grade/section; parents only their children's.
  const scope = await academicScope(auth.id, auth.role);

  const grades = await prisma.grade.findMany({
    where: scope ? { id: { in: scope.gradeIds } } : {},
    include: {
      sections: {
        where: scope ? { id: { in: scope.sectionIds } } : {},
        include: {
          classTeacher: { include: { user: true } },
          _count: { select: { students: true, timetableSlots: true, periodAttendance: true } },
        },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { level: 'asc' },
  });
  return NextResponse.json({
    grades: grades.map((g) => ({
      id: g.id,
      level: g.level,
      name: g.name,
      sections: g.sections.map((s) => ({
        id: s.id,
        name: s.name,
        room: s.room,
        classTeacher: s.classTeacher?.user?.name ?? null,
        classTeacherId: s.classTeacherId,
        studentCount: s._count.students,
        slotCount: s._count.timetableSlots,
        deletable: s._count.students === 0 && s._count.timetableSlots === 0 && s._count.periodAttendance === 0,
      })),
    })),
  });
}

/** POST /api/academics/sections { gradeId, name, room?, classTeacherId? } */
export async function POST(req: Request) {
  const auth = await requireApiPermission('academics.manage');
  if (auth instanceof NextResponse) return auth;

  let body: { gradeId?: string; name?: string; room?: string; classTeacherId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const gradeId = body.gradeId?.trim();
  const name = body.name?.trim().toUpperCase();
  const room = body.room?.trim() || null;
  const classTeacherId = body.classTeacherId?.trim() || null;
  if (!gradeId || !name) return NextResponse.json({ error: 'Grade and section name are required' }, { status: 400 });

  const grade = await prisma.grade.findUnique({ where: { id: gradeId } });
  if (!grade) return NextResponse.json({ error: 'Grade not found' }, { status: 404 });
  const dup = await prisma.section.findFirst({ where: { gradeId, name } });
  if (dup) return NextResponse.json({ error: `Section "${name}" already exists in ${grade.name}` }, { status: 409 });
  if (classTeacherId) {
    const t = await prisma.teacher.findUnique({ where: { id: classTeacherId } });
    if (!t) return NextResponse.json({ error: 'Class teacher not found' }, { status: 404 });
  }

  const section = await prisma.section.create({
    data: { gradeId, name, room, classTeacherId },
  });
  return NextResponse.json({ section }, { status: 201 });
}
