import { requireUser } from '@/lib/auth';
import { requirePagePermission, can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/ui';
import { StudentDirectoryClient } from './directory-client';

export default async function StudentsPage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'students.view');

  const grades = await prisma.grade.findMany({
    include: { sections: { select: { id: true, name: true }, orderBy: { name: 'asc' } } },
    orderBy: { level: 'asc' },
  });
  const [shifts, sessions] = await Promise.all([
    prisma.shift.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.academicSession.findMany({ select: { id: true, name: true }, orderBy: { name: 'desc' } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle="Directory of active students with today's gate status. Select a student for the full profile."
      />
      <StudentDirectoryClient
        grades={grades.map((g) => ({
          id: g.id,
          name: g.name,
          sections: g.sections,
        }))}
        shifts={shifts}
        sessions={sessions}
        canManage={can(user.role, 'students.manage')}
      />
    </div>
  );
}
