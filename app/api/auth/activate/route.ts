import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import {
  validateActivationToken,
  consumeActivationToken,
} from '@/lib/activation';

/**
 * POST /api/auth/activate
 * Body: { token, password }
 *
 * Sets the user's password via a one-time activation token.
 * The user chooses their own password — admins never see it.
 */
export async function POST(req: Request) {
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

  // Set password, activate account, consume token — sequentially
  // (no $transaction: Prisma HTTP mode doesn't support it).
  await prisma.user.update({
    where: { id: valid.userId },
    data: {
      passwordHash: hashPassword(password),
      status: 'ACTIVE',
      isActive: true,
      forcePasswordReset: false,
    },
  });
  await prisma.activationToken.updateMany({
    where: { userId: valid.userId, usedAt: null },
    data: { usedAt: new Date() },
  });
  // Ensure the specific token is marked used (covers edge cases).
  await consumeActivationToken(token);

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
