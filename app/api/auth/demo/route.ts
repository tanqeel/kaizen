import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { DEMO_LOGINS } from '@/lib/format';

/** POST /api/auth/demo { role } — one-click demo login; marks the session as demo. */
export async function POST(req: Request) {
  let body: { role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const entry = DEMO_LOGINS.find((d) => d.role === body.role);
  if (!entry) {
    return NextResponse.json({ error: 'Unknown demo role' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: entry.email } });
  if (!user || !user.isActive) {
    return NextResponse.json({ error: 'Demo account unavailable' }, { status: 400 });
  }

  await createSession(user.id, true);
  return NextResponse.json({ ok: true, role: user.role });
}
