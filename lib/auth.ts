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

export async function getSessionUser(): Promise<SafeUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const st = await prisma.sessionToken.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!st || st.expiresAt < new Date() || !st.user.isActive) return null;
  return stripHash(st.user);
}

export async function requireUser(): Promise<SafeUser> {
  const u = await getSessionUser();
  if (!u) redirect('/login');
  return u;
}

/** Full session: user + whether this session was created via one-click demo login. */
export async function getSession(): Promise<{ user: SafeUser; isDemo: boolean } | null> {
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

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.sessionToken.deleteMany({ where: { token } });
  jar.delete(SESSION_COOKIE);
}
