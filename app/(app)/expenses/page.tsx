import { requireUser } from '@/lib/auth';
import { requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { ConfirmProvider } from '@/components/ui';
import { ExpensesClient } from './_components/expenses-client';

/** /expenses — expenses, budgets, P&L. finance.manage required. */
export default async function ExpensesPage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'finance.manage');

  const school = await prisma.school.findFirst({ select: { id: true } });
  const [heads, sources] = school
    ? await Promise.all([
        prisma.expenseHead.findMany({
          where: { schoolId: school.id },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        }),
        prisma.paymentSource.findMany({
          where: { schoolId: school.id },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        }),
      ])
    : [[], []];

  return (
    <ConfirmProvider>
      <ExpensesClient heads={heads} sources={sources} />
    </ConfirmProvider>
  );
}
