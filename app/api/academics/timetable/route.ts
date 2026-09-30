import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiPermission } from '@/lib/api-guard';
import { academicScope } from '@/lib/academic-scope';
import { checkSlot, type SlotInput } from './slot-checks';

/** GET /api/academics/timetable?sectionId= — slots for one section. */
export async function GET(req: Request) {
  const auth = await requireApiPermission('academics.view');
  if (auth instanceof NextResponse) return auth;

  const sectionId = new URL(req.url).searchParams.get('sectionId');
  if (!sectionId) return NextResponse.json({ error: 'sectionId is required' }, { status: 400 });

  // Students/parents may only view timetables for their own section(s).
  const scope = await academicScope(auth.id, auth.role);
  if (scope && !scope.sectionIds.includes(sectionId)) {
    return NextResponse.json({ error: 'You can only view your own section timetable.' }, { status: 403 });
  }

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: { grade: true },
  });
  if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 });

  const slots = await prisma.timetableSlot.findMany({
    where: { sectionId },
    include: { subject: true, teacher: { include: { user: true } } },
    orderBy: [{ dayOfWeek: 'asc' }, { periodNo: 'asc' }],
  });
  return NextResponse.json({
    section: { id: section.id, name: `${section.grade.name} - ${section.name}`, room: section.room },
    slots: slots.map((s) => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      periodNo: s.periodNo,
      subjectId: s.subjectId,
      subject: s.subject.name,
      subjectCode: s.subject.code,
      teacherId: s.teacherId,
      teacher: s.teacher.user?.name ?? 'Teacher',
      room: s.room,
      startTime: s.startTime,
      endTime: s.endTime,
    })),
  });
}

function parseBody(body: Record<string, unknown>): SlotInput & { override?: boolean } {
  return {
    sectionId: String(body.sectionId ?? ''),
    dayOfWeek: Number(body.dayOfWeek),
    periodNo: Number(body.periodNo),
    subjectId: String(body.subjectId ?? ''),
    teacherId: String(body.teacherId ?? ''),
    room: body.room ? String(body.room) : null,
    startTime: String(body.startTime ?? ''),
    endTime: String(body.endTime ?? ''),
    override: body.override === true,
  };
}

/**
 * POST /api/academics/timetable — create a slot.
 * Returns 409 { warning } when the teacher is double-booked; resend with
 * { override: true } to force it after confirmation.
 */
export async function POST(req: Request) {
  const auth = await requireApiPermission('academics.manage');
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const input = parseBody(body);
  const check = await checkSlot(input, undefined, input.override);
  if (!check.ok) return NextResponse.json(check.body, { status: check.status });

  const slot = await prisma.timetableSlot.create({
    data: {
      sectionId: input.sectionId,
      dayOfWeek: input.dayOfWeek,
      periodNo: input.periodNo,
      subjectId: input.subjectId,
      teacherId: input.teacherId,
      room: input.room,
      startTime: input.startTime,
      endTime: input.endTime,
    },
  });
  return NextResponse.json({ slot, overridden: input.override === true }, { status: 201 });
}
