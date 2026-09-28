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

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/users/[id] { isActive } — toggle a user account.
 * Super Admin only; a Super Admin cannot deactivate their own account.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await superAdminOnly();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const { id } = await ctx.params;

  let body: { isActive?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (typeof body.isActive !== 'boolean') {
    return NextResponse.json({ error: 'isActive must be true or false' }, { status: 400 });
  }

  if (id === user.id) {
    return NextResponse.json(
      { error: 'You cannot deactivate your own account. Ask another Super Admin.' },
      { status: 400 },
    );
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: body.isActive },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  return NextResponse.json({ user: updated });
}
