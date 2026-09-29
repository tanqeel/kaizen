import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import {
  validateActivationToken,
  hashToken,
} from '@/lib/activation';

/**
 * POST /api/auth/activate
 * Body: { token, password }
 *
 * Sets the user's password via a one-time activation token.
 * The user chooses their own password — admins never see it.
 */
export async function POST(req: Request) {
  try {
    return await activatePost(req);
  } catch (e) {
    console.error('Activation failed:', e);
    return NextResponse.json(
      { error: `Activation failed: ${String(e).slice(0, 200)}` },
      { status: 500 },
    );
  }
}

async function activatePost(req: Request) {
  let body: { token?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const token = String(body.token ?? '').trim();
  const password = String(body.password ?? '');

  if (!token) {
    return NextResponse.json({ error: 'Activation token is required.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters.' },
      { status: 400 },
    );
  }

  const valid = await validateActivationToken(token);
  if (!valid) {
    return NextResponse.json(
      { error: 'This activation link is invalid, expired, or already used.' },
      { status: 400 },
    );
  }

  // Set password, activate account, consume token.
  // Uses raw SQL to avoid Prisma HTTP-mode transaction limitations.
  const tokenHash = await hashToken(token);
  const passwordHash = hashPassword(password);
  const now = new Date();

  await prisma.$executeRaw`
    UPDATE "User"
    SET "passwordHash" = ${passwordHash},
        "status" = 'ACTIVE',
        "isActive" = true,
        "forcePasswordReset" = false,
        "updatedAt" = ${now}
    WHERE id = ${valid.userId}
  `;
  await prisma.$executeRaw`
    UPDATE "ActivationToken"
    SET "usedAt" = ${now}
    WHERE "tokenHash" = ${tokenHash} AND "usedAt" IS NULL
  `;

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/auth/activate?token=… — checks if a token is valid (for the UI).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = String(searchParams.get('token') ?? '').trim();
  if (!token) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
  const valid = await validateActivationToken(token);
  if (!valid) {
    return NextResponse.json({ valid: false });
  }
  const user = await prisma.user.findUnique({
    where: { id: valid.userId },
    select: { name: true, email: true, kaizenId: true },
  });
  return NextResponse.json({
    valid: true,
    purpose: valid.purpose,
    name: user?.name ?? '',
    kaizenId: user?.kaizenId ?? '',
  });
}
// Force redeploy Tue Sep 29 12:40:59 PKT 2026
