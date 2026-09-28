import { requireUser } from '@/lib/auth';
import { requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { childStudentIds } from '@/lib/parents';
import { pktDateTime } from '@/lib/format';
import { Badge, Card, CardContent, EmptyState, PageHeader } from '@/components/ui';
import { Icon } from '@/components/icons';
import type { AnnouncementAudience } from '@prisma/client';

/**
 * /notices — read view of school announcements. Publishing stays in /comms
 * (comms.manage); this page is the audience side the audit found missing:
 * teachers, parents and students could never read what was published.
 */
export default async function NoticesPage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'notices.view');

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

  const notices = await prisma.announcement.findMany({
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
  });

  return (
    <div>
      <PageHeader
        title="Notices"
        subtitle="Announcements from the school office — circulars, holidays, exam news and events."
      />
      {notices.length === 0 ? (
        <EmptyState
          icon="megaphone"
          title="No notices yet"
          guidance="When the school office publishes a notice for you, it will appear here."
        />
      ) : (
        <div className="space-y-4">
          {notices.map((n) => (
            <Card key={n.id} className={n.priority === 'URGENT' ? 'border-amber-300 dark:border-amber-500/40' : undefined}>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2">
                  {n.priority === 'URGENT' && <Badge variant="pending">Urgent</Badge>}
                  <Badge variant="neutral">{audienceLabel(n.audience)}</Badge>
                  <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
                    {pktDateTime(n.createdAt)}
                  </span>
                </div>
                <h2 className="mt-2 text-base font-semibold">{n.title}</h2>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{n.body}</p>
                <p className="mt-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <Icon name="megaphone" size={14} /> {n.createdBy.name}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function audienceLabel(a: AnnouncementAudience): string {
  return a === 'ALL' ? 'Everyone' : a === 'PARENTS' ? 'Parents' : a === 'TEACHERS' ? 'Teachers' : a === 'STAFF' ? 'Staff' : 'Grades';
}
