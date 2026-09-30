import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';

/**
 * GET /api/users/reset-requests — users with a pending (unused, unexpired)
 * PASSWORD_RESET token. users.manage only. Powers the "Password reset
 * requests" section in Users so admins can issue the one-time reset link.
 */
export async function GET() {
  const auth = await apiUser('users.manage');
  if (auth.error) return auth.error;

  const pending = await prisma.activationToken.findMany({
    where: { purpose: 'PASSWORD_RESET', usedAt: null, expiresAt: { gt: new Date() } },
    include: { user: { select: { id: true, name: true, email: true, kaizenId: true, role: true } } },
    orderBy: { createdAt: 'desc' },
  });

  // One row per user (latest request wins).
  const seen = new Set<string>();
  const requests = [];
  for (const t of pending) {
    if (!t.user || seen.has(t.user.id)) continue;
    seen.add(t.user.id);
    requests.push({
      userId: t.user.id,
      name: t.user.name,
      email: t.user.email,
      kaizenId: t.user.kaizenId,
      role: t.user.role,
      requestedAt: t.createdAt.toISOString(),
      expiresAt: t.expiresAt.toISOString(),
    });
  }

  return NextResponse.json({ requests });
}
