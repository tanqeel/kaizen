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
    // Teachers see only sections they're assigned to (via timetable slots or subject allocations).
    // Admins/principals see all sections.
    let sectionFilter = {};
    if (user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (teacher) {
        const [slots, allocations] = await Promise.all([
          prisma.timetableSlot.findMany({
            where: { teacherId: teacher.id },
            select: { sectionId: true },
            distinct: ['sectionId'],
          }),
          prisma.subjectAllocation.findMany({
            where: { teacherId: teacher.id },
            select: { gradeId: true },
            distinct: ['gradeId'],
          }),
        ]);
        const sectionIds = new Set(slots.map((s) => s.sectionId));
        const gradeIds = allocations.map((a) => a.gradeId);
        sectionFilter = {
          OR: [
            { id: { in: [...sectionIds] } },
            { gradeId: { in: gradeIds } },
          ],
        };
      } else {
        sectionFilter = { id: 'none' }; // Teacher record not found; show nothing.
      }
    }
    const secs = await prisma.section.findMany({
      where: sectionFilter,
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
