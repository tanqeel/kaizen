import { NextResponse } from 'next/server';
import { requireUser } from './auth';
import { can, type Permission } from './rbac';
import type { User } from '@prisma/client';

/**
 * API-side permission guard. Returns the authenticated user, or a 403 JSON
 * response when the role lacks the permission. Usage:
 *   const auth = await requireApiPermission('academics.manage');
 *   if (auth instanceof NextResponse) return auth;
 */
export async function requireApiPermission(perm: Permission): Promise<User | NextResponse> {
  const user = await requireUser();
  if (!can(user.role, perm)) {
    return NextResponse.json({ error: `Forbidden: ${user.role} lacks ${perm}` }, { status: 403 });
  }
  return user;
}
