import Link from 'next/link';
import { forbidden } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { getPortalSummary, PortalError, type JourneyStatus } from '@/lib/portal';
import { pktTime, pktDate, pkr } from '@/lib/format';
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader, Stat, Table, THead, TH, TBody, TRow, TD } from '@/components/ui';
import { Icon } from '@/components/icons';
import { SupportPicker } from './SupportPicker';

const JOURNEY_BADGE: Record<JourneyStatus, { variant: 'present' | 'absent' | 'pending' | 'neutral'; label: string }> = {
  PRESENT: { variant: 'present', label: 'Present' },
  ABSENT: { variant: 'absent', label: 'Absent' },
  PENDING: { variant: 'pending', label: 'Pending' },
  NOT_MARKED: { variant: 'neutral', label: 'Not marked yet' },
};

const STATUS_BADGE: Record<string, 'paid' | 'pending' | 'unpaid' | 'overdue'> = {
  PAID: 'paid',
  PARTIAL: 'pending',
  UNPAID: 'unpaid',
  OVERDUE: 'overdue',
};

function fmtTimeRange(start: string, end: string): string {
  // "08:00"–"08:50" → "8:00 AM – 8:50 AM"
  const f = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ap = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
  };
  return `${f(start)} – ${f(end)}`;
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const user = await requireUser();
  const isSupport = user.role === 'SUPER_ADMIN' || user.role === 'PRINCIPAL';
  if (!can(user.role, 'portal.view') && !isSupport) forbidden();

  const { studentId } = await searchParams;

  // Support mode without a selected child: show the picker, no summary.
  if (isSupport && !studentId) {
    return (
      <div>
        <PageHeader
          title="Parent Portal"
          subtitle="Support view — pick a child to see exactly what their parent sees."
        />
        <SupportPicker />
      </div>
    );
  }

  let summary = null;
  let loadError: string | null = null;
  try {
    summary = await getPortalSummary({ id: user.id, role: user.role }, studentId);
  } catch (e) {
    if (e instanceof PortalError) loadError = e.message;
    else throw e;
  }

  if (!summary) {
    return (
      <div>
        <PageHeader title="Parent Portal" />
        <EmptyState icon="alert-triangle" title="Could not load portal" guidance={loadError ?? 'Unknown error.'} />
      </div>
    );
  }

  const { student, children, campus, journey, fees, exams, notificationsNote } = summary;

  return (
    <div>
      <PageHeader
        title="Parent Portal"
        subtitle={`${student.name} · ${student.grade} - ${student.section} · ${student.admissionNo} · ${pktDate(summary.date)}`}
      />

      {/* Child selector (parents with several children) / support banner */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {children.length > 1 &&
          children.map((c) => (
            <Link
              key={c.id}
              href={`/portal?studentId=${c.id}`}
              aria-current={c.id === student.id ? 'page' : undefined}
              className={
                c.id === student.id
                  ? 'inline-flex min-h-[44px] items-center rounded-full bg-brand-600 px-4 text-sm font-semibold text-white dark:bg-brand-500'
                  : 'inline-flex min-h-[44px] items-center rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
              }
            >
              {c.name}
            </Link>
          ))}
        {isSupport && (
          <Link
            href="/portal"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-dashed border-slate-300 px-4 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
          >
            <Icon name="arrow-left" size={16} /> Back to child search
          </Link>
        )}
        {isSupport && (
          <Badge variant="info" className="ml-1">
            Support view — read-only, as the parent sees it
          </Badge>
        )}
      </div>

      {/* Live campus status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Live campus status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <div className="flex items-center gap-3">
              <span
                className={
                  campus.atSchool
                    ? 'flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }
              >
                <Icon name="fingerprint" size={24} />
              </span>
              <div>
                <Badge variant={campus.atSchool ? 'present' : 'neutral'} className="text-sm">
                  {campus.atSchool ? 'AT SCHOOL' : campus.checkedOut ? 'DISMISSED' : 'NOT AT SCHOOL'}
                </Badge>
                <p className="tnum mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {campus.atSchool && campus.arrivalTime
                    ? `Arrived ${pktTime(campus.arrivalTime)}${campus.arrivalMethod ? ` · ${campus.arrivalMethod}` : ''}`
                    : campus.checkedOut && campus.checkoutTime
                      ? `Was at school · checked out ${pktTime(campus.checkoutTime)}`
                      : 'No gate check-in recorded today.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <Icon name="log-out" size={24} />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Dismissal</p>
                <p className="tnum mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                  {campus.checkedOut && campus.checkoutTime
                    ? `Checked out ${pktTime(campus.checkoutTime)}`
                    : 'Not checked out yet'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subject journey timeline */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Today&apos;s subject journey</CardTitle>
        </CardHeader>
        <CardContent>
          {journey.length === 0 ? (
            <EmptyState
              icon="calendar-days"
              title="No classes timetabled today"
              guidance="There are no periods scheduled for this section today (school day off or timetable not set)."
            />
          ) : (
            <ol className="divide-y divide-slate-200 dark:divide-slate-800">
              {journey.map((j) => {
                const b = JOURNEY_BADGE[j.status];
                return (
                  <li key={j.periodNo} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    <span className="tnum flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {j.periodNo}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {j.subject}
                        <span className="ml-2 text-xs font-medium text-slate-400">{j.subjectCode}</span>
                      </p>
                      <p className="tnum mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                        {fmtTimeRange(j.startTime, j.endTime)} · {j.teacher}
                        {j.room ? ` · Room ${j.room}` : ''}
                      </p>
                    </div>
                    <Badge variant={b.variant}>{b.label}</Badge>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            “Pending” means the teacher has not submitted the register yet — it is not an absence.
          </p>
        </CardContent>
      </Card>

      {/* Fee snapshot */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Fee vouchers</CardTitle>
            </CardHeader>
            <CardContent>
              {fees.vouchers.length === 0 ? (
                <EmptyState
                  icon="wallet"
                  title="No fee vouchers yet"
                  guidance="No vouchers have been issued for this child in the current session."
                />
              ) : (
                <Table>
                  <THead>
                    <TRow>
                      <TH>Month</TH>
                      <TH>Total</TH>
                      <TH>Paid</TH>
                      <TH>Balance</TH>
                      <TH>Status</TH>
                    </TRow>
                  </THead>
                  <TBody>
                    {fees.vouchers.map((v) => (
                      <TRow key={v.id}>
                        <TD className="font-medium">{v.monthLabel}</TD>
                        <TD className="tnum">{pkr(v.totalAmount)}</TD>
                        <TD className="tnum">{pkr(v.paidAmount)}</TD>
                        <TD className="tnum font-semibold">{pkr(v.balance)}</TD>
                        <TD>
                          <Badge variant={STATUS_BADGE[v.status] ?? 'neutral'}>{v.status}</Badge>
                        </TD>
                      </TRow>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
        <Stat
          label="Total outstanding"
          value={pkr(fees.totalOutstanding)}
          sub={fees.totalOutstanding > 0 ? 'Payable at the school office' : 'All vouchers clear'}
          icon="wallet"
          tone={fees.totalOutstanding > 0 ? 'overdue' : 'present'}
        />
      </div>

      {/* Exam results summary */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Exam results</CardTitle>
        </CardHeader>
        <CardContent>
          {!exams || exams.rows.length === 0 ? (
            <EmptyState
              icon="award"
              title="No results recorded yet"
              guidance="No exam results have been entered for this child. Results appear here once teachers submit them."
            />
          ) : (
            <>
              <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{exams.termName}</p>
              <Table>
                <THead>
                  <TRow>
                    <TH>Subject</TH>
                    <TH>Marks</TH>
                    <TH>%</TH>
                    <TH>Grade</TH>
                    <TH>Remarks</TH>
                  </TRow>
                </THead>
                <TBody>
                  {exams.rows.map((r) => (
                    <TRow key={r.subject}>
                      <TD className="font-medium">{r.subject}</TD>
                      <TD className="tnum">
                        {r.obtained}/{r.total}
                      </TD>
                      <TD className="tnum">{r.pct}%</TD>
                      <TD>
                        <Badge variant={r.grade === 'F' ? 'absent' : 'info'}>{r.grade}</Badge>
                      </TD>
                      <TD className="max-w-[220px] truncate" title={r.remarks ?? ''}>{r.remarks ?? '—'}</TD>
                    </TRow>
                  ))}
                </TBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Notification preferences note */}
      <Card>
        <CardContent className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            <Icon name="bell" size={20} />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Alerts & notifications</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{notificationsNote}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
