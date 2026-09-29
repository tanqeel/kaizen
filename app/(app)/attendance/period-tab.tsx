'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, Select, Skeleton, useConfirm } from '@/components/ui';
import { Icon } from '@/components/icons';
import { downloadCsv } from '@/lib/fees';
import { todayPKT } from '@/lib/format';
import type { AttendanceSection } from './tabs';
import type { AttendanceStatus } from '@prisma/client';
import { safeJson } from '@/lib/api-client';

interface SlotInfo {
  periodNo: number;
  subjectId: string;
  subject: string;
  teacher: string;
  time: string;
  room: string | null;
}

interface RegisterStudent {
  id: string;
  name: string;
  admissionNo: string;
}

interface RegisterData {
  section: { id: string; label: string };
  slots: SlotInfo[];
  students: RegisterStudent[];
  existing: Record<string, AttendanceStatus>;
}

const STATUS_OPTIONS: Array<{ value: AttendanceStatus; label: string; key: string }> = [
  { value: 'PRESENT', label: 'Present', key: 'P' },
  { value: 'ABSENT', label: 'Absent', key: 'A' },
  { value: 'PENDING', label: 'Pending', key: 'X' },
];

function statusBadge(s: AttendanceStatus) {
  if (s === 'PRESENT') return <Badge variant="present">Present</Badge>;
  if (s === 'ABSENT') return <Badge variant="absent">Absent</Badge>;
  return <Badge variant="pending">Pending</Badge>;
}

