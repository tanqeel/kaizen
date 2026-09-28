import { requireUser } from '@/lib/auth';
import { requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { ConfirmProvider } from '@/components/ui';
import { CommsClient } from './_components/comms-client';

/** /comms — announcements, notification log, SMS templates. comms.manage required. */
export default async function CommsPage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'comms.manage');

  const grades = await prisma.grade.findMany({
    select: { id: true, name: true, level: true },
    orderBy: { level: 'asc' },
  });

  return (
    <ConfirmProvider>
      <CommsClient grades={grades} />
    </ConfirmProvider>
  );
}
