import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiPermission } from '@/lib/api-guard';
import { schoolIdOr400 } from '@/lib/api-auth';
import { checkSlot } from '../slot-checks';

/**
 * PUT /api/academics/timetable/[id] — update a slot.
 * Same double-booking contract as POST: 409 { warning } unless { override: true }.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission('academics.manage');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;
  const existing = await prisma.timetableSlot.findFirst({
    where: { id, section: { grade: { schoolId: sres.schoolId } } },
  });
  if (!existing) return NextResponse.json({ error: 'Slot not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const input = {
    sectionId: existing.sectionId,
    dayOfWeek: body.dayOfWeek !== undefined ? Number(body.dayOfWeek) : existing.dayOfWeek,
    periodNo: body.periodNo !== undefined ? Number(body.periodNo) : existing.periodNo,
    subjectId: body.subjectId !== undefined ? String(body.subjectId) : existing.subjectId,
    teacherId: body.teacherId !== undefined ? String(body.teacherId) : existing.teacherId,
    room: body.room !== undefined ? (body.room ? String(body.room) : null) : existing.room,
    startTime: body.startTime !== undefined ? String(body.startTime) : existing.startTime,
    endTime: body.endTime !== undefined ? String(body.endTime) : existing.endTime,
  };
  const override = body.override === true;

  const check = await checkSlot(input, id, override);
  if (!check.ok) return NextResponse.json(check.body, { status: check.status });

  const slot = await prisma.timetableSlot.update({ where: { id }, data: input });
  return NextResponse.json({ slot, overridden: override });
}

/** DELETE /api/academics/timetable/[id] */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission('academics.manage');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;
  const existing = await prisma.timetableSlot.findFirst({
    where: { id, section: { grade: { schoolId: sres.schoolId } } },
  });
  if (!existing) return NextResponse.json({ error: 'Slot not found' }, { status: 404 });

  await prisma.timetableSlot.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