export function PeriodTab({ sections }: { sections: AttendanceSection[] }) {
  const confirm = useConfirm();
  const [sectionId, setSectionId] = useState('');
  const [date, setDate] = useState(todayPKT());
  const [data, setData] = useState<RegisterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodNo, setPeriodNo] = useState<number | ''>('');
  const [entries, setEntries] = useState<Record<string, AttendanceStatus>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    saved: number;
    conflictsDetected: number;
    notificationsSent: number;
    dayComplete: boolean;
  } | null>(null);

  const load = useCallback(async (sid: string, d: string) => {
    if (!sid) return;
    setLoading(true);
    setError(null);
    setData(null);
    setPeriodNo('');
    try {
      const res = await fetch(`/api/attendance/period?sectionId=${sid}&date=${d}`);
      if (!res.ok) {
        const body = await safeJson(res).catch(() => ({}));
        throw new Error(body.error ?? `Server returned ${res.status}`);
      }
      const payload = (await safeJson(res)) as RegisterData;
      setData(payload);
      // Prefill: default to the first submitted period so teachers continue where they left off.
      if (payload.slots.length > 0) setPeriodNo(payload.slots[0].periodNo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load register data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sectionId) load(sectionId, date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, date]);

  // Re-prefill entries whenever the period changes.
  useEffect(() => {
    if (!data || periodNo === '') {
      setEntries({});
      return;
    }
    const next: Record<string, AttendanceStatus> = {};
    for (const s of data.students) {
      next[s.id] = data.existing[`${periodNo}|${s.id}`] ?? 'PENDING';
    }
    setEntries(next);
    setResult(null);
  }, [data, periodNo]);

  const activeSlot = useMemo(
    () => data?.slots.find((s) => s.periodNo === periodNo) ?? null,
    [data, periodNo],
  );

  const counts = useMemo(() => {
    const c: Record<AttendanceStatus, number> = { PRESENT: 0, ABSENT: 0, PENDING: 0 };
    for (const v of Object.values(entries)) c[v] += 1;
    return c;
  }, [entries]);

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setEntries((prev) => ({ ...prev, [studentId]: status }));
  };

  /** Keyboard shortcuts: with a student row focused, P/A/X sets the status. */
  const onRowKeyDown = (e: React.KeyboardEvent, studentId: string) => {
    const k = e.key.toUpperCase();
    const opt = STATUS_OPTIONS.find((o) => o.key === k);
    if (opt && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      setStatus(studentId, opt.value);
    }
  };

  const markAllPresent = async () => {
    if (!data) return;
    const ok = await confirm({
      title: 'Mark all present?',
      message: `This sets every student in ${data.section.label} to PRESENT for period ${periodNo}. You can still change individuals before submitting.`,
      confirmLabel: 'Mark all present',
    });
    if (!ok) return;
    const next: Record<string, AttendanceStatus> = {};
    for (const s of data.students) next[s.id] = 'PRESENT';
    setEntries(next);
  };

  const submit = async () => {
    if (!data || periodNo === '' || !activeSlot) return;
    const changed = data.students.filter((s) => (entries[s.id] ?? 'PENDING') !== (data.existing[`${periodNo}|${s.id}`] ?? 'PENDING'));
    const ok = await confirm({
      title: 'Submit period register?',
      message: `${data.section.label} · Period ${periodNo} (${activeSlot.subject}) · ${date}\n${changed.length} of ${data.students.length} marks changed.\n\nAbsent students who checked in at the gate will raise attendance conflicts.`,
      confirmLabel: 'Submit register',
    });
    if (!ok) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/attendance/period', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: data.section.id,
          date,
          periodNo,
          subjectId: activeSlot.subjectId,
          entries: data.students.map((s) => ({ studentId: s.id, status: entries[s.id] ?? 'PENDING' })),
        }),
      });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body.error ?? `Server returned ${res.status}`);
      setResult({
        saved: body.saved,
        conflictsDetected: body.conflictsDetected,
        notificationsSent: body.notificationsSent,
        dayComplete: body.dayComplete,
      });
      // Refresh prefill state so the grid shows submitted values.
      await load(sectionId, date);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const exportCsv = () => {
    if (!data || periodNo === '') return;
    downloadCsv(
      `period-attendance-${date}-p${periodNo}.csv`,
      ['Admission no', 'Name', 'Section', 'Period', 'Subject', 'Status'],
      data.students.map((s) => [
        s.admissionNo,
        s.name,
        data.section.label,
        String(periodNo),
        activeSlot?.subject ?? '',
        entries[s.id] ?? 'PENDING',
      ]),
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Register scope</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select
              label="Section"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              options={sections.map((s) => ({ value: s.id, label: s.label }))}
              placeholder="Select section…"
            />
            <Input
              label="Date"
              type="date"
              value={date}
              max={todayPKT()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              aria-label="Register date"
            />
            <Select
              label="Period"
              value={periodNo === '' ? '' : String(periodNo)}
              onChange={(e) => setPeriodNo(e.target.value === '' ? '' : Number(e.target.value))}
              options={(data?.slots ?? []).map((s) => ({
                value: String(s.periodNo),
                label: `Period ${s.periodNo} — ${s.subject} (${s.time})`,
              }))}
              placeholder={data ? 'Select period…' : 'Pick a section first'}
              disabled={!data}
            />
          </div>
          {activeSlot && (
            <p className="tnum mt-3 text-sm text-slate-600 dark:text-slate-300" aria-live="polite">
              <strong>{activeSlot.subject}</strong> · {activeSlot.time} · {activeSlot.teacher}
              {activeSlot.room ? ` · Room ${activeSlot.room}` : ''} · {data?.section.label}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : !data ? (
        !error && (
          <EmptyState
            icon="clipboard-check"
            title="Select a section to open the register"
            guidance="Pick a section and date above. Periods come from the section's real timetable for that weekday — days with no classes (e.g. Sunday) show no periods."
          />
        )
      ) : data.slots.length === 0 ? (
        <EmptyState
          icon="calendar-days"
          title="No classes on this day"
          guidance={`${data.section.label} has no timetable periods on this weekday, so there is nothing to mark. Pick a school day.`}
        />
      ) : periodNo === '' ? (
        <EmptyState
          icon="clock"
          title="Select a period"
          guidance="Choose one of the timetable periods above to mark attendance for it."
        />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>
                Period {periodNo} — {data.students.length} students
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="tnum flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
                  <span className="text-emerald-600 dark:text-emerald-400">{counts.PRESENT} present</span>·
                  <span className="text-rose-600 dark:text-rose-400">{counts.ABSENT} absent</span>·
                  <span className="text-amber-600 dark:text-amber-400">{counts.PENDING} pending</span>
                </div>
                <Button variant="secondary" size="sm" onClick={markAllPresent}>
                  <Icon name="check" size={16} /> All present
                </Button>
                <Button variant="secondary" size="sm" onClick={exportCsv}>
                  <Icon name="download" size={16} /> CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Tip: click a student row to focus it, then press <kbd className="rounded border border-slate-300 px-1.5 py-0.5 font-mono dark:border-slate-600">P</kbd> present,{' '}
              <kbd className="rounded border border-slate-300 px-1.5 py-0.5 font-mono dark:border-slate-600">A</kbd> absent,{' '}
              <kbd className="rounded border border-slate-300 px-1.5 py-0.5 font-mono dark:border-slate-600">X</kbd> pending.
            </p>
            <div className="flex flex-col gap-1.5" role="group" aria-label={`Attendance for period ${periodNo}`}>
              {data.students.map((s) => (
                <div
                  key={s.id}
                  tabIndex={0}
                  onKeyDown={(e) => onRowKeyDown(e, s.id)}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition-colors focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-200 dark:border-slate-800 dark:focus-visible:ring-brand-500/30"
                  aria-label={`${s.name}: ${(entries[s.id] ?? 'PENDING').toLowerCase()}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{s.name}</p>
                    <p className="tnum text-xs text-slate-500 dark:text-slate-400">{s.admissionNo}</p>
                  </div>
                  <div className="flex items-center gap-1" role="radiogroup" aria-label={`Status for ${s.name}`}>
                    {STATUS_OPTIONS.map((opt) => {
                      const checked = (entries[s.id] ?? 'PENDING') === opt.value;
                      return (
                        <label
                          key={opt.value}
                          className={`inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                            checked
                              ? opt.value === 'PRESENT'
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-200'
                                : opt.value === 'ABSENT'
                                  ? 'border-rose-500 bg-rose-50 text-rose-800 dark:border-rose-500 dark:bg-rose-500/15 dark:text-rose-200'
                                  : 'border-amber-500 bg-amber-50 text-amber-800 dark:border-amber-500 dark:bg-amber-500/15 dark:text-amber-200'
                              : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`status-${s.id}`}
                            value={opt.value}
                            checked={checked}
                            onChange={() => setStatus(s.id, opt.value)}
                            className="sr-only"
                          />
                          {opt.label}
                          <kbd className="rounded border border-current px-1 font-mono text-[10px] opacity-60">{opt.key}</kbd>
                        </label>
                      );
                    })}
                  </div>
                  <span className="hidden sm:block">{statusBadge(entries[s.id] ?? 'PENDING')}</span>
                </div>
              ))}
            </div>
            {result && (
              <p
                role="status"
                className="tnum mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"
              >
                Saved {result.saved} records · {result.conflictsDetected} new conflict{result.conflictsDetected === 1 ? '' : 's'} detected
                {result.dayComplete
                  ? result.notificationsSent > 0
                    ? ` · day complete: ${result.notificationsSent} absence notification${result.notificationsSent === 1 ? '' : 's'} sent to parents`
                    : ' · day complete: no full-day absentees to notify'
                  : ' · day not yet complete: no absence notifications sent'}
              </p>
            )}
            <div className="mt-4 flex justify-end">
              <Button onClick={submit} loading={submitting} disabled={data.students.length === 0}>
                <Icon name="check" size={16} /> Submit register
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
