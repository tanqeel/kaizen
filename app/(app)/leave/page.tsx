import { requireUser } from '@/lib/auth';
import { can, requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { ConfirmProvider } from '@/components/ui';
import { LeaveClient } from './_components/leave-client';
import { ownWhere, serializeLeave } from '@/app/api/leave/route';
import { childStudentIds } from '@/lib/parents';

const leaveInclude = {
  student: { select: { id: true, name: true } },
  teacher: { select: { id: true, user: { select: { name: true } } } },
  staffMember: { select: { id: true, user: { select: { name: true } } } },
  decidedBy: { select: { id: true, name: true } },
} as const;

/** /leave — leave requests: file your own / your child's, managers approve. */
export default async function LeavePage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'leave.view');
  const isManager = can(user.role, 'leave.manage');
  const isParent = user.role === 'PARENT';

  const school = await prisma.school.findFirst({ select: { id: true } });

  const own = school ? await ownWhere(user.id, user.role) : null;
  const rows = own && school
    ? await prisma.leaveRequest.findMany({
        where: { schoolId: school.id, ...own },
        include: leaveInclude,
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
    : [];

  const pendingCount = isManager && school
    ? await prisma.leaveRequest.count({ where: { schoolId: school.id, status: 'PENDING' } })
    : 0;

  let children: Array<{ id: string; name: string }> = [];
  if (isParent) {
    const ids = await childStudentIds(user.id);
    const students = await prisma.student.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    children = students;
  }

  return (
    <ConfirmProvider>
      <LeaveClient
        initialLeaves={rows.map(serializeLeave)}
        pendingCount={pendingCount}
        canManage={isManager}
        isParent={isParent}
        children={children}
      />
    </ConfirmProvider>
  );
}
