import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';

/** POST /api/auth/login { email, password } — email/password sign-in (real scrypt check). */
export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? '';
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Same 401 either way — never reveal whether the email exists.
  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }
  // Blocked lifecycle states cannot sign in.
  if (['SUSPENDED', 'LOCKED', 'DEACTIVATED', 'REJECTED'].includes(user.status)) {
    return NextResponse.json(
      { error: `Your account is ${user.status.toLowerCase()}. Please contact the school office.` },
      { status: 403 },
    );
  }

  await createSession(user.id);
  return NextResponse.json({ ok: true, forcePasswordReset: user.forcePasswordReset });
}
