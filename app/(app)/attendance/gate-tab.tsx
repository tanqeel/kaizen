'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, Select, Skeleton } from '@/components/ui';
import { Icon } from '@/components/icons';
import { downloadCsv } from '@/lib/fees';
import { todayPKT } from '@/lib/format';
import type { GateRow } from '@/app/api/attendance/gate/route';

const METHODS = [
  { value: 'FINGERPRINT', label: 'Fingerprint' },
  { value: 'FACE', label: 'Face' },
  { value: 'RFID', label: 'RFID card' },
  { value: 'MANUAL', label: 'Manual entry' },
];

interface LookupStudent {
  id: string;
  name: string;
  admissionNo: string;
  grade: string;
  section: string;
}

function methodBadge(method: string) {
  if (method === 'MANUAL') return <Badge variant="pending">Manual</Badge>;
  if (method === 'RFID') return <Badge variant="info">RFID</Badge>;
  return <Badge variant="neutral">{method === 'FACE' ? 'Face' : 'Fingerprint'}</Badge>;
}

export function GateTab() {
  const [date, setDate] = useState(todayPKT());
  const [rows, setRows] = useState<GateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Manual check-in form
  const [q, setQ] = useState('');
  const [results, setResults] = useState<LookupStudent[]>([]);
  const [picked, setPicked] = useState<LookupStudent | null>(null);
  const [method, setMethod] = useState('MANUAL');
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState<string | null>(null);
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/attendance/gate?date=${d}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setRows(data.checkIns ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load check-ins');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  // Search-as-you-type against the shared lookup API (needs ≥2 chars).
  useEffect(() => {
    if (qTimer.current) clearTimeout(qTimer.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    qTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/lookup/students?q=${encodeURIComponent(q.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.students ?? []);
        }
      } catch {
        setResults([]);
      }
    }, 250);
    return () => {
      if (qTimer.current) clearTimeout(qTimer.current);
    };
  }, [q]);

  const submitCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked) {
      setFormMsg({ kind: 'err', text: 'Pick a student from the search results first.' });
      return;
    }
    setSubmitting(true);
    setFormMsg(null);
    try {
      const res = await fetch('/api/attendance/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: picked.id, method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Server returned ${res.status}`);
      setFormMsg({
        kind: 'ok',
        text: `${picked.name} checked in at ${data.checkIn.checkInDisplay}. The parent has been notified in-app.`,
      });
      setPicked(null);
      setQ('');
      setResults([]);
      if (date === todayPKT()) load(date);
    } catch (e) {
      setFormMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Check-in failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const checkout = async (studentId: string, name: string) => {
    setCheckoutBusy(studentId);
    try {
      const res = await fetch('/api/attendance/gate/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Server returned ${res.status}`);
      setRows((prev) =>
        prev.map((r) =>
          r.studentId === studentId ? { ...r, checkOutDisplay: data.checkOut.checkOutDisplay } : r,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? `${name}: ${e.message}` : 'Check-out failed');
    } finally {
      setCheckoutBusy(null);
    }
  };

  const exportCsv = () => {
    downloadCsv(
      `gate-checkins-${date}.csv`,
      ['Admission no', 'Name', 'Grade', 'Section', 'Check-in', 'Method', 'Check-out'],
      filtered.map((r) => [r.admissionNo, r.name, r.grade, r.section, r.checkInDisplay, r.method, r.checkOutDisplay ?? '—']),
    );
  };

  const filtered = rows.filter((r) => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return r.name.toLowerCase().includes(s) || r.admissionNo.toLowerCase().includes(s);
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Manual check-in */}
      <Card>
        <CardHeader>
          <CardTitle>Manual check-in</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitCheckIn} className="flex flex-col gap-3">
            <div className="relative">
              <Input
                label="Find student"
                placeholder="Type at least 2 letters of name or admission no…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPicked(null);
                }}
                autoComplete="off"
                aria-label="Find student to check in"
              />
              {results.length > 0 && !picked && (
                <ul
                  className="nice-scroll absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
                  role="listbox"
                  aria-label="Student search results"
                >
                  {results.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected="false"
                        onClick={() => {
                          setPicked(s);
                          setQ(`${s.name} (${s.admissionNo})`);
                          setResults([]);
                        }}
                        className="flex min-h-[44px] w-full cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <span className="font-medium text-slate-900 dark:text-white">{s.name}</span>
                        <span className="tnum text-xs text-slate-500 dark:text-slate-400">
                          {s.admissionNo} · {s.grade} Sec {s.section}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <Select
                label="Method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                options={METHODS}
                aria-label="Check-in method"
              />
              <Button type="submit" loading={submitting} disabled={!picked}>
                <Icon name="plus" size={16} /> Check in
              </Button>
            </div>
            {formMsg && (
              <p
                role={formMsg.kind === 'err' ? 'alert' : 'status'}
                className={`rounded-lg px-4 py-3 text-sm ${
                  formMsg.kind === 'err'
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                }`}
              >
                {formMsg.text}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Today's list */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Check-ins</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={date}
                max={todayPKT()}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                aria-label="Check-in date"
                className="w-auto"
              />
              <Button variant="secondary" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
                <Icon name="download" size={16} /> CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-3 max-w-sm">
            <Input
              placeholder="Search in this list…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search check-in list"
            />
          </div>
          {error && (
            <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </p>
          )}
          {loading ? (
            <div className="flex flex-col gap-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="fingerprint"
              title={rows.length === 0 ? `No check-ins on ${date}` : 'No matches'}
              guidance={
                rows.length === 0
                  ? 'Nobody has checked in yet for this date. Use the manual check-in form above or the biometric simulator.'
                  : 'No check-ins match your search. Try a different name or admission number.'
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="thead-sticky">
                  <tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800">
                    <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">Student</th>
                    <th scope="col" className="tnum px-4 py-3 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">Check-in</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">Method</th>
                    <th scope="col" className="tnum px-4 py-3 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">Check-out</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.studentId} className="border-b border-slate-200 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 dark:text-white">{r.name}</p>
                        <p className="tnum text-xs text-slate-500 dark:text-slate-400">{r.admissionNo} · {r.grade} Sec {r.section}</p>
                      </td>
                      <td className="tnum px-4 py-3 font-medium text-slate-900 dark:text-white">{r.checkInDisplay}</td>
                      <td className="px-4 py-3">{methodBadge(r.method)}</td>
                      <td className="tnum px-4 py-3 text-slate-700 dark:text-slate-200">{r.checkOutDisplay ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {!r.checkOutDisplay && (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={checkoutBusy === r.studentId}
                            onClick={() => checkout(r.studentId, r.name)}
                          >
                            <Icon name="log-out" size={16} /> Check out
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="tnum mt-3 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
            {filtered.length} of {rows.length} check-ins shown
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
