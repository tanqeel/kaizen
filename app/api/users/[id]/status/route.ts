import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';
import { auditLog } from '@/lib/audit';
import type { AccountStatus } from '@prisma/client';

const ALLOWED: AccountStatus[] = [
  'ACTIVE',
  'SUSPENDED',
  'LOCKED',
  'DEACTIVATED',
  'GRADUATED',
  'TRANSFERRED',
];

/**
 * PATCH /api/users/[id]/status — change a user's account lifecycle status.
 * Body: { status: 'ACTIVE'|'SUSPENDED'|'LOCKED'|'DEACTIVATED'|'GRADUATED'|'TRANSFERRED' }
 * users.manage only. Every change is audit-logged.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('users.manage');
  if (auth.error) return auth.error;

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const status = String(body.status ?? '').toUpperCase() as AccountStatus;
  if (!ALLOWED.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${ALLOWED.join(', ')}` }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, name: true } });
  if (!target) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  if (target.role === 'SUPER_ADMIN' && auth.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Only a Super Admin can change another Super Admin.' }, { status: 403 });
  }
  if (target.id === auth.user.id) {
    return NextResponse.json({ error: 'You cannot change your own account status.' }, { status: 400 });
  }

  const isActive = status === 'ACTIVE';
  await prisma.user.update({ where: { id }, data: { status, isActive } });

  const school = await prisma.school.findFirst({ select: { id: true } });
  if (school) {
    await auditLog({
      schoolId: school.id,
      actorId: auth.user.id,
      action: 'ACCOUNT_STATUS_CHANGED',
      targetType: 'User',
      targetId: id,
      detail: `${target.name} → ${status}`,
    });
  }

  return NextResponse.json({ ok: true, status });
}
