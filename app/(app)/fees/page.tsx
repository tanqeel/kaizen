import { requireUser } from '@/lib/auth';
import { can, requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { ConfirmProvider } from '@/components/ui';
import { FeesClient } from './_components/fees-client';

/** /fees — fee vouchers, collection, defaulters. finance.view to open, finance.manage to mutate. */
export default async function FeesPage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'finance.view');

  const grades = await prisma.grade.findMany({
    select: {
      id: true, name: true, level: true,
      sections: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
    },
    orderBy: { level: 'asc' },
  });

  return (
    <ConfirmProvider>
      <FeesClient canManage={can(user.role, 'finance.manage')} grades={grades} />
    </ConfirmProvider>
  );
}
