import { NextResponse } from 'next/server';
import { requireUser, type SafeUser } from './auth';
import { can, type Permission } from './rbac';

/**
 * API-side permission guard. Returns the authenticated user, or a 403 JSON
 * response when the role lacks the permission. Usage:
 *   const auth = await requireApiPermission('academics.manage');
 *   if (auth instanceof NextResponse) return auth;
 */
export async function requireApiPermission(perm: Permission): Promise<SafeUser | NextResponse> {
  const user = await requireUser();
  // Staff: intersect with job-type permissions (see lib/staff-permissions.ts).
  if (user.role === 'STAFF') {
    const { canStaff } = await import('./staff-permissions');
    if (await canStaff(user.id, user.role, perm)) return user;
    return NextResponse.json(
      { error: 'Access denied: your job role does not include this permission.' },
      { status: 403 },
    );
  }
  if (!can(user.role, perm)) {
    return NextResponse.json({ error: `Forbidden: ${user.role} lacks ${perm}` }, { status: 403 });
  }
  return user;
}
