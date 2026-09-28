import { requireUser } from '@/lib/auth';
import { can, requirePagePermission } from '@/lib/rbac';
import { PageHeader } from '@/components/ui';
import { PayrollClient } from './_components/payroll-client';

/** /payroll — payroll listing + generation. payroll.view; teachers/staff see only their own. */
export default async function PayrollPage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'payroll.view');

  return (
    <div>
      <PageHeader
        title="Payroll"
        subtitle="Generate monthly payslips, adjust allowances/deductions, and mark salaries paid."
      />
      <PayrollClient canManage={can(user.role, 'payroll.manage')} />
    </div>
  );
}
