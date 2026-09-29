import Link from 'next/link';
import { notFound, forbidden } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { can, requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { pktDateTime } from '@/lib/format';
import { monthLabel } from '@/lib/fees';
import { PageHeader } from '@/components/ui';
import { Icon } from '@/components/icons';
import { PayslipPrinter } from './_components/payslip-printer';

/** /payroll/[id] — printable salary payslip. payroll.view; non-managers see only their own. */
export default async function PayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  requirePagePermission(user.role, 'payroll.view');

  const { id } = await params;
  const slip = await prisma.payslip.findUnique({
    where: { id },
    include: {
      teacher: { select: { employeeId: true, userId: true, user: { select: { name: true } } } },
      staffMember: {
        select: { employeeId: true, designation: true, userId: true, user: { select: { name: true } } },
      },
    },
  });
  if (!slip) notFound();

  if (!can(user.role, 'payroll.manage')) {
    const ownTeacher = slip.teacher?.userId === user.id;
    const ownStaff = slip.staffMember?.userId === user.id;
    if (!ownTeacher && !ownStaff) forbidden();
  }

  const school = await prisma.school.findFirst();

  const isTeacher = !!slip.teacher;
  const person = isTeacher ? slip.teacher! : slip.staffMember!;

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/payroll"
          className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
        >
          <Icon name="arrow-left" size={16} /> Back to payroll
        </Link>
      </div>
      <PageHeader
        title="Salary payslip"
        subtitle={`${person.user?.name ?? person.employeeId} · ${monthLabel(slip.month, slip.year)}`}
        actions={
          <Link
            href={`/print/salary-slip/${slip.id}`}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-100 dark:border-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
          >
            <Icon name="printer" size={16} /> KAIZEN design
          </Link>
        }
      />
      <PayslipPrinter
        schoolName={school?.name ?? 'Kaizen Model School'}
        schoolAddress={school?.address}
        schoolPhone={school?.phone}
        slip={{
          slipNo: slip.id.slice(-8).toUpperCase(),
          monthLabel: monthLabel(slip.month, slip.year),
          person: {
            name: person.user?.name ?? person.employeeId,
            role: isTeacher ? 'Teacher' : `Staff${slip.staffMember?.designation ? ` · ${slip.staffMember.designation}` : ''}`,
            employeeId: person.employeeId,
          },
          baseSalary: slip.baseSalary,
          allowances: slip.allowances,
          deductions: slip.deductions,
          netPay: slip.netPay,
          status: slip.status,
          generatedAt: pktDateTime(slip.createdAt),
          paidAt: slip.paidAt ? pktDateTime(slip.paidAt) : null,
        }}
      />
    </div>
  );
}
