import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { gradeBand, pctOf } from '@/lib/exams';
import { getPrintSchool, getScopedStudent } from '../_lib';
import { ResultCardDoc } from './_doc';

export const dynamic = 'force-dynamic';

/** /print/result-card?studentId=&termId= — printable result card (role-scoped). */
export default async function ResultCardPage({
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
    include: {
      subject: { select: { name: true } },
      results: { where: { studentId }, select: { obtainedMarks: true, remarks: true } },
    },
    orderBy: { date: 'asc' },
  });

  const subjects = schedules.map((s) => {
    const r = s.results[0];
    const obtained = r?.obtainedMarks ?? 0;
    return {
      name: s.subject.name,
      total: s.totalMarks,
      obtained,
      grade: gradeBand(pctOf(obtained, s.totalMarks)),
      remarks: r?.remarks ?? null,
    };
  });

  const totalMarks = subjects.reduce((a, s) => a + s.total, 0);
  const obtainedMarks = subjects.reduce((a, s) => a + s.obtained, 0);
  const pct = pctOf(obtainedMarks, totalMarks);

  // Position: rank by total obtained among classmates in this term.
  let position = '—';
  if (schedules.length > 0) {
    const totals = await prisma.examResult.groupBy({
      by: ['studentId'],
      where: { examScheduleId: { in: schedules.map((s) => s.id) } },
      _sum: { obtainedMarks: true },
      orderBy: { _sum: { obtainedMarks: 'desc' } },
    });
    const rank = totals.findIndex((t) => t.studentId === studentId);
    if (rank >= 0) {
      const n = rank + 1;
      position = `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
    }
  }

  const remark =
    subjects.find((s) => s.remarks)?.remarks ??
    (pct >= 90 ? 'Outstanding performance. Keep it up!'
      : pct >= 80 ? 'Excellent performance. Keep it up!'
      : pct >= 70 ? 'Good work. Aim higher next term.'
      : pct >= 60 ? 'Satisfactory. More effort needed.'
      : pct >= 50 ? 'Needs improvement. Work harder.'
      : 'Poor performance. Serious effort required.');

  return (
    <ResultCardDoc
      school={school}
      card={{
        termName: term.name,
        studentName: student.name,
        fatherName: student.parents[0]?.parent.name ?? null,
        grade: student.grade.name,
        section: student.section.name,
        studentId: student.user?.kaizenId ?? student.admissionNo,
        session: student.session.name,
        photoUrl: student.photoUrl,
        subjects,
        totalMarks,
        obtainedMarks,
        percentage: `${pct.toFixed(1)}%`,
        overallGrade: gradeBand(pct),
        position,
        remarks: remark,
      }}
    />
  );
}
