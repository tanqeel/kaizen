import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { can, requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { childStudentIds } from '@/lib/parents';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { PrintButton } from '../exams/report-card/_components/print-button';

// Mon=1 … Sat=6 (dayOfWeek 0 = Sunday, which we don't print).
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** "08:30" → "8:30 AM" for readable display. */
function hhmm12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ sectionId?: string }>;
}) {
  const user = await requireUser();
  requirePagePermission(user.role, 'academics.view');
  const { sectionId: sectionIdParam } = await searchParams;

  // ---- Section scoping by role ----
  let allowedSectionIds: string[] | null = null; // null = all
  if (user.role === 'STUDENT') {
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { sectionId: true },
    });
    allowedSectionIds = student ? [student.sectionId] : [];
  } else if (user.role === 'PARENT') {
    const studentIds = await childStudentIds(user.id);
    const students = await prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { sectionId: true },
    });
    allowedSectionIds = [...new Set(students.map((s) => s.sectionId))];
  } else if (user.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: user.id },
      include: {
        timetableSlots: { select: { sectionId: true } },
        classSections: { select: { id: true } },
      },
    });
    allowedSectionIds = teacher
      ? [...new Set([...teacher.timetableSlots.map((s) => s.sectionId), ...teacher.classSections.map((s) => s.id)])]
      : [];
  }

  const sections = await prisma.section.findMany({
    ...(allowedSectionIds ? { where: { id: { in: allowedSectionIds } } } : {}),
    include: { grade: { select: { name: true, level: true } } },
    orderBy: [{ grade: { level: 'asc' } }, { name: 'asc' }],
  });

  const selectedSectionId =
    sectionIdParam && sections.some((s) => s.id === sectionIdParam)
      ? sectionIdParam
      : (sections[0]?.id ?? '');

  const slots = selectedSectionId
    ? await prisma.timetableSlot.findMany({
        where: { sectionId: selectedSectionId },
        orderBy: [{ dayOfWeek: 'asc' }, { periodNo: 'asc' }],
        include: {
          subject: { select: { name: true } },
          teacher: { include: { user: { select: { name: true } } } },
          section: { include: { grade: { select: { name: true } } } },
        },
      })
    : [];

  const sectionName = sections.find((s) => s.id === selectedSectionId)?.name ?? '';
  const gradeName =
    sections.find((s) => s.id === selectedSectionId)?.grade.name ?? '';

  // ---- Grid model: columns Mon..Sat (days 1..6), rows = periods ----
  const DAYS = [1, 2, 3, 4, 5, 6];
  const maxPeriod = slots.reduce((m, s) => Math.max(m, s.periodNo), 0);
  const periods = Array.from({ length: maxPeriod }, (_, i) => i + 1);
  const cell = new Map<string, (typeof slots)[number]>();
  for (const s of slots) cell.set(`${s.dayOfWeek}-${s.periodNo}`, s);
  const dayHasSlots = DAYS.filter((d) => slots.some((s) => s.dayOfWeek === d));

  return (
    <div>
      <PageHeader
        title="Class Timetable"
        subtitle={
          selectedSectionId
            ? `${sectionName} · ${gradeName}`
            : 'No sections available for your account.'
        }
        actions={
          <div className="no-print flex items-center gap-2">
            {can(user.role, 'academics.manage') && (
              <Link
                href="/academics"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Icon name="book-open" size={16} /> Edit Timetable
              </Link>
            )}
            <Link
              href={`/print/timetable?sectionId=${selectedSectionId}`}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-100 dark:border-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
            >
              <Icon name="printer" size={16} /> KAIZEN design
            </Link>
            <PrintButton />
          </div>
        }
      />

      {/* Section selector — hidden in print */}
      {sections.length > 1 && (
        <Card className="no-print mb-6">
          <CardContent>
            <form method="get" className="flex flex-wrap items-end gap-3">
              <Select
                label="Section"
                name="sectionId"
                defaultValue={selectedSectionId}
                options={sections.map((s) => ({
                  value: s.id,
                  label: `${s.name} — ${s.grade.name}`,
                }))}
                className="min-w-[240px] flex-1"
              />
              <Button type="submit" className="min-h-[44px]">
                <Icon name="search" size={16} /> View timetable
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {slots.length === 0 ? (
        <EmptyState
          icon="calendar-days"
          title="No timetable published yet"
          guidance={
            selectedSectionId
              ? `There is no published timetable for ${sectionName} yet.`
              : 'No sections are available for your account.'
          }
        />
      ) : (
        <>
          {/* Desktop grid */}
          <Card className="hidden md:block">
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <THead>
                  <TRow>
                    <TH>Period</TH>
                    {DAY_NAMES.map((d) => (
                      <TH key={d}>{d}</TH>
                    ))}
                  </TRow>
                </THead>
                <TBody>
                  {periods.map((p) => (
                    <TRow key={p}>
                      <TD className="whitespace-nowrap font-semibold">P{p}</TD>
                      {DAYS.map((d) => {
                        const slot = cell.get(`${d}-${p}`);
                        return (
                          <TD key={d} className="min-w-[140px] align-top">
                            {slot ? (
                              <div className="space-y-0.5">
                                <div className="font-medium text-slate-900 dark:text-white">
                                  {slot.subject.name}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {slot.teacher.user?.name ?? '—'}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {hhmm12(slot.startTime)} – {hhmm12(slot.endTime)}
                                </div>
                                {slot.room && (
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    Room {slot.room}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                            )}
                          </TD>
                        );
                      })}
                    </TRow>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile stacked day cards */}
          <div className="space-y-4 md:hidden">
            {dayHasSlots.map((d) => (
              <Card key={d}>
                <CardHeader>
                  <CardTitle>{DAY_NAMES[d - 1]}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {slots
                    .filter((s) => s.dayOfWeek === d)
                    .map((s) => (
                      <div
                        key={s.id}
                        className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0 dark:border-slate-800"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {s.subject.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {s.teacher.user?.name ?? '—'}
                            {s.room ? ` · Room ${s.room}` : ''}
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">
                          <div className="font-semibold">P{s.periodNo}</div>
                          <div>
                            {hhmm12(s.startTime)} – {hhmm12(s.endTime)}
                          </div>
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
