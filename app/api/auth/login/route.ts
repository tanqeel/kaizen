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

  // Migration-resilient: if the status column doesn't exist yet (migration
  // pending), fall back to a select without the new identity fields.
  let user;
  try {
    user = await prisma.user.findUnique({ where: { email } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('status') || msg.includes('kaizenId') || msg.includes('forcePasswordReset')) {
      user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true, name: true, email: true, passwordHash: true,
          role: true, isActive: true, phone: true,
        },
      }) as unknown as typeof user;
      // Backfill defaults for missing columns.
      if (user) {
        (user as Record<string, unknown>).status = 'ACTIVE';
        (user as Record<string, unknown>).forcePasswordReset = false;
      }
    } else {
      throw e;
    }
  }
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
