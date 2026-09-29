import { requireUser } from '@/lib/auth';
import { requirePagePermission } from '@/lib/rbac';
import { PageHeader } from '@/components/ui';
import { RegistrationsClient } from './_components/registrations-client';

/** /registrations — review self-registration requests. Principal / Super Admin only. */
export default async function RegistrationsPage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'users.manage');

  return (
    <div>
      <PageHeader
        title="Registration Requests"
        subtitle="Review self-registration requests. Approved users get a unique KAIZEN ID."
      />
      <RegistrationsClient />
    </div>
  );
}
