import { requireUser } from '@/lib/auth';
import { can, requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { childStudentIds } from '@/lib/parents';
import { todayPKT } from '@/lib/format';
import { ConfirmProvider } from '@/components/ui';
import { DiaryClient } from './_components/diary-client';

/** /diary — classwork/homework diary. Teachers write, everyone reads (scoped). */
export default async function DiaryPage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'diary.view');
  const canWrite = can(user.role, 'diary.manage');

  const [sections, subjects] = await Promise.all([
    prisma.section.findMany({
      select: { id: true, name: true, grade: { select: { name: true } } },
      orderBy: [{ grade: { level: 'asc' } }, { name: 'asc' }],
    }),
    prisma.subject.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  let readableIds: Set<string> | null = null; // null = all
  let writableIds: Set<string> | null = null;
  if (user.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: user.id },
      include: {
        timetableSlots: { select: { sectionId: true } },
        classSections: { select: { id: true } },
      },
    });
    const taught = new Set([
      ...(teacher?.timetableSlots.map((s) => s.sectionId) ?? []),
      ...(teacher?.classSections.map((s) => s.id) ?? []),
    ]);
    readableIds = taught;
    writableIds = taught;
  } else if (user.role === 'PARENT') {
    const kids = await childStudentIds(user.id);
    const studs = await prisma.student.findMany({
      where: { id: { in: kids } },
      select: { sectionId: true },
    });
    readableIds = new Set(studs.map((s) => s.sectionId));
    writableIds = new Set();
  } else if (user.role === 'STUDENT') {
    const student = await prisma.student.findUnique({ where: { userId: user.id }, select: { sectionId: true } });
    readableIds = new Set(student ? [student.sectionId] : []);
    writableIds = new Set();
  }

  const sectionsOpt = sections
    .filter((s) => readableIds === null || readableIds.has(s.id))
    .map((s) => ({
      id: s.id,
      label: `${s.grade.name} · Section ${s.name}`,
      writable: canWrite && (writableIds === null || writableIds.has(s.id)),
    }));

  return (
    <ConfirmProvider>
      <DiaryClient
        sections={sectionsOpt}
        subjects={subjects.map((s) => ({ id: s.id, label: `${s.name} (${s.code})` }))}
        canWrite={canWrite}
        today={todayPKT()}
      />
    </ConfirmProvider>
  );
}
