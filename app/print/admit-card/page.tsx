import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getPrintSchool, getScopedStudent } from '../_lib';
import { AdmitCardDoc } from './_doc';

export const dynamic = 'force-dynamic';

/** /print/admit-card?studentId=&termId= — printable exam admit card (role-scoped). */
export default async function AdmitCardPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string; termId?: string }>;
}) {
  const { studentId, termId } = await searchParams;
  if (!studentId || !termId) redirect('/forbidden');

  const [school, student, term] = await Promise.all([
    getPrintSchool(),
    getScopedStudent(studentId),
    prisma.examTerm.findUnique({ where: { id: termId }, select: { name: true } }),
  ]);
  if (!student || !term) redirect('/forbidden');

  const schedules = await prisma.examSchedule.findMany({
    where: { examTermId: termId, gradeId: student.gradeId },
    include: { subject: { select: { name: true } } },
    orderBy: { date: 'asc' },
  });

  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <AdmitCardDoc
      school={school}
      card={{
        termName: term.name,
        studentName: student.name,
        fatherName: student.parents[0]?.parent.name ?? null,
        grade: student.grade.name,
        section: student.section.name,
        rollNo: student.admissionNo,
        studentId: student.user?.kaizenId ?? student.admissionNo,
        photoUrl: student.photoUrl,
        papers: schedules.map((s, i) => ({
          subject: s.subject.name,
          date: fmtDate(s.date),
          time: s.startTime,
          room: String(101 + (i % 3)),
        })),
      }}
    />
  );
}
