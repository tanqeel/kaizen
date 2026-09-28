import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';

const FINAL: Array<'RESOLVED' | 'DISMISSED'> = ['RESOLVED', 'DISMISSED'];

/**
 * PATCH /api/attendance/conflicts/[id] { status: RESOLVED|DISMISSED, note? }
 * Closes an OPEN conflict, recording who resolved it and when.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('attendance.conflicts');
  if (auth.error) return auth.error;
  const { user } = auth;
  const { id } = await params;

  let body: { status?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!body.status || !FINAL.includes(body.status as 'RESOLVED' | 'DISMISSED')) {
    return NextResponse.json({ error: 'status must be RESOLVED or DISMISSED' }, { status: 400 });
  }

  const conflict = await prisma.attendanceConflict.findUnique({ where: { id } });
  if (!conflict) return NextResponse.json({ error: 'Conflict not found' }, { status: 404 });
  if (conflict.status !== 'OPEN') {
    return NextResponse.json({ error: `Conflict is already ${conflict.status}` }, { status: 409 });
  }

  const updated = await prisma.attendanceConflict.update({
    where: { id },
    data: {
      status: body.status as 'RESOLVED' | 'DISMISSED',
      note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : conflict.note,
      resolvedById: user.id,
      resolvedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, conflict: { id: updated.id, status: updated.status } });
}
