import { requireUser } from '@/lib/auth';
import { requirePagePermission } from '@/lib/rbac';
import { canStaff } from '@/lib/staff-permissions';
import { prisma } from '@/lib/db';
import { childStudentIds } from '@/lib/parents';
import { ConfirmProvider } from '@/components/ui';
import { NoticesClient, type NoticeItem } from './_components/notices-client';
import type { AnnouncementAudience } from '@prisma/client';

/**
 * /notices — read view of school announcements with add/edit/delete for
 * users holding comms.manage (staff-type-aware for STAFF roles).
 */
export default async function NoticesPage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'notices.view');
  const canManage = await canStaff(user.id, user.role, 'comms.manage');

  // Which audiences can this role see?
  const audiences: AnnouncementAudience[] = ['ALL'];
  if (user.role === 'PARENT') audiences.push('PARENTS');
  if (user.role === 'TEACHER') audiences.push('TEACHERS');
  if (user.role === 'STAFF') audiences.push('STAFF');
  if (user.role === 'SUPER_ADMIN' || user.role === 'PRINCIPAL') {
    audiences.push('PARENTS', 'TEACHERS', 'STAFF');
  }

  // Grade-scoped notices relevant to the viewer.
  let gradeIds: string[] | null = null;
  if (user.role === 'PARENT') {
    const kids = await childStudentIds(user.id);
    const studs = await prisma.student.findMany({ where: { id: { in: kids } }, select: { gradeId: true } });
    gradeIds = [...new Set(studs.map((s) => s.gradeId))];
  } else if (user.role === 'STUDENT') {
    const student = await prisma.student.findUnique({ where: { userId: user.id }, select: { gradeId: true } });
    gradeIds = student ? [student.gradeId] : [];
  } else if (user.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: user.id },
      include: { allocations: { select: { gradeId: true } } },
    });
    gradeIds = [...new Set(teacher?.allocations.map((a) => a.gradeId) ?? [])];
  }

  const [notices, grades] = await Promise.all([
    prisma.announcement.findMany({
      where: {
        OR: [
          { audience: { in: audiences } },
          ...(gradeIds === null
            ? [{ audience: 'GRADES' as AnnouncementAudience }]
            : gradeIds.length > 0
              ? [{ audience: 'GRADES' as AnnouncementAudience, gradeId: { in: gradeIds } }]
              : []),
        ],
      },
      include: { createdBy: { select: { name: true } } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 60,
    }),
    canManage
      ? prisma.grade.findMany({ select: { id: true, name: true }, orderBy: { level: 'asc' } })
      : Promise.resolve([]),
  ]);

  const initial: NoticeItem[] = notices.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    priority: n.priority,
    audience: n.audience,
    gradeId: n.gradeId,
    createdBy: n.createdBy.name,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <ConfirmProvider>
      <NoticesClient initial={initial} grades={grades} canManage={canManage} />
    </ConfirmProvider>
  );
}
