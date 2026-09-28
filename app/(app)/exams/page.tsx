import { requireUser } from '@/lib/auth';
import { can, requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { teacherGradeIds } from '@/lib/exams';
import { ConfirmProvider, PageHeader } from '@/components/ui';
import { ExamsClient } from './ExamsClient';

export default async function ExamsPage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'exams.view');
  const canManage = can(user.role, 'exams.manage');

  const [terms, subjects, grades] = await Promise.all([
    prisma.examTerm.findMany({ orderBy: { startDate: 'desc' } }),
    prisma.subject.findMany({ orderBy: { name: 'asc' } }),
    prisma.grade.findMany({ orderBy: { level: 'asc' } }),
  ]);

  // Teachers only work with grades they teach — filter their selectors honestly.
  const manageableGradeIds =
    user.role === 'TEACHER' && canManage ? await teacherGradeIds(user.id) : null;

  return (
    <div>
      <PageHeader
        title="Exams & Results"
        subtitle="Exam terms, date sheets, result entry and report cards."
        className="no-print"
      />
      <ConfirmProvider>
        <ExamsClient
          canManage={canManage}
          manageableGradeIds={manageableGradeIds}
          initialTerms={terms.map((t) => ({
            id: t.id,
            name: t.name,
            startDate: t.startDate.toISOString().slice(0, 10),
            endDate: t.endDate.toISOString().slice(0, 10),
          }))}
          subjects={subjects.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
          grades={grades.map((g) => ({ id: g.id, name: g.name, level: g.level }))}
        />
      </ConfirmProvider>
    </div>
  );
}
