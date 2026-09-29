import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/password';

/**
 * POST /api/auth/change-password — user changes their own password.
 * Body: { currentPassword?, newPassword }
 * If the account has forcePasswordReset, currentPassword is not required
 * (they may not know it — it was a temp password).
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const newPassword = String(body.newPassword ?? '');
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
  }

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, forcePasswordReset: true },
  });
  if (!full) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

  if (!full.forcePasswordReset) {
    const currentPassword = String(body.currentPassword ?? '');
    if (!verifyPassword(currentPassword, full.passwordHash)) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(newPassword), forcePasswordReset: false },
  });

  return NextResponse.json({ ok: true, message: 'Password changed successfully.' });
}
