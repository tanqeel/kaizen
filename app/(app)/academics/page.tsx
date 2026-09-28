import { requireUser } from '@/lib/auth';
import { can, requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { ConfirmProvider, PageHeader } from '@/components/ui';
import { AcademicsClient } from './AcademicsClient';

export default async function AcademicsPage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'academics.view');
  const canManage = can(user.role, 'academics.manage');

  const [grades, subjects, allocations, teachers] = await Promise.all([
    prisma.grade.findMany({
      include: {
        sections: {
          include: {
            classTeacher: { include: { user: true } },
            _count: { select: { students: true, timetableSlots: true } },
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { level: 'asc' },
    }),
    prisma.subject.findMany({
      include: {
        _count: { select: { allocations: true, timetableSlots: true, examSchedules: true, periodAttendance: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.subjectAllocation.findMany({
      include: { subject: true, grade: true, teacher: { include: { user: true } } },
      orderBy: [{ grade: { level: 'asc' } }, { subject: { name: 'asc' } }],
    }),
    prisma.teacher.findMany({
      where: { isActive: true },
      include: { user: true },
      orderBy: { user: { name: 'asc' } },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Academics"
        subtitle="Grades, sections, subjects, teacher allocations and the weekly timetable."
      />
      <ConfirmProvider>
        <AcademicsClient
          canManage={canManage}
          initialGrades={grades.map((g) => ({
            id: g.id,
            level: g.level,
            name: g.name,
            sections: g.sections.map((s) => ({
              id: s.id,
              name: s.name,
              room: s.room,
              classTeacher: s.classTeacher?.user?.name ?? null,
              classTeacherId: s.classTeacherId,
              studentCount: s._count.students,
              slotCount: s._count.timetableSlots,
            })),
          }))}
          initialSubjects={subjects.map((s) => ({
            id: s.id,
            name: s.name,
            code: s.code,
            inUse:
              s._count.allocations + s._count.timetableSlots + s._count.examSchedules + s._count.periodAttendance > 0,
          }))}
          initialAllocations={allocations.map((a) => ({
            id: a.id,
            subjectId: a.subjectId,
            subject: a.subject.name,
            subjectCode: a.subject.code,
            gradeId: a.gradeId,
            grade: a.grade.name,
            teacherId: a.teacherId,
            teacher: a.teacher.user?.name ?? 'Teacher',
            periodsPerWeek: a.periodsPerWeek,
          }))}
          teachers={teachers.map((t) => ({ id: t.id, name: t.user?.name ?? 'Teacher' }))}
        />
      </ConfirmProvider>
    </div>
  );
}
