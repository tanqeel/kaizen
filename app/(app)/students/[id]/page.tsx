import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { requirePagePermission, can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { monthLabel, balanceDue, displayStatus, statusBadgeVariant } from '@/lib/fees';
import { pkr, pktDate, pktTime, todayPKT } from '@/lib/format';
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader } from '@/components/ui';
import { Icon } from '@/components/icons';
import DiscountsSection from './_components/discounts-section';
import ProgressSection from './_components/progress-section';
import { DischargeButton } from './_components/discharge-button';

function gradeBand(pct: number): string {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  requirePagePermission(user.role, 'students.view');
  const { id } = await params;

  const student = await prisma.student.findFirst({
    where: { id },
    include: {
      grade: { select: { name: true } },
      section: { select: { name: true } },
      shift: { select: { name: true } },
      parents: {
        include: { parent: { select: { name: true, phone: true, cnic: true, address: true } } },
      },
    },
  });
  if (!student) notFound();

  const today = todayPKT();
  const monthPrefix = today.slice(0, 7);

  const [attRows, gateRows, vouchers, examResults, openConflicts] = await Promise.all([
    prisma.periodAttendance.findMany({
      where: { studentId: id, date: { startsWith: monthPrefix } },
      select: { status: true },
    }),
    prisma.gateCheckIn.findMany({
      where: { studentId: id },
      orderBy: { date: 'desc' },
      take: 7,
    }),
    prisma.feeVoucher.findMany({
      where: { studentId: id, status: { not: 'PAID' } },
      include: { payments: { select: { amount: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    }),
    prisma.examResult.findMany({
      where: { studentId: id },
      include: {
        examSchedule: {
          select: {
            totalMarks: true,
            date: true,
            subject: { select: { name: true } },
            examTerm: { select: { name: true } },
          },
        },
      },
      orderBy: { examSchedule: { date: 'desc' } },
    }),
    prisma.attendanceConflict.count({ where: { studentId: id, status: 'OPEN' } }),
  ]);

  const checkOuts = await prisma.gateCheckOut.findMany({
    where: { studentId: id, date: { in: gateRows.map((g) => g.date) } },
    select: { date: true, checkOutTime: true },
  });
  const outByDate = new Map(checkOuts.map((o) => [o.date, o.checkOutTime]));

  const present = attRows.filter((r) => r.status === 'PRESENT').length;
  const absent = attRows.filter((r) => r.status === 'ABSENT').length;
  const pending = attRows.filter((r) => r.status === 'PENDING').length;
  const decided = present + absent;
  const monthPct = decided === 0 ? null : Math.round((present / decided) * 100);

  const feeBalance = vouchers.reduce((s, v) => s + Math.max(0, balanceDue(v, v.payments)), 0);

  // Attendance streak: consecutive calendar days with a gate check-in.
  const streakDates = new Set(gateRows.map((g) => g.date));
  let streak = 0;
  const cursor = new Date(`${today}T00:00:00`);
  if (!streakDates.has(today)) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const ds = cursor.toISOString().slice(0, 10);
    if (!streakDates.has(ds)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Exam results grouped by term.
  const terms = new Map<string, Array<{ subject: string; obtained: number; total: number; remarks: string | null }>>();
  for (const r of examResults) {
    const term = r.examSchedule.examTerm.name;
    const arr = terms.get(term) ?? [];
    arr.push({
      subject: r.examSchedule.subject.name,
      obtained: r.obtainedMarks,
      total: r.examSchedule.totalMarks,
      remarks: r.remarks,
    });
    terms.set(term, arr);
  }

  return (
    <div>
      <PageHeader
        title={student.name}
        subtitle={`${student.admissionNo} · ${student.grade.name} – Section ${student.section.name} · ${student.shift.name} shift`}
        actions={
          <>
            {can(user.role, 'students.view') && (
              <>
                <Link
                  href={`/students/${student.id}/id-card`}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  <Icon name="id-card" size={16} /> ID Card
                </Link>
                <Link
                  href={`/students/${student.id}/leaving-certificate`}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Icon name="award" size={16} /> Leaving Certificate
                </Link>
                <Link
                  href={`/students/${student.id}/character-certificate`}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Icon name="award" size={16} /> Character Certificate
                </Link>
              </>
            )}
            <Link
              href="/students"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Icon name="arrow-left" size={16} /> Back to directory
            </Link>
            {can(user.role, 'students.manage') && (
              <DischargeButton studentId={student.id} studentName={student.name} isActive={student.isActive} />
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6">
          {/* Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Profile
                {!student.isActive && <Badge variant="absent">Discharged</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-2 text-sm">
                {[
                  ['Admission no', student.admissionNo],
                  ['Date of birth', student.dob ? pktDate(student.dob) : '—'],
                  ['Gender', student.gender ?? '—'],
                  ['B-Form', student.bForm ?? '—'],
                  ['Address', student.address ?? '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="shrink-0 text-slate-500 dark:text-slate-400">{k}</dt>
                    <dd className="tnum min-w-0 text-right break-words font-medium text-slate-900 dark:text-white">{v}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          {/* Linked parents */}
          <Card>
            <CardHeader>
              <CardTitle>Linked parents / guardians</CardTitle>
            </CardHeader>
            <CardContent>
              {student.parents.length === 0 ? (
                <EmptyState icon="users" title="No linked parents" guidance="No parent or guardian is linked to this student record yet." />
              ) : (
                <div className="flex flex-col gap-3">
                  {student.parents.map((sp) => (
                    <div key={sp.parent.name} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{sp.parent.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{sp.relation}</p>
                      <a
                        href={`tel:${sp.parent.phone}`}
                        className="tnum mt-1 inline-flex min-h-[44px] items-center gap-1.5 text-sm text-brand-700 dark:text-brand-300"
                      >
                        <Icon name="phone" size={15} /> {sp.parent.phone}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fee balance */}
          <Card>
            <CardHeader>
              <CardTitle>Fee balance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="tnum text-3xl font-bold text-slate-900 dark:text-white">{pkr(feeBalance)}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {feeBalance === 0 ? 'No outstanding balance — all vouchers are paid.' : 'Total outstanding across unpaid vouchers.'}
              </p>
              {vouchers.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {vouchers.slice(0, 5).map((v) => {
                    const st = displayStatus(v, today);
                    return (
                      <div key={v.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-slate-600 dark:text-slate-300">{monthLabel(v.month, v.year)}</span>
                        <span className="flex items-center gap-2">
                          <span className="tnum font-semibold text-slate-900 dark:text-white">
                            {pkr(Math.max(0, balanceDue(v, v.payments)))}
                          </span>
                          <Badge variant={statusBadgeVariant(st)}>{st}</Badge>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Discounts & scholarships */}
          <DiscountsSection studentId={student.id} canManage={can(user.role, 'finance.manage')} />
        </div>

        <div className="flex flex-col gap-6 xl:col-span-2">
          {/* Attendance this month */}
          <Card>
            <CardHeader>
              <CardTitle>This month&apos;s attendance — period registers</CardTitle>
            </CardHeader>
            <CardContent>
              {decided === 0 && pending === 0 ? (
                <EmptyState
                  icon="clipboard-check"
                  title="No attendance records this month"
                  guidance="No period attendance has been marked for this student yet this month. Nothing is invented here — records appear once teachers submit their registers."
                />
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                    <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">Attendance</p>
                    <p className="tnum mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                      {monthPct === null ? '—' : `${monthPct}%`}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">present / decided (pending excluded)</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-500/10">
                    <p className="text-xs font-medium tracking-wide text-emerald-700 uppercase dark:text-emerald-300">Present</p>
                    <p className="tnum mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300">{present}</p>
                  </div>
                  <div className="rounded-xl bg-rose-50 p-4 dark:bg-rose-500/10">
                    <p className="text-xs font-medium tracking-wide text-rose-700 uppercase dark:text-rose-300">Absent</p>
                    <p className="tnum mt-1 text-2xl font-bold text-rose-700 dark:text-rose-300">{absent}</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-4 dark:bg-amber-500/10">
                    <p className="text-xs font-medium tracking-wide text-amber-700 uppercase dark:text-amber-300">Pending</p>
                    <p className="tnum mt-1 text-2xl font-bold text-amber-700 dark:text-amber-300">{pending}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">never counted as absent</p>
                  </div>
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <Icon name="sparkles" size={16} className="text-brand-500" />
                  Current check-in streak: <strong className="tnum">{streak} day{streak === 1 ? '' : 's'}</strong>
                </span>
                {openConflicts > 0 && (
                  <Link href="/attendance">
                    <Badge variant="absent" className="tnum">{openConflicts} open conflict{openConflicts === 1 ? '' : 's'}</Badge>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent gate activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent gate activity</CardTitle>
            </CardHeader>
            <CardContent>
              {gateRows.length === 0 ? (
                <EmptyState
                  icon="fingerprint"
                  title="No gate activity recorded"
                  guidance="This student has no gate check-ins on record. Check-ins appear here as they are recorded at the gate."
                />
              ) : (
                <div className="flex flex-col gap-2">
                  {gateRows.map((g) => {
                    const out = outByDate.get(g.date);
                    return (
                      <div key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                        <div>
                          <p className="tnum text-sm font-semibold text-slate-900 dark:text-white">{g.date}</p>
                          <p className="tnum text-xs text-slate-500 dark:text-slate-400">
                            In {pktTime(g.checkInTime)} · {g.method}
                          </p>
                        </div>
                        {out ? (
                          <Badge variant="info" className="tnum">Out {pktTime(out)}</Badge>
                        ) : (
                          <Badge variant="neutral">Not checked out</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Exam results */}
          <Card>
            <CardHeader>
              <CardTitle>Exam results</CardTitle>
            </CardHeader>
            <CardContent>
              {terms.size === 0 ? (
                <EmptyState
                  icon="award"
                  title="No results published"
                  guidance="No exam results exist for this student yet. Marks appear here once teachers enter them — nothing is estimated or invented."
                />
              ) : (
                <div className="flex flex-col gap-5">
                  {[...terms.entries()].map(([term, rows]) => {
                    const obtained = rows.reduce((s, r) => s + r.obtained, 0);
                    const total = rows.reduce((s, r) => s + r.total, 0);
                    const pct = total === 0 ? 0 : Math.round((obtained / total) * 100);
                    return (
                      <div key={term}>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{term}</p>
                          <Badge variant={pct >= 50 ? 'present' : 'absent'} className="tnum">
                            {obtained}/{total} · {pct}% · {gradeBand(pct)}
                          </Badge>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                          <table className="w-full border-collapse text-left text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800">
                                <th scope="col" className="px-4 py-2 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">Subject</th>
                                <th scope="col" className="tnum px-4 py-2 text-right text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">Obtained</th>
                                <th scope="col" className="tnum px-4 py-2 text-right text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">Total</th>
                                <th scope="col" className="tnum px-4 py-2 text-right text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">%</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((r) => {
                                const rp = r.total === 0 ? 0 : Math.round((r.obtained / r.total) * 100);
                                return (
                                  <tr key={r.subject} className="border-b border-slate-200 last:border-0 dark:border-slate-800">
                                    <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{r.subject}</td>
                                    <td className="tnum px-4 py-2 text-right font-semibold text-slate-900 dark:text-white">{r.obtained}</td>
                                    <td className="tnum px-4 py-2 text-right text-slate-500 dark:text-slate-400">{r.total}</td>
                                    <td className="tnum px-4 py-2 text-right text-slate-700 dark:text-slate-200">{rp}%</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Progress analytics */}
          <ProgressSection studentId={student.id} />
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-400 dark:text-slate-500">
        Profile generated from live school records on {today}. PENDING marks are never counted as absent.
      </p>
    </div>
  );
}
