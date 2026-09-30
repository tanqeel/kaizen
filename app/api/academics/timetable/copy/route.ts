import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiPermission } from '@/lib/api-guard';
import { createManyCompat } from '@/lib/prisma-batch';

/**
 * POST /api/academics/timetable/copy { fromSectionId, toSectionId }
 * Duplicate one section's whole week onto another section, replacing the
 * target's existing timetable. Teacher double-booking is NOT re-checked here
 * (bulk admin action) — the confirmation dialog states this.
 */
export async function POST(req: Request) {
  const auth = await requireApiPermission('academics.manage');
  if (auth instanceof NextResponse) return auth;

  let body: { fromSectionId?: string; toSectionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { fromSectionId, toSectionId } = body;
  if (!fromSectionId || !toSectionId) {
    return NextResponse.json({ error: 'fromSectionId and toSectionId are required' }, { status: 400 });
  }
  if (fromSectionId === toSectionId) {
    return NextResponse.json({ error: 'Source and target sections must differ' }, { status: 400 });
  }

  const [from, to] = await Promise.all([
    prisma.section.findUnique({ where: { id: fromSectionId }, include: { grade: true } }),
    prisma.section.findUnique({ where: { id: toSectionId }, include: { grade: true } }),
  ]);
  if (!from || !to) return NextResponse.json({ error: 'Section not found' }, { status: 404 });

  const sourceSlots = await prisma.timetableSlot.findMany({ where: { sectionId: fromSectionId } });
  if (sourceSlots.length === 0) {
    return NextResponse.json(
      { error: `${from.grade.name}-${from.name} has no timetable to copy` },
      { status: 400 },
    );
  }

  const replaced = await prisma.timetableSlot.deleteMany({ where: { sectionId: toSectionId } });
  // NOTE: prisma.createMany throws "Transactions are not supported in HTTP
  // mode" on the Neon HTTP driver — insert individually in chunks instead.
  await createManyCompat(
    (data) => prisma.timetableSlot.create({ data }),
    sourceSlots.map((s) => ({
      sectionId: toSectionId,
      dayOfWeek: s.dayOfWeek,
      periodNo: s.periodNo,
      subjectId: s.subjectId,
      teacherId: s.teacherId,
      room: s.room,
      startTime: s.startTime,
      endTime: s.endTime,
    })),
  );

  return NextResponse.json({
    ok: true,
    copied: sourceSlots.length,
    replaced: replaced.count,
    from: `${from.grade.name}-${from.name}`,
    to: `${to.grade.name}-${to.name}`,
  });
}
