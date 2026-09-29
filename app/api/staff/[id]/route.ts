import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';

/**
 * PATCH /api/staff/[id]?kind=TEACHER|STAFF — update or deactivate a staff member.
 * Body: { phone?, cnic?, salaryMonthly?, designation?, isActive? }
 * Deactivating also deactivates the linked login. staff.manage only.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('staff.manage');
  if (auth.error) return auth.error;
  const { id } = await params;

  const url = new URL(req.url);
  const kind = (url.searchParams.get('kind') ?? '').toUpperCase();
  if (kind !== 'TEACHER' && kind !== 'STAFF') {
    return NextResponse.json({ error: 'kind query param must be TEACHER or STAFF.' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const record = kind === 'TEACHER'
    ? await prisma.teacher.findUnique({ where: { id }, select: { id: true, userId: true } })
    : await prisma.staffMember.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!record) return NextResponse.json({ error: 'Record not found.' }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (typeof body.phone === 'string' && body.phone.trim()) data.phone = body.phone.trim();
  if (typeof body.cnic === 'string') data.cnic = body.cnic.trim() || null;
  if (typeof body.designation === 'string' && kind === 'STAFF' && body.designation.trim()) {
    data.designation = body.designation.trim();
  }
  if (body.salaryMonthly !== undefined) {
    const s = Number(body.salaryMonthly);
    if (!Number.isFinite(s) || s < 0) {
      return NextResponse.json({ error: 'Monthly salary must be a non-negative number.' }, { status: 400 });
    }
    data.salaryMonthly = Math.round(s);
  }
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  if (kind === 'TEACHER') {
    await prisma.teacher.update({ where: { id }, data });
  } else {
    await prisma.staffMember.update({ where: { id }, data });
  }
  if (typeof body.isActive === 'boolean' && record.userId) {
    await prisma.user.update({ where: { id: record.userId }, data: { isActive: body.isActive } });
  }
  return NextResponse.json({ ok: true });
}
