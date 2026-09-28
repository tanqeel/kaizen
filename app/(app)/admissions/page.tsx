import { requireUser } from '@/lib/auth';
import { can, requirePagePermission } from '@/lib/rbac';
import { PageHeader, ConfirmProvider } from '@/components/ui';
import { AdmissionsClient } from './_components/admissions-client';

export default async function AdmissionsPage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'admissions.view');
  const canDecide = can(user.role, 'admissions.manage');

  return (
    <div>
      <PageHeader
        title="Admissions"
        subtitle="Review admission applications from the public form. Approve to enrol the applicant as a student."
      />
      <ConfirmProvider>
        <AdmissionsClient canDecide={canDecide} />
      </ConfirmProvider>
    </div>
  );
}
