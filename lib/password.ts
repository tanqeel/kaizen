import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

/** scrypt password hashing — no external dependency. Stored as `salt:hash` (hex). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(derived, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** 32-byte hex session token. */
export function newSessionToken(): string {
  return randomBytes(32).toString('hex');
}
