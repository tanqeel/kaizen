'use client';

import { useEffect, useState } from 'react';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TRow,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import type { StaffPerformance } from '@/app/api/staff/performance/route';

function fmtPct(v: number | null): string {
  return v === null ? '—' : `${v}%`;
}

/**
 * Performance table for the Teachers & Staff page. Fetches
 * /api/staff/performance and renders computed metrics with honest
 * "not recorded" states wherever there is no data.
 */
export default function PerformanceSection() {
  const [data, setData] = useState<StaffPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/staff/performance', { credentials: 'same-origin' })
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed to load performance data.');
        return (await r.json()) as StaffPerformance;
      })
      .then((d) => {
        if (live) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (live) {
          setError(e instanceof Error ? e.message : 'Failed to load performance data.');
          setLoading(false);
        }
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="dashboard" size={18} /> Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : error || !data ? (
          <EmptyState
            icon="alert-triangle"
            title="Couldn't load performance"
            guidance={error ?? 'Performance data is unavailable right now.'}
          />
        ) : data.teachers.length === 0 ? (
          <EmptyState
            icon="users"
            title="No teachers"
            guidance="No active teacher records found."
          />
        ) : (
          <>
            <Table>
              <THead>
                <TRow>
                  <TH>Teacher</TH>
                  <TH>Timetabled / wk</TH>
                  <TH>Registers submitted</TH>
                  <TH>Submission rate</TH>
                  <TH>Class average</TH>
                  <TH>Diary (30d)</TH>
                </TRow>
              </THead>
              <TBody>
                {data.teachers.map((t) => (
                  <TRow key={t.teacherId}>
                    <TD className="font-medium">
                      {t.name}
                      <span className="tnum block text-xs font-normal text-slate-500 dark:text-slate-400">
                        {t.employeeId}
                      </span>
                    </TD>
                    <TD className="tnum">{t.periodsTimetabled}</TD>
                    <TD className="tnum">
                      {t.registersSubmitted === null ? (
                        <span className="text-slate-400">no login</span>
                      ) : (
                        t.registersSubmitted
                      )}
                    </TD>
                    <TD className="tnum">
                      {t.submissionRatePct === null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <Badge variant={t.submissionRatePct >= 80 ? 'present' : t.submissionRatePct >= 50 ? 'pending' : 'absent'}>
                          {t.submissionRatePct}%
                        </Badge>
                      )}
                    </TD>
                    <TD className="tnum">
                      {t.classAvgPct === null ? <span className="text-slate-400">not recorded</span> : `${t.classAvgPct}%`}
                    </TD>
                    <TD className="tnum">{t.diaryLast30d}</TD>
                  </TRow>
                ))}
              </TBody>
            </Table>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Submission rate = registers submitted ÷ (days with at least one submission × weekly timetabled periods).
              It measures submission, not on-time submission. Class average aggregates exam results across each
              teacher&apos;s allocated subjects only.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
