import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { getPrintSchool } from '../../_lib';
import { SalarySlipDoc } from './_doc';

export const dynamic = 'force-dynamic';

/** /print/salary-slip/[id] — printable salary slip. Own slip or payroll.manage. */
export default async function SalarySlipPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser().catch(() => null);
  if (!user) redirect('/login');
  const { id } = await params;
  const school = await getPrintSchool();

  const slip = await prisma.payslip.findUnique({
    where: { id },
    include: {
      teacher: {
        select: {
          id: true,
          employeeId: true,
          userId: true,
          hireDate: true,
          user: { select: { name: true } },
        },
      },
      staffMember: {
        select: {
          id: true,
          employeeId: true,
          userId: true,
          hireDate: true,
          designation: true,
          user: { select: { name: true } },
        },
      },
    },
  });
  if (!slip) redirect('/forbidden');

  // Scope: managers see all; others only their own slip.
  const isManager = ['SUPER_ADMIN', 'PRINCIPAL', 'ADMIN'].includes(user.role);
  const ownUserId = slip.teacher?.userId ?? slip.staffMember?.userId ?? null;
  if (!isManager && ownUserId !== user.id) redirect('/forbidden');

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const employeeName = slip.teacher?.user?.name ?? slip.staffMember?.user?.name ?? '—';
  const isTeacher = !!slip.teacher;
  const employeeId = slip.teacher?.employeeId ?? slip.staffMember?.employeeId ?? slip.id.slice(-4).toUpperCase();
  const hireDate = slip.teacher?.hireDate ?? slip.staffMember?.hireDate ?? null;

  return (
    <SalarySlipDoc
      school={school}
      slip={{
        monthLabel: `${MONTHS[slip.month - 1]} ${slip.year}`,
        employeeName,
        employeeId: `KZN-EMP-${employeeId.slice(-4).toUpperCase()}`,
        designation: isTeacher ? 'Teacher' : (slip.staffMember?.designation ?? 'Staff'),
        department: isTeacher ? 'Academics' : 'Administration',
        doj: hireDate ? hireDate.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
        bankAccount: '—',
        earnings: [{ label: 'Basic Salary', amount: slip.baseSalary }],
        totalEarnings: slip.baseSalary + slip.allowances,
        deductions: slip.deductions > 0 ? [{ label: 'Deductions', amount: slip.deductions }] : [],
        totalDeductions: slip.deductions,
        netPay: slip.netPay,
        status: slip.status,
      }}
    />
  );
}
