import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from './db';
import { newSessionToken } from './password';
import type { User } from '@prisma/client';

export const SESSION_COOKIE = 'kaizen_session';
const SESSION_DAYS = 7;

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

export async function getSessionUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const st = await prisma.sessionToken.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!st || st.expiresAt < new Date() || !st.user.isActive) return null;
  return st.user;
}

export async function requireUser(): Promise<User> {
  const u = await getSessionUser();
  if (!u) redirect('/login');
  return u;
}

/** Full session: user + whether this session was created via one-click demo login. */
export async function getSession(): Promise<{ user: User; isDemo: boolean } | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const st = await prisma.sessionToken.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!st || st.expiresAt < new Date() || !st.user.isActive) return null;
  return { user: st.user, isDemo: st.isDemo };
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.sessionToken.deleteMany({ where: { token } });
  jar.delete(SESSION_COOKIE);
}
