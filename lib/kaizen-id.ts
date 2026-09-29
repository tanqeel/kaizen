import { prisma } from './db';
import type { Role } from '@prisma/client';

/**
 * Generates a unique KAIZEN ID in the format KZN-{TYPE}-{YYYY}-{NNNNNN}.
 * Type codes: STU (student), PRT (parent), TCH (teacher), STF (staff),
 * ADM (admin/principal), SUP (super admin).
 * Collision-safe: checks the database and retries with a random suffix on collision.
 */

const ROLE_CODES: Record<Role, string> = {
  SUPER_ADMIN: 'SUP',
  PRINCIPAL: 'ADM',
  ADMIN: 'ADM',
  TEACHER: 'TCH',
  STAFF: 'STF',
  PARENT: 'PRT',
  STUDENT: 'STU',
};

function randomSix(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function generateKaizenId(role: Role): Promise<string> {
  const code = ROLE_CODES[role];
  const year = new Date().getFullYear();
  // Try up to 10 times to avoid collisions.
  for (let i = 0; i < 10; i++) {
    const id = `KZN-${code}-${year}-${randomSix()}`;
    const existing = await prisma.user.findUnique({ where: { kaizenId: id }, select: { id: true } });
    if (!existing) return id;
  }
  // Fallback: timestamp-based suffix (extremely unlikely to collide).
  return `KZN-${code}-${year}-${Date.now().toString().slice(-6)}`;
}
