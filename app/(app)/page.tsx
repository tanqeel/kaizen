import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { requirePagePermission } from '@/lib/rbac';
import { getDashboardSummary, type DashboardSummary } from '@/lib/dashboard';
import { pkr, todayPKT } from '@/lib/format';
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader, Stat } from '@/components/ui';
import { Icon } from '@/components/icons';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function weekdayShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function ProgressBar({ pct, tone }: { pct: number; tone: 'present' | 'info' | 'overdue' }) {
  const fills = {
    present: 'bg-emerald-500',
    info: 'bg-brand-500',
    overdue: 'bg-rose-500',
  } as const;
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${pct}% present`}
    >
      <div className={`h-full rounded-full ${fills[tone]}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

function AdminDashboard({ data }: { data: DashboardSummary }) {
  const k = data.kpis!;
  const att = data.attendanceToday!;
  const alerts = data.alerts!;
  const trend = data.trend!;
  const atRisk = data.atRisk ?? [];
  const today = data.date;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Enrolled students" value={String(k.students)} icon="users" tone="info" />
        <Stat label="Active teachers" value={String(k.teachers)} icon="id-card" tone="neutral" />
        <Stat label="Operational staff" value={String(k.staff)} icon="school" tone="neutral" />
        <Stat label="Sections" value={String(k.sections)} icon="book-open" tone="neutral" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Today's attendance */}
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s attendance — gate check-ins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <span className="tnum text-4xl font-bold text-emerald-600 dark:text-emerald-400">{att.present}</span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  present · <span className="tnum font-semibold text-rose-600 dark:text-rose-400">{att.absent}</span> absent ·{' '}
                  <span className="tnum">{att.total}</span> enrolled
                </span>
              </div>
              <span className="tnum text-lg font-bold text-slate-900 dark:text-white">{att.pct}%</span>
            </div>
            <div className="mt-3">
              <ProgressBar pct={att.pct} tone="present" />
            </div>
            {/* Section-wise heatmap */}
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                Section-wise attendance heatmap
              </p>
              {att.sections.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No sections found.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {att.sections.map((s) => {
                    const tone =
                      s.total === 0
                        ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        : s.pct >= 90
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : s.pct >= 75
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300';
                    return (
                      <div key={s.sectionId} className={`rounded-lg px-3 py-2 ${tone}`}>
                        <p className="truncate text-xs font-semibold">{s.label}</p>
                        <p className="tnum text-sm font-bold">
                          {s.pct}% <span className="font-normal">({s.present}/{s.total})</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 7-day trend */}
        <Card>
          <CardHeader>
            <CardTitle>7-day attendance trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-44 items-end justify-between gap-2" role="img" aria-label="7-day attendance trend bar chart">
              {trend.map((d) => (
                <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span className="tnum text-xs font-semibold text-slate-700 dark:text-slate-200">{d.pct}%</span>
                  <div className="flex h-28 w-full items-end rounded-md bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`w-full rounded-md ${d.date === today ? 'bg-brand-500' : 'bg-emerald-500/70'}`}
                      style={{ height: `${Math.max(4, d.pct)}%` }}
                      title={`${d.date}: ${d.present}/${d.total} present`}
                    />
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {d.date === today ? 'Today' : weekdayShort(d.date)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Present = students with a gate check-in · {trend[0]?.date} – {today}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Operational alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Operational alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="flex items-center gap-2">
                <Icon name="clock" size={18} className="text-amber-700 dark:text-amber-300" />
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Pending lecture submissions</p>
              </div>
              {alerts.pendingSubmissions.length === 0 ? (
                <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">All sections have submitted today&apos;s registers.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {alerts.pendingSubmissions.slice(0, 6).map((p) => (
                    <li key={p.sectionId} className="text-sm text-amber-900 dark:text-amber-200">
                      <Link href="/attendance" className="tnum font-semibold underline decoration-amber-400 underline-offset-2">
                        {p.label}
                      </Link>
                      <span className="tnum text-xs"> — missing period{p.missingPeriods.length === 1 ? '' : 's'} {p.missingPeriods.join(', ')}</span>
                    </li>
                  ))}
                  {alerts.pendingSubmissions.length > 6 && (
                    <li className="tnum text-xs text-amber-800 dark:text-amber-300">
                      +{alerts.pendingSubmissions.length - 6} more sections
                    </li>
                  )}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-500/10">
              <div className="flex items-center gap-2">
                <Icon name="alert-triangle" size={18} className="text-rose-700 dark:text-rose-300" />
                <p className="text-sm font-semibold text-rose-900 dark:text-rose-200">Open attendance conflicts</p>
              </div>
              <p className="tnum mt-2 text-3xl font-bold text-rose-700 dark:text-rose-300">{alerts.openConflicts}</p>
              <p className="mt-1 text-sm text-rose-800 dark:text-rose-300">gate-present but lecture-absent</p>
              <Link
                href="/attendance"
                className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-rose-800 underline decoration-rose-400 underline-offset-2 dark:text-rose-200"
              >
                Review conflicts <Icon name="arrow-left" size={16} className="rotate-180" />
              </Link>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
              <div className="flex items-center gap-2">
                <Icon name="wallet" size={18} className="text-red-700 dark:text-red-300" />
                <p className="text-sm font-semibold text-red-900 dark:text-red-200">Overdue fee vouchers</p>
              </div>
              <p className="tnum mt-2 text-3xl font-bold text-red-700 dark:text-red-300">{alerts.overdueVouchers}</p>
              <p className="tnum mt-1 text-sm font-semibold text-red-800 dark:text-red-200">
                {pkr(alerts.overdueOutstanding)} outstanding
              </p>
              <Link
                href="/fees"
                className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-red-800 underline decoration-red-400 underline-offset-2 dark:text-red-200"
              >
                Open fee ledger <Icon name="arrow-left" size={16} className="rotate-180" />
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* At-risk students */}
      <Card>
        <CardHeader>
          <CardTitle>At-risk students — attendance under 75% this month</CardTitle>
        </CardHeader>
        <CardContent>
          {atRisk.length === 0 ? (
            <EmptyState
              icon="check"
              title="No at-risk students"
              guidance="Every student with at least 5 period records this month is at or above 75% attendance. PENDING marks never count as absent."
            />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {atRisk.map((s) => (
                <Link key={s.studentId} href={`/students/${s.studentId}`} className="group rounded-xl">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 transition-colors group-hover:border-brand-300 dark:border-slate-800 dark:group-hover:border-brand-500/50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{s.name}</p>
                      <p className="tnum text-xs text-slate-500 dark:text-slate-400">
                        {s.admissionNo} · {s.label}
                      </p>
                    </div>
                    <Badge variant="absent" className="tnum">{s.pct}%</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TeacherDashboard({ data }: { data: DashboardSummary }) {
  const t = data.teacher!;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Assalam-o-Alaikum, ${t.name}`} subtitle={`Today is ${todayPKT()} · your schedule and pending registers`} />
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s schedule</CardTitle>
        </CardHeader>
        <CardContent>
          {t.schedule.length === 0 ? (
            <EmptyState
              icon="calendar-days"
              title="No classes today"
              guidance="You have no timetable periods assigned on this weekday. Enjoy the lighter day."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {t.schedule.map((s) => (
                <div
                  key={s.periodNo}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <span className="tnum flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                      {s.periodNo}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{s.subject}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{s.section}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="tnum text-sm font-medium text-slate-700 dark:text-slate-200">{s.time}</p>
                    {s.room && <p className="text-xs text-slate-500 dark:text-slate-400">Room {s.room}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Pending register submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {t.pendingSections.length === 0 ? (
            <EmptyState
              icon="check"
              title="All registers submitted"
              guidance="Every section you teach today has a complete period register. Nothing pending."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {t.pendingSections.map((p) => (
                <div key={p.sectionId} className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <div className="flex items-center gap-2">
                    <Icon name="clock" size={18} className="text-amber-700 dark:text-amber-300" />
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">{p.label}</p>
                  </div>
                  <Link href="/attendance" className="flex min-h-[44px] items-center">
                    <Badge variant="pending">Submit</Badge>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StaffDashboard({ data }: { data: DashboardSummary }) {
  const g = data.staffGate!;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Gate operations" subtitle={`${todayPKT()} · live check-in counters`} />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Check-ins today" value={String(g.checkIns)} icon="fingerprint" tone="info" />
        <Stat label="Present on campus" value={String(g.present)} icon="check" tone="present" />
        <Stat label="Not yet arrived" value={String(g.absent)} icon="clock" tone="pending" />
        <Stat label="Check-outs" value={String(g.checkOuts)} icon="log-out" tone="neutral" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Gate register</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Open the attendance module to check students in manually, search arrivals, and record check-outs.
          </p>
          <Link
            href="/attendance"
            className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Icon name="clipboard-check" size={18} /> Open attendance
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function StudentDashboard({ data }: { data: DashboardSummary }) {
  const s = data.student;
  if (!s) {
    return (
      <EmptyState
        icon="info"
        title="No student profile linked"
        guidance="Your account is not linked to a student record yet. Please contact the school office."
      />
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Assalam-o-Alaikum, ${s.name}`} subtitle="Your month at a glance" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Attendance this month" value={s.monthPct === null ? '—' : `${s.monthPct}%`} icon="clipboard-check" tone={s.monthPct === null ? 'neutral' : s.monthPct >= 75 ? 'present' : 'absent'} sub={s.monthPct === null ? 'No period records yet' : 'Present / present+absent (pending excluded)'} />
        <Stat label="Present days" value={String(s.presentDays)} icon="check" tone="present" />
        <Stat label="Absent days" value={String(s.absentDays)} icon="x" tone="absent" />
        <Stat label="Check-in streak" value={`${s.streak}d`} icon="sparkles" tone="info" sub="Consecutive days with gate check-in" />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming exams</CardTitle>
          </CardHeader>
          <CardContent>
            {s.upcomingExams.length === 0 ? (
              <EmptyState icon="award" title="No upcoming exams" guidance="No exams are scheduled for your grade right now. Check back soon." />
            ) : (
              <div className="flex flex-col gap-2">
                {s.upcomingExams.map((e, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{e.subject}</p>
                      <p className="tnum text-xs text-slate-500 dark:text-slate-400">{e.date} · {e.time}</p>
                    </div>
                    <Badge variant="info" className="tnum shrink-0">{e.totalMarks} marks</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fee balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="tnum text-3xl font-bold text-slate-900 dark:text-white">{pkr(s.feeBalance)}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {s.feeBalance === 0 ? 'All vouchers are fully paid. JazakAllah!' : 'Total outstanding across unpaid vouchers.'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'dashboard.view');

  // Parents land on their children portal (kept from Wave 1).
  if (user.role === 'PARENT') redirect('/portal');

  const data = await getDashboardSummary(user);
  const displayName = user.name.trim() || 'there';

  return (
    <div>
      {(user.role === 'SUPER_ADMIN' || user.role === 'PRINCIPAL') && (
        <>
          <PageHeader
            title={`Welcome back, ${displayName}`}
            subtitle={`${todayPKT()} · Kaizen Model School · live operational picture`}
          />
          <AdminDashboard data={data} />
        </>
      )}
      {user.role === 'TEACHER' && <TeacherDashboard data={data} />}
      {user.role === 'STAFF' && <StaffDashboard data={data} />}
      {user.role === 'STUDENT' && <StudentDashboard data={data} />}
    </div>
  );
}
