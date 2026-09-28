import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';

/** POST /api/auth/logout — destroys the current session. */
export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
