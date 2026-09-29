import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';
import { auditLog } from '@/lib/audit';
import { createActivationToken } from '@/lib/activation';

/**
 * POST /api/users/[id]/reset-password — admin issues a password-reset link.
 *
 * The admin NEVER sets or sees a password. Instead, a one-time reset link
 * is issued; the user sets their own private password via /activate/[token].
 * users.manage only.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('users.manage');
  if (auth.error) return auth.error;

  const { id } = await params;

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, name: true } });
  if (!target) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  // Nobody can reset a SUPER_ADMIN's password except another SUPER_ADMIN.
  if (target.role === 'SUPER_ADMIN' && auth.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Only a Super Admin can reset another Super Admin.' }, { status: 403 });
  }
  // Cannot reset your own password through this endpoint (use profile instead).
  if (target.id === auth.user.id) {
    return NextResponse.json({ error: 'Use the profile page to change your own password.' }, { status: 400 });
  }

  const { path: activationPath } = await createActivationToken(id, 'PASSWORD_RESET');

  const school = await prisma.school.findFirst({ select: { id: true } });
  if (school) {
    await auditLog({
      schoolId: school.id,
      actorId: auth.user.id,
      action: 'PASSWORD_RESET_LINK_ISSUED',
      targetType: 'User',
      targetId: id,
      detail: `Password reset link issued for ${target.name} — user sets their own password`,
    });
  }

  return NextResponse.json({
    ok: true,
    activationPath,
    message: 'Share the reset link with the user. They will set their own private password — you will never see it.',
  });
}
