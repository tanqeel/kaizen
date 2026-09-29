import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';
import { hashPassword } from '@/lib/password';
import { auditLog } from '@/lib/audit';

/**
 * POST /api/users/[id]/reset-password — admin resets a user's password.
 * Body: { newPassword } (min 8 chars) OR { forceReset: true } to require
 * the user to set a new password on next login.
 * The plaintext password is hashed immediately and never stored or logged.
 * users.manage only.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('users.manage');
  if (auth.error) return auth.error;

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

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

  const newPassword = String(body.newPassword ?? '').trim();
  const forceReset = body.forceReset === true;

  const data: { passwordHash?: string; forcePasswordReset: boolean } = {
    forcePasswordReset: true,
  };
  if (newPassword) {
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }
    data.passwordHash = hashPassword(newPassword);
    data.forcePasswordReset = true; // User must still set their own on next login.
  } else if (!forceReset) {
    return NextResponse.json({ error: 'Provide newPassword or forceReset: true.' }, { status: 400 });
  }

  await prisma.user.update({ where: { id }, data });

  const school = await prisma.school.findFirst({ select: { id: true } });
  if (school) {
    await auditLog({
      schoolId: school.id,
      actorId: auth.user.id,
      action: newPassword ? 'PASSWORD_RESET' : 'PASSWORD_RESET_FORCED',
      targetType: 'User',
      targetId: id,
      detail: `Password ${newPassword ? 'reset' : 'force-reset required'} for ${target.name}`,
    });
  }

  return NextResponse.json({
    ok: true,
    message: newPassword
      ? 'Password reset. Share it securely — the user must change it on next login.'
      : 'User will be required to set a new password on next login.',
    // Returned once so the admin can share it; never stored in plaintext.
    ...(newPassword ? { tempPassword: newPassword } : {}),
  });
}
