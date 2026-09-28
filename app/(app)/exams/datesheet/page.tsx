import { requireUser } from '@/lib/auth';
import { requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { pktDate } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TRow,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { PrintButton } from '../report-card/_components/print-button';

const WEEKDAY = new Intl.DateTimeFormat('en-PK', {
  timeZone: 'Asia/Karachi',
  weekday: 'long',
});

function dayName(d: Date): string {
  return WEEKDAY.format(d);
}

export default async function DatesheetPage({
  searchParams,
}: {
  searchParams: Promise<{ termId?: string; gradeId?: string }>;
}) {
  const user = await requireUser();
  requirePagePermission(user.role, 'exams.view');
  const { termId, gradeId } = await searchParams;

  // Current academic session (fall back to the newest one if none is flagged).
  const session =
    (await prisma.academicSession.findFirst({
      where: { isCurrent: true },
      orderBy: { startDate: 'desc' },
    })) ??
    (await prisma.academicSession.findFirst({ orderBy: { startDate: 'desc' } }));

  const [terms, grades] = await Promise.all([
    session
      ? prisma.examTerm.findMany({
          where: { sessionId: session.id },
          orderBy: { startDate: 'desc' },
        })
      : [],
    prisma.grade.findMany({ orderBy: { level: 'asc' } }),
  ]);

  const selectedTermId =
    termId && terms.some((t) => t.id === termId) ? termId : (terms[0]?.id ?? '');
  const selectedGradeId =
    gradeId && grades.some((g) => g.id === gradeId) ? gradeId : (grades[0]?.id ?? '');

  const schedules =
    selectedTermId && selectedGradeId
      ? await prisma.examSchedule.findMany({
          where: { examTermId: selectedTermId, gradeId: selectedGradeId },
          orderBy: { date: 'asc' },
          include: {
            examTerm: { select: { name: true } },
            subject: { select: { name: true, code: true } },
            grade: { select: { name: true } },
          },
        })
      : [];

  const termName = terms.find((t) => t.id === selectedTermId)?.name ?? '';
  const gradeName = grades.find((g) => g.id === selectedGradeId)?.name ?? '';

  return (
    <div>
      <PageHeader
        title="Exam Date Sheet"
        subtitle={
          schedules.length > 0
            ? `${termName} · ${gradeName} — ${session?.name ?? ''}`.replace(/\s—\s$/, '')
            : 'Pick a term and grade to view the published date sheet.'
        }
        actions={
          <div className="no-print">
            <PrintButton />
          </div>
        }
      />

      {/* Selector — hidden in print */}
      <Card className="no-print mb-6">
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <Select
              label="Exam term"
              name="termId"
              defaultValue={selectedTermId}
              options={terms.map((t) => ({ value: t.id, label: t.name }))}
              className="min-w-[200px] flex-1"
            />
            <Select
              label="Grade"
              name="gradeId"
              defaultValue={selectedGradeId}
              options={grades.map((g) => ({ value: g.id, label: g.name }))}
              className="min-w-[200px] flex-1"
            />
            <Button type="submit" className="min-h-[44px]">
              <Icon name="search" size={16} /> View date sheet
            </Button>
          </form>
        </CardContent>
      </Card>

      {schedules.length === 0 ? (
        <EmptyState
          icon="calendar-days"
          title="No date sheet published yet"
          guidance={
            selectedTermId && selectedGradeId
              ? `There is no published schedule for ${termName || 'this term'} — ${gradeName || 'this grade'} yet.`
              : 'No exam terms or grades exist yet.'
          }
        />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <THead>
                <TRow>
                  <TH>Date</TH>
                  <TH>Day</TH>
                  <TH>Subject</TH>
                  <TH>Start time</TH>
                  <TH className="text-right">Total marks</TH>
                </TRow>
              </THead>
              <TBody>
                {schedules.map((s) => (
                  <TRow key={s.id}>
                    <TD className="whitespace-nowrap font-medium">{pktDate(s.date)}</TD>
                    <TD className="whitespace-nowrap">{dayName(s.date)}</TD>
                    <TD>
                      <span className="font-medium">{s.subject.name}</span>{' '}
                      <Badge variant="neutral">{s.subject.code}</Badge>
                    </TD>
                    <TD className="whitespace-nowrap">{s.startTime}</TD>
                    <TD className="text-right">{s.totalMarks}</TD>
                  </TRow>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
