import { requireUser } from '@/lib/auth';
import { can, requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { ConfirmProvider } from '@/components/ui';
import { MaterialsClient } from './_components/materials-client';

/** /materials — study materials library. Teachers upload link-based materials; everyone reads (scoped). */
export default async function MaterialsPage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'materials.view');
  const canUpload = can(user.role, 'materials.manage');
  const isAdmin = user.role === 'PRINCIPAL' || user.role === 'SUPER_ADMIN';

  const [subjects, grades] = await Promise.all([
    prisma.subject.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    }),
    prisma.grade.findMany({
      select: {
        id: true,
        name: true,
        sections: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
      },
      orderBy: { level: 'asc' },
    }),
  ]);

  // Teachers may upload only for subjects they teach (allocation or timetable).
  let taughtSubjectIds: string[] | null = null;
  if (user.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: user.id },
      select: {
        allocations: { select: { subjectId: true } },
        timetableSlots: { select: { subjectId: true } },
      },
    });
    const ids = new Set<string>();
    for (const a of teacher?.allocations ?? []) ids.add(a.subjectId);
    for (const s of teacher?.timetableSlots ?? []) ids.add(s.subjectId);
    taughtSubjectIds = [...ids];
  }

  return (
    <ConfirmProvider>
      <MaterialsClient
        subjects={subjects.map((s) => ({ id: s.id, label: `${s.name} (${s.code})` }))}
        grades={grades.map((g) => ({ id: g.id, name: g.name, sections: g.sections }))}
        taughtSubjectIds={taughtSubjectIds}
        canUpload={canUpload}
        isAdmin={isAdmin}
      />
    </ConfirmProvider>
  );
}
