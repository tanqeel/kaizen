import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from './db';
import { newSessionToken } from './password';
import type { User } from '@prisma/client';

export const SESSION_COOKIE = 'kaizen_session';
const SESSION_DAYS = 7;

/** User record safe to serialize to the client — never includes the password hash. */
export type SafeUser = Omit<User, 'passwordHash'>;

function stripHash(u: User): SafeUser {
  const { passwordHash: _hash, ...safe } = u;
  return safe;
}

export async function createSession(userId: string, isDemo = false): Promise<void> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await prisma.sessionToken.create({ data: { token, userId, expiresAt, isDemo } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
    secure: process.env.NODE_ENV === 'production',
  });
}

async function loadSession(): Promise<{ user: SafeUser; isDemo: boolean } | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const st = await prisma.sessionToken.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!st || st.expiresAt < new Date() || !st.user.isActive) return null;
  return { user: stripHash(st.user), isDemo: st.isDemo };
}

/**
 * Per-request memoized session lookup. Layout + page + API guards all hit
 * this on every navigation — cache() collapses it to ONE DB round trip
 * per request no matter how many callers there are.
 */
export const getSession = cache(loadSession);

export async function getSessionUser(): Promise<SafeUser | null> {
  const s = await getSession();
  return s?.user ?? null;
}

export async function requireUser(): Promise<SafeUser> {
  const u = await getSessionUser();
  if (!u) redirect('/login');
  return u;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.sessionToken.deleteMany({ where: { token } });
  jar.delete(SESSION_COOKIE);
}
