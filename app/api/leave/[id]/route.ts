import { NextRequest, NextResponse } from 'next/server';
import { apiUser } from '@/lib/api-auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { childStudentIds } from '@/lib/parents';
import { serializeLeave } from '../route';

const leaveInclude = {
  student: { select: { id: true, name: true } },
  teacher: { select: { id: true, userId: true, user: { select: { name: true } } } },
  staffMember: { select: { id: true, userId: true, user: { select: { name: true } } } },
  decidedBy: { select: { id: true, name: true } },
} as const;

/** True when this request belongs to the given user (parent of the student, or own teacher/staff request). */
async function isOwnLeave(userId: string, leave: {
  studentId: string | null;
  teacher?: { userId: string | null } | null;
  staffMember?: { userId: string | null } | null;
}): Promise<boolean> {
  if (leave.teacher?.userId === userId) return true;
  if (leave.staffMember?.userId === userId) return true;
  if (leave.studentId) {
    const mine = await childStudentIds(userId);
    return mine.includes(leave.studentId);
  }
  return false;
}

async function getLeave(id: string) {
  return prisma.leaveRequest.findUnique({
    where: { id },
    include: leaveInclude,
  });
}

/** Decide a pending leave request (managers only). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await apiUser('leave.manage');
  if (error) return error;

  const { id } = await params;
  const leave = await getLeave(id);
  if (!leave) return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
  if (leave.status !== 'PENDING') {
    return NextResponse.json({ error: 'Only pending requests can be decided' }, { status: 409 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = body.action;
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  const updated = await prisma.leaveRequest.update({
    where: { id },
    data: {
      status: action === 'approve' ? 'APPROVED' : 'REJECTED',
      decidedById: user.id,
      decidedAt: new Date(),
    },
    include: leaveInclude,
  });

  return NextResponse.json({ leave: serializeLeave(updated) });
}

/**
 * Cancel a leave request: allowed when the requester cancels their own
 * PENDING request, or when the caller holds leave.manage (any request).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await apiUser('leave.view');
  if (error) return error;

  const { id } = await params;
  const leave = await getLeave(id);
  if (!leave) return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });

  const manager = can(user.role, 'leave.manage');
  if (!manager) {
    if (leave.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only pending requests can be cancelled' }, { status: 409 });
    }
    const own = await isOwnLeave(user.id, leave);
    if (!own) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.leaveRequest.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
