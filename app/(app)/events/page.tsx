import { requireUser } from '@/lib/auth';
import { can, requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { ConfirmProvider } from '@/components/ui';
import { EventsClient } from './_components/events-client';

/** /events — school events calendar. Everyone reads (audience-scoped); staff/principal/super-admin manage. */
export default async function EventsPage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'events.view');
  const canManage = can(user.role, 'events.manage');

  // Grade options for the create dialog (only needed by managers).
  const school = await prisma.school.findFirst({ select: { id: true } });
  const grades = school
    ? await prisma.grade.findMany({
        where: { schoolId: school.id },
        select: { id: true, name: true },
        orderBy: { level: 'asc' },
      })
    : [];

  return (
    <ConfirmProvider>
      <EventsClient grades={grades} canManage={canManage} />
    </ConfirmProvider>
  );
}
