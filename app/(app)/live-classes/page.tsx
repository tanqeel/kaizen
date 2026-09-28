import { requireUser } from '@/lib/auth';
import { can, requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { ConfirmProvider } from '@/components/ui';
import { LiveClassesClient } from './_components/live-classes-client';

interface Option { id: string; label: string; }

const sectionLabel = (gradeName: string, sectionName: string) => `${gradeName} · Section ${sectionName}`;

/** /live-classes — scheduled online classes. Managers get the schedule dialog
 *  with section/subject options fetched server-side. */
export default async function LiveClassesPage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'liveclasses.view');
  const canManage = can(user.role, 'liveclasses.manage');
  const isAdmin = user.role === 'PRINCIPAL' || user.role === 'SUPER_ADMIN';

  let sections: Option[] = [];
  let subjects: Option[] = [];
  let teachers: Option[] = [];
  let myTeacherId: string | null = null;

  if (canManage) {
    const school = await prisma.school.findFirst({ select: { id: true } });
    const schoolId = school?.id;

    if (user.role === 'TEACHER') {
      // Teachers may schedule only for sections/subjects they teach.
      const teacher = await prisma.teacher.findUnique({
        where: { userId: user.id },
        select: {
          id: true,
          allocations: { select: { subjectId: true } },
          timetableSlots: {
            select: {
              subjectId: true,
              section: { select: { id: true, name: true, grade: { select: { name: true } } } },
            },
          },
          classSections: { select: { id: true, name: true, grade: { select: { name: true } } } },
        },
      });
      if (teacher) {
        myTeacherId = teacher.id;
        const sectionMap = new Map<string, string>();
        for (const s of teacher.classSections) sectionMap.set(s.id, sectionLabel(s.grade.name, s.name));
        for (const slot of teacher.timetableSlots) {
          sectionMap.set(slot.section.id, sectionLabel(slot.section.grade.name, slot.section.name));
        }
        sections = [...sectionMap.entries()]
          .map(([id, label]) => ({ id, label }))
          .sort((a, b) => a.label.localeCompare(b.label));

        const taughtSubjectIds = new Set<string>([
          ...teacher.allocations.map((a) => a.subjectId),
          ...teacher.timetableSlots.map((s) => s.subjectId),
        ]);
        if (taughtSubjectIds.size > 0 && schoolId) {
          const subs = await prisma.subject.findMany({
            where: { id: { in: [...taughtSubjectIds] }, schoolId },
            select: { id: true, name: true, code: true },
            orderBy: { name: 'asc' },
          });
          subjects = subs.map((s) => ({ id: s.id, label: `${s.name} (${s.code})` }));
        }
      }
    } else if (isAdmin && schoolId) {
      const [allSections, allSubjects, allTeachers, me] = await Promise.all([
        prisma.section.findMany({
          where: { grade: { schoolId } },
          select: { id: true, name: true, grade: { select: { name: true, level: true } } },
        }),
        prisma.subject.findMany({
          where: { schoolId },
          select: { id: true, name: true, code: true },
          orderBy: { name: 'asc' },
        }),
        prisma.teacher.findMany({
          where: { isActive: true },
          select: { id: true, user: { select: { name: true } } },
          orderBy: { employeeId: 'asc' },
        }),
        prisma.teacher.findUnique({ where: { userId: user.id }, select: { id: true } }),
      ]);
      sections = allSections
        .map((s) => ({ id: s.id, label: sectionLabel(s.grade.name, s.name), level: s.grade.level }))
        .sort((a, b) => a.level - b.level || a.label.localeCompare(b.label))
        .map(({ id, label }) => ({ id, label }));
      subjects = allSubjects.map((s) => ({ id: s.id, label: `${s.name} (${s.code})` }));
      teachers = allTeachers.map((t) => ({ id: t.id, label: t.user?.name ?? 'Teacher' }));
      myTeacherId = me?.id ?? null;
    }
  }

  return (
    <ConfirmProvider>
      <LiveClassesClient
        sections={sections}
        subjects={subjects}
        teachers={teachers}
        myTeacherId={myTeacherId}
        canManage={canManage}
        isAdmin={isAdmin}
      />
    </ConfirmProvider>
  );
}
