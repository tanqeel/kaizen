import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createActivationToken } from '@/lib/activation';
import { auditLog } from '@/lib/audit';
import { createManyCompat } from '@/lib/prisma-batch';

/**
 * POST /api/auth/forgot-password { email }
 *
 * Public self-service entry point for password resets.
 * - Always returns a neutral success (no account enumeration).
 * - Creates a one-time PASSWORD_RESET token (48h, single-use).
 * - Notifies school administrators in-app; an admin issues the reset
 *   link from Users and shares it with the user, who then sets their
 *   own private password via /activate/[token]. Admins never see or
 *   set plaintext passwords.
 * - Rate-limited: at most one token per user per 10 minutes.
 */
export async function POST(req: Request) {
  let email = '';
  try {
    const body = (await req.json()) as { email?: string };
    email = String(body.email ?? '').trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const neutral = () =>
    NextResponse.json({
      ok: true,
      message:
        'If an account exists for this email, a password reset has been requested. Please contact your school office for the reset link.',
    });

  const user = await prisma.user.findFirst({
    where: { email },
    select: { id: true, name: true, kaizenId: true, status: true },
  });
  if (!user || user.status !== 'ACTIVE') return neutral();

  // Rate limit: reuse the quiet path if a fresh unused token already exists.
  const recent = await prisma.activationToken.findFirst({
    where: {
      userId: user.id,
      purpose: 'PASSWORD_RESET',
      usedAt: null,
      expiresAt: { gt: new Date() },
      createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) },
    },
    select: { id: true },
  });
  if (!recent) {
    await createActivationToken(user.id, 'PASSWORD_RESET');

    // Notify administrators in-app so they can issue the reset link.
    const admins = await prisma.user.findMany({
      where: { role: { in: ['SUPER_ADMIN', 'PRINCIPAL', 'ADMIN'] }, status: 'ACTIVE' },
      select: { id: true },
    });
    const message = `${user.name} (${user.kaizenId ?? 'no KAIZEN ID'}) requested a password reset. Open Users to issue their one-time reset link.`;
    // NOTE: prisma.createMany throws "Transactions are not supported in HTTP
    // mode" on the Neon HTTP driver — insert individually in chunks instead.
    await createManyCompat(
      (data) => prisma.notificationLog.create({ data }),
      admins.map((a) => ({
        userId: a.id,
        type: 'ANNOUNCEMENT' as const,
        channel: 'IN_APP' as const,
        message,
        status: 'SENT' as const,
      })),
    );

    const school = await prisma.school.findFirst({ select: { id: true } });
    if (school) {
      await auditLog({
        schoolId: school.id,
        actorId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        targetType: 'User',
        targetId: user.id,
        detail: `Password reset requested for ${user.name} via forgot-password`,
      });
    }
  }

  return neutral();
}
