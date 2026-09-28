import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { gradeBand, pctOf, remarkFor, teacherGradeIds, parentChildIds, ownStudentId } from '@/lib/exams';
import { pktDate } from '@/lib/format';
import { Badge, Card, CardContent, EmptyState, PageHeader, Table, TBody, TD, TH, THead, TRow } from '@/components/ui';
import { Icon } from '@/components/icons';
import { PrintButton } from './_components/print-button';

/**
 * /exams/report-card?studentId=&termId= — printable report card for one student
 * in one term. Same scoping as the API: parent → own children, student → self,
 * teacher → own grades, principal/super-admin → all. Only real entered results
 * are shown; subjects with no results are listed as "Not entered".
 */
export default async function ReportCardPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string; termId?: string }>;
}) {
  const user = await requireUser();
  requirePagePermission(user.role, 'exams.view');

  const { studentId, termId } = await searchParams;
  if (!studentId || !termId) notFound();

  const [student, term] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId }, include: { grade: true, section: true } }),
    prisma.examTerm.findUnique({ where: { id: termId }, include: { session: true } }),
  ]);
  if (!student || !term) notFound();

  // ── scoping (mirrors /api/exams/report-card) ──
  if (user.role === 'PARENT') {
    const kids = await parentChildIds(user.id);
    if (!kids.includes(studentId)) notFound();
  } else if (user.role === 'STUDENT') {
    const self = await ownStudentId(user.id);
    if (self !== studentId) notFound();
  } else if (user.role === 'TEACHER') {
    const own = await teacherGradeIds(user.id);
    if (!own.includes(student.gradeId)) notFound();
  }

  const [schedules, results, school] = await Promise.all([
    prisma.examSchedule.findMany({
      where: { examTermId: termId, gradeId: student.gradeId },
      include: { subject: true },
      orderBy: { date: 'asc' },
    }),
    prisma.examResult.findMany({ where: { studentId, examSchedule: { examTermId: termId } } }),
    prisma.school.findFirst(),
  ]);

  const bySchedule = new Map(results.map((r) => [r.examScheduleId, r]));
  const rows = schedules.map((s) => {
    const r = bySchedule.get(s.id);
    const pct = r ? pctOf(r.obtainedMarks, s.totalMarks) : null;
    return {
      subject: s.subject.name,
      obtained: r?.obtainedMarks ?? null,
      total: s.totalMarks,
      pct,
      grade: pct === null ? null : gradeBand(pct),
      remarks: r?.remarks ?? (pct === null ? null : remarkFor(pct)),
    };
  });
  const entered = rows.filter((r) => r.obtained !== null);
  const totalObtained = entered.reduce((n, r) => n + (r.obtained ?? 0), 0);
  const totalMarks = entered.reduce((n, r) => n + r.total, 0);
  const overallPct = entered.length > 0 ? pctOf(totalObtained, totalMarks) : null;

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/portal"
          className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
        >
          <Icon name="arrow-left" size={16} /> Back
        </Link>
        <PrintButton />
      </div>

      <PageHeader
        title="Report card"
        subtitle={`${term.name} · ${term.session.name}`}
        className="no-print"
      />

      {/* Printable sheet */}
      <div className="mx-auto max-w-3xl rounded-xl border border-slate-300 bg-white p-6 text-slate-900 sm:p-10 dark:border-slate-700 dark:bg-white dark:text-slate-900 print:m-0 print:max-w-none print:rounded-none print:border-0 print:p-0">
        <div className="border-b-2 border-slate-900 pb-4 text-center">
          <h1 className="text-2xl font-bold">{school?.name ?? 'Kaizen Model School'}</h1>
          {(school?.address || school?.phone) && (
            <p className="mt-1 text-sm text-slate-600">
              {[school?.address, school?.phone].filter(Boolean).join(' · ')}
            </p>
          )}
          <p className="mt-2 text-sm font-semibold uppercase tracking-wide">
            Report card — {term.name}
          </p>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-xs uppercase tracking-wide text-slate-500">Student</dt><dd className="font-semibold">{student.name}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-slate-500">Admission No</dt><dd className="font-semibold">{student.admissionNo}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-slate-500">Class</dt><dd className="font-semibold">{student.grade.name} · {student.section.name}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-slate-500">Session</dt><dd className="font-semibold">{term.session.name}</dd></div>
        </dl>

        <div className="mt-6">
          {rows.length === 0 ? (
            <EmptyState icon="award" title="No papers scheduled" guidance="No exam papers were scheduled for this grade in this term." />
          ) : (
            <Table>
              <THead>
                <TRow>
                  <TH>Subject</TH>
                  <TH>Obtained</TH>
                  <TH>Total</TH>
                  <TH>%</TH>
                  <TH>Grade</TH>
                  <TH>Remarks</TH>
                </TRow>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TRow key={r.subject}>
                    <TD className="font-medium">{r.subject}</TD>
                    <TD className="tnum">{r.obtained ?? <span className="text-slate-400">Not entered</span>}</TD>
                    <TD className="tnum">{r.total}</TD>
                    <TD className="tnum">{r.pct ?? '—'}</TD>
                    <TD>{r.grade ?? '—'}</TD>
                    <TD className="max-w-[200px]">{r.remarks ?? '—'}</TD>
                  </TRow>
                ))}
                {overallPct !== null && (
                  <TRow>
                    <TD className="font-bold">Total</TD>
                    <TD className="tnum font-bold">{totalObtained}</TD>
                    <TD className="tnum font-bold">{totalMarks}</TD>
                    <TD className="tnum font-bold">{overallPct}%</TD>
                    <TD><Badge variant={gradeBand(overallPct) === 'F' ? 'absent' : 'info'}>{gradeBand(overallPct)}</Badge></TD>
                    <TD className="text-sm">{remarkFor(overallPct)}</TD>
                  </TRow>
                )}
              </TBody>
            </Table>
          )}
        </div>

        <div className="mt-10 grid grid-cols-2 gap-8 text-center text-sm">
          <div><div className="border-t border-slate-900 pt-1">Class teacher</div></div>
          <div><div className="border-t border-slate-900 pt-1">Principal</div></div>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">Generated {pktDate(new Date().toISOString().slice(0, 10))} · Kaizen School Management System</p>
      </div>
    </div>
  );
}
