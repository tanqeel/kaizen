import { NextRequest, NextResponse } from 'next/server';
import { apiUser, schoolIdOr400 } from '@/lib/api-auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { childStudentIds } from '@/lib/parents';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

const leaveInclude = {
  student: { select: { id: true, name: true } },
  teacher: { select: { id: true, user: { select: { name: true } } } },
  staffMember: { select: { id: true, user: { select: { name: true } } } },
  decidedBy: { select: { id: true, name: true } },
} as const;

/** Display name of who the leave is for, plus a type label. */
export function whoOf(l: {
  student?: { name: string } | null;
  teacher?: { user?: { name: string } | null } | null;
  staffMember?: { user?: { name: string } | null } | null;
}): { name: string; kind: string } {
  if (l.student) return { name: l.student.name, kind: 'Student' };
  if (l.teacher) return { name: l.teacher.user?.name ?? 'Teacher', kind: 'Teacher' };
  if (l.staffMember) return { name: l.staffMember.user?.name ?? 'Staff', kind: 'Staff' };
  return { name: '—', kind: '' };
}

export function serializeLeave(l: {
  id: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  decidedAt: Date | null;
  createdAt: Date;
  student?: { id: string; name: string } | null;
  teacher?: { id: string; user?: { name: string } | null } | null;
  staffMember?: { id: string; user?: { name: string } | null } | null;
  decidedBy?: { id: string; name: string } | null;
}) {
  const { name, kind } = whoOf(l);
  return {
    id: l.id,
    fromDate: l.fromDate,
    toDate: l.toDate,
    reason: l.reason,
    status: l.status,
    who: name,
    whoKind: kind,
    decidedBy: l.decidedBy?.name ?? null,
    decidedAt: l.decidedAt ? l.decidedAt.toISOString() : null,
    createdAt: l.createdAt.toISOString(),
  };
}

/** Build the "own requests" where-clause for a role, or null when none applies. */
export async function ownWhere(
  userId: string,
  role: string,
): Promise<{ studentId?: { in: string[] }; teacherId?: string; staffMemberId?: string } | null> {
  if (role === 'PARENT') {
    const ids = await childStudentIds(userId);
    return { studentId: { in: ids } };
  }
  if (role === 'TEACHER') {
    const t = await prisma.teacher.findUnique({ where: { userId }, select: { id: true } });
    if (!t) return null;
    return { teacherId: t.id };
  }
  if (role === 'STAFF') {
    const s = await prisma.staffMember.findUnique({ where: { userId }, select: { id: true } });
    if (!s) return null;
    return { staffMemberId: s.id };
  }
  if (role === 'SUPER_ADMIN' || role === 'PRINCIPAL') {
    const t = await prisma.teacher.findUnique({ where: { userId }, select: { id: true } });
    if (t) return { teacherId: t.id };
    const s = await prisma.staffMember.findUnique({ where: { userId }, select: { id: true } });
    if (s) return { staffMemberId: s.id };
    return null;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { user, error } = await apiUser('leave.view');
  if (error) return error;

  const schoolRes = await schoolIdOr400();
  if ('error' in schoolRes) return schoolRes.error;
  const schoolId = schoolRes.schoolId;

  const isManager = can(user.role, 'leave.manage');
  const scope = req.nextUrl.searchParams.get('scope');
  const statusParam = req.nextUrl.searchParams.get('status');

  let where: Record<string, unknown> = { schoolId };
  if (isManager && scope === 'all') {
    if (statusParam && statusParam !== 'ALL') {
      if (!(VALID_STATUSES as readonly string[]).includes(statusParam)) {
        return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
      }
      where = { ...where, status: statusParam };
    }
  } else {
    const own = await ownWhere(user.id, user.role);
    if (!own) return NextResponse.json({ leaves: [] });
    where = { ...where, ...own };
  }

  const rows = await prisma.leaveRequest.findMany({
    where,
    include: leaveInclude,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return NextResponse.json({ leaves: rows.map(serializeLeave) });
}

export async function POST(req: NextRequest) {
  const { user, error } = await apiUser('leave.view');
  if (error) return error;

  const schoolRes = await schoolIdOr400();
  if ('error' in schoolRes) return schoolRes.error;
  const { schoolId } = schoolRes;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const forType = body.forType;
  const fromDate = String(body.fromDate ?? '').trim();
  const toDate = String(body.toDate ?? '').trim();
  const reason = String(body.reason ?? '').trim();

  if (forType !== 'child' && forType !== 'self') {
    return NextResponse.json({ error: "forType must be 'child' or 'self'" }, { status: 400 });
  }
  if (!DATE_RE.test(fromDate) || !DATE_RE.test(toDate)) {
    return NextResponse.json({ error: 'Dates must be YYYY-MM-DD' }, { status: 400 });
  }
  if (fromDate > toDate) {
    return NextResponse.json({ error: 'From date must be on or before to date' }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
  }
  if (reason.length > 2000) {
    return NextResponse.json({ error: 'Reason is too long (max 2000 characters)' }, { status: 400 });
  }

  let studentId: string | null = null;
  let teacherId: string | null = null;
  let staffMemberId: string | null = null;

  if (user.role === 'PARENT') {
    if (forType !== 'child') {
      return NextResponse.json({ error: 'Parents can only file leave for their children' }, { status: 400 });
    }
    const sid = String(body.studentId ?? '');
    if (!sid) return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    const mine = await childStudentIds(user.id);
    if (!mine.includes(sid)) {
      return NextResponse.json({ error: 'Student is not one of your children' }, { status: 403 });
    }
    studentId = sid;
  } else if (user.role === 'TEACHER') {
    if (forType !== 'self') {
      return NextResponse.json({ error: 'Teachers can only file leave for themselves' }, { status: 400 });
    }
    const t = await prisma.teacher.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!t) return NextResponse.json({ error: 'No teacher profile linked to your account' }, { status: 400 });
    teacherId = t.id;
  } else if (user.role === 'STAFF') {
    if (forType !== 'self') {
      return NextResponse.json({ error: 'Staff can only file leave for themselves' }, { status: 400 });
    }
    const s = await prisma.staffMember.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!s) return NextResponse.json({ error: 'No staff profile linked to your account' }, { status: 400 });
    staffMemberId = s.id;
  } else if (user.role === 'SUPER_ADMIN' || user.role === 'PRINCIPAL') {
    if (forType !== 'self') {
      return NextResponse.json({ error: 'Managers file leave for themselves only' }, { status: 400 });
    }
    const t = await prisma.teacher.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (t) teacherId = t.id;
    else {
      const s = await prisma.staffMember.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (s) staffMemberId = s.id;
      else return NextResponse.json({ error: 'No teacher or staff profile linked to your account' }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: 'Your role cannot file leave' }, { status: 403 });
  }

  const created = await prisma.leaveRequest.create({
    data: { schoolId, studentId, teacherId, staffMemberId, fromDate, toDate, reason },
    include: leaveInclude,
  });

  return NextResponse.json({ leave: serializeLeave(created) }, { status: 201 });
}
