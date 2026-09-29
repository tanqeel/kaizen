import { createHash, randomBytes } from 'crypto';
import { prisma } from './db';

/**
 * One-time activation / password-setup tokens.
 *
 * Flow: KAIZEN ID issued → user receives a one-time activation link →
 * user creates their own private password. Admins NEVER see or set
 * plaintext passwords.
 *
 * Security:
 * - Raw token is shown once (in the activation link) and never stored.
 * - Only SHA-256(token) is stored in the database.
 * - Tokens expire after 48 hours and are single-use.
 */

const TOKEN_BYTES = 32;
const EXPIRY_HOURS = 48;

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export interface ActivationLink {
  /** Raw token — embed in the link, show once, never store. */
  rawToken: string;
  /** Full activation URL path (caller prefixes origin). */
  path: string;
}

/**
 * Creates a one-time activation token for a user.
 * Invalidates any prior unused tokens for the same purpose.
 */
export async function createActivationToken(
  userId: string,
  purpose: 'ACTIVATION' | 'PASSWORD_RESET' = 'ACTIVATION',
): Promise<ActivationLink> {
  const rawToken = randomBytes(TOKEN_BYTES).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.$transaction([
    // Invalidate prior unused tokens for this user+purpose.
    prisma.activationToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.activationToken.create({
      data: { userId, tokenHash, purpose, expiresAt },
    }),
  ]);

  return { rawToken, path: `/activate/${rawToken}` };
}

/**
 * Validates a raw token and returns the user it belongs to, or null.
 * Does NOT consume the token — call consumeActivationToken after the
 * password is successfully set.
 */
export async function validateActivationToken(rawToken: string): Promise<{
  userId: string;
  purpose: string;
} | null> {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.activationToken.findUnique({
    where: { tokenHash },
    select: { userId: true, purpose: true, expiresAt: true, usedAt: true },
  });
  if (!record) return null;
  if (record.usedAt) return null;
  if (record.expiresAt < new Date()) return null;
  return { userId: record.userId, purpose: record.purpose };
}

/**
 * Marks a token as used. Call only after the password has been set.
 */
export async function consumeActivationToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await prisma.activationToken.updateMany({
    where: { tokenHash, usedAt: null },
    data: { usedAt: new Date() },
  });
}
