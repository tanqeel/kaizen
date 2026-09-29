import { requireUser } from '@/lib/auth';
import { requirePagePermission, can } from '@/lib/rbac';
import { PageHeader } from '@/components/ui';
import { UsersClient } from './_components/users-client';

/** /users — identity & account management. Principal / Admin / Super Admin. */
export default async function UsersPage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'users.manage');

  return (
    <div>
      <PageHeader
        title="Users & Identities"
        subtitle="Every person, one secure identity. Manage KAIZEN IDs, account status, and password resets."
      />
      <UsersClient canManage={can(user.role, 'users.manage')} />
    </div>
  );
}
