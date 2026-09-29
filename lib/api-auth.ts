import { NextResponse } from 'next/server';
import { getSessionUser, type SafeUser } from './auth';
import { can, type Permission } from './rbac';

export type ApiAuth = { user: SafeUser; error?: undefined } | { user?: undefined; error: NextResponse };

/**
 * Server-side auth + RBAC for API route handlers.
 * Accepts one permission or a list (passes when the role holds ANY of them).
 * Returns { user } on success, or { error } carrying a 401/403 JSON response.
 *
 * Usage:
 *   const auth = await apiUser('finance.view');
 *   if (auth.error) return auth.error;
 *   const { user } = auth;
 */
export async function apiUser(perm: Permission | Permission[]): Promise<ApiAuth> {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthenticated' }, { status: 401 }) };
  const perms = Array.isArray(perm) ? perm : [perm];
  if (!perms.some((p) => can(user.role, p))) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user };
}

/**
 * Staff-type-aware permission check. For STAFF role users, intersects the
 * role permission with their job-type permissions (e.g. SECURITY staff
 * cannot access finance even though STAFF role nominally can).
 * For all other roles, identical to apiUser.
 */
export async function apiUserStrict(perm: Permission | Permission[]): Promise<ApiAuth> {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthenticated' }, { status: 401 }) };
  const perms = Array.isArray(perm) ? perm : [perm];

  // Staff: check job-type permissions via staff-permissions lib.
  if (user.role === 'STAFF') {
    const { canStaff } = await import('./staff-permissions');
    for (const p of perms) {
      if (await canStaff(user.id, user.role, p)) {
        return { user };
      }
    }
    return {
      error: NextResponse.json(
        { error: 'Access denied: your job role does not include this permission.' },
        { status: 403 },
      ),
    };
  }

  if (!perms.some((p) => can(user.role, p))) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user };
}


/** School of the signed-in context (demo data has exactly one school). */
export async function schoolIdOr400(): Promise<{ schoolId: string } | { error: NextResponse }> {
  const { prisma } = await import('./db');
  const school = await prisma.school.findFirst({ select: { id: true } });
  if (!school) return { error: NextResponse.json({ error: 'No school configured' }, { status: 400 }) };
  return { schoolId: school.id };
}
