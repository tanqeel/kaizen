import { requireUser } from '@/lib/auth';
import { can, requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { PageHeader, ConfirmProvider } from '@/components/ui';
import { AttendanceTabs, type AttendanceSection } from './tabs';

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  requirePagePermission(user.role, 'attendance.view');

  const canGate = can(user.role, 'attendance.gate');
  const canPeriod = can(user.role, 'attendance.period');
  const canConflicts = can(user.role, 'attendance.conflicts');

  const { tab } = await searchParams;
  const defaultTab = tab === 'conflicts' && canConflicts ? 'conflicts' : tab === 'period' && canPeriod ? 'period' : 'gate';

  let sections: AttendanceSection[] = [];
  if (canPeriod) {
    const secs = await prisma.section.findMany({
      include: { grade: { select: { name: true } } },
      orderBy: [{ grade: { level: 'asc' } }, { name: 'asc' }],
    });
    sections = secs.map((s) => ({ id: s.id, label: `${s.grade.name} – Section ${s.name}` }));
  }

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Dual-tier: biometric gate check-ins cross-checked against per-period lecture registers. PENDING marks are never treated as absent."
      />
      <ConfirmProvider>
        <AttendanceTabs
          canGate={canGate}
          canPeriod={canPeriod}
          canConflicts={canConflicts}
          sections={sections}
          defaultTab={defaultTab}
        />
      </ConfirmProvider>
    </div>
  );
}
