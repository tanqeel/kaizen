import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/ui';
import { SecurityClient } from './_components/security-client';

/** /security — change your own password. Forced on first login after admin reset. */
export default async function SecurityPage() {
  const user = await requireUser();
  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: { forcePasswordReset: true },
  });
  if (!full) redirect('/login');

  return (
    <div>
      <PageHeader title="Security" subtitle="Keep your account safe with a strong, private password." />
      <SecurityClient mustReset={full.forcePasswordReset} />
    </div>
  );
}
