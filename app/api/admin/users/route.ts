import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import type { User } from '@prisma/client';

async function superAdminOnly(): Promise<{ user: User } | NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  try {
    requirePermission(user.role, 'admin.manage');
  } catch {
    return NextResponse.json({ error: 'Forbidden: Super Admin only' }, { status: 403 });
  }
  return { user };
}

/** GET /api/admin/users — full user list (Super Admin only). */
export async function GET() {
  const auth = await superAdminOnly();
  if (auth instanceof NextResponse) return auth;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true, role: true, phone: true, isActive: true, createdAt: true },
  });
  return NextResponse.json({ users });
}
