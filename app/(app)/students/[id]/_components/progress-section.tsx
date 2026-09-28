'use client';

import { useEffect, useState } from 'react';
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from '@/components/ui';
import { Icon } from '@/components/icons';
import { pkr } from '@/lib/format';
import type {
  ProgressMonthAttendance,
  ProgressTermResult,
  StudentProgress,
} from '@/app/api/students/[id]/progress/route';

function monthLabelShort(month: string): string {
  const m = parseInt(month.slice(5, 7), 10);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[m - 1] ?? ''} ${month.slice(0, 4)}`;
}

function AttendanceBars({ months }: { months: ProgressMonthAttendance[] }) {
  const any = months.some((x) => x.marked > 0);
  if (!any) {
    return (
      <EmptyState
        icon="clipboard-check"
        title="No attendance recorded yet"
        guidance="No period registers have been marked for this student in the last six months. Nothing is estimated — figures appear once teachers submit their registers."
      />
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      {months.map((m) => (
        <div key={m.month} className="flex items-center gap-3">
          <span className="tnum w-20 shrink-0 text-xs text-slate-500 dark:text-slate-400">
            {monthLabelShort(m.month)}
          </span>
          <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            {m.presentPct === null ? (
              <span className="block h-full w-full bg-slate-200 dark:bg-slate-700" />
            ) : (
              <span
                className="block h-full rounded-full bg-brand-500"
                style={{ width: `${Math.max(0, Math.min(100, m.presentPct))}%` }}
              />
            )}
          </div>
          <span className="tnum w-14 shrink-0 text-right text-xs font-semibold text-slate-700 dark:text-slate-200">
            {m.presentPct === null ? '—' : `${m.presentPct}%`}
          </span>
        </div>
      ))}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Present ÷ marked rows per month. PENDING registers are reported, never counted as absent.
      </p>
    </div>
  );
}

function ResultsTable({ terms }: { terms: ProgressTermResult[] }) {
  if (terms.length === 0) {
    return (
      <EmptyState
        icon="award"
        title="No results published yet"
        guidance="No exam results exist for this student. Marks appear once teachers enter them — nothing is estimated."
      />
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800">
            <th scope="col" className="px-4 py-2 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">Term</th>
            <th scope="col" className="tnum px-4 py-2 text-right text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">Aggregate</th>
            <th scope="col" className="px-4 py-2 text-right text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">Grade</th>
          </tr>
        </thead>
        <tbody>
          {terms.map((t) => (
            <tr key={t.termId} className="border-b border-slate-200 last:border-0 dark:border-slate-800">
              <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">{t.termName}</td>
              <td className="tnum px-4 py-2 text-right text-slate-700 dark:text-slate-200">
                {t.pct === null ? '—' : `${t.pct}%`}
              </td>
              <td className="px-4 py-2 text-right">
                {t.grade === null ? (
                  <span className="text-slate-400">—</span>
                ) : (
                  <Badge variant={t.pct !== null && t.pct >= 50 ? 'present' : 'absent'}>{t.grade}</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FeeStanding({ fees }: { fees: StudentProgress['fees'] }) {
  const rows: Array<[string, number, string]> = [
    ['Total billed', fees.billed, 'text-slate-700 dark:text-slate-200'],
    ['Total paid', fees.paid, 'text-emerald-700 dark:text-emerald-300'],
    ['Outstanding', fees.outstanding, 'text-rose-700 dark:text-rose-300'],
  ];
  return (
    <div className="flex flex-col gap-2">
      {rows.map(([label, value, tone]) => (
        <div key={label} className="flex items-center justify-between gap-2 text-sm">
          <span className="text-slate-500 dark:text-slate-400">{label}</span>
          <span className={`tnum font-bold ${tone}`}>{pkr(value)}</span>
        </div>
      ))}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {fees.outstanding === 0
          ? 'No outstanding balance — all vouchers are paid.'
          : 'Outstanding across all vouchers, after discounts and fines.'}
      </p>
    </div>
  );
}

/**
 * Analytics rollup for one student: attendance trend, results by term,
 * fee standing. Fetches /api/students/[id]/progress and renders honest
 * empty states wherever there is no data.
 */
export default function ProgressSection({ studentId }: { studentId: string }) {
  const [data, setData] = useState<StudentProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    fetch(`/api/students/${encodeURIComponent(studentId)}/progress`, { credentials: 'same-origin' })
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 403 ? 'Not allowed to view this student.' : 'Failed to load progress.');
        return (await r.json()) as StudentProgress;
      })
      .then((d) => {
        if (live) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (live) {
          setError(e instanceof Error ? e.message : 'Failed to load progress.');
          setLoading(false);
        }
      });
    return () => {
      live = false;
    };
  }, [studentId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="dashboard" size={18} /> Progress overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        ) : error || !data ? (
          <EmptyState
            icon="alert-triangle"
            title="Couldn't load progress"
            guidance={error ?? 'Progress data is unavailable right now.'}
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <p className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                Attendance trend
              </p>
              <AttendanceBars months={data.attendance} />
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                Results by term
              </p>
              <ResultsTable terms={data.results} />
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                Fee standing
              </p>
              <FeeStanding fees={data.fees} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
