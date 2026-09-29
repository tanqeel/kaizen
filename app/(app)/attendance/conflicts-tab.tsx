'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, EmptyState, Select, Skeleton, Textarea, useConfirm } from '@/components/ui';
import { Icon } from '@/components/icons';
import { todayPKT } from '@/lib/format';
import type { ConflictRow } from '@/app/api/attendance/conflicts/route';
import { safeJson } from '@/lib/api-client';

const STATUS_FILTERS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'DISMISSED', label: 'Dismissed' },
];

export function ConflictsTab() {
  const confirm = useConfirm();
  const [status, setStatus] = useState('OPEN');
  const [rows, setRows] = useState<ConflictRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rerunBusy, setRerunBusy] = useState(false);
  const [rerunMsg, setRerunMsg] = useState<string | null>(null);
  const [resolving, setResolving] = useState<ConflictRow | null>(null);
  const [note, setNote] = useState('');
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const load = useCallback(async (s: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/attendance/conflicts?status=${s}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await safeJson(res);
      setRows(data.conflicts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load conflicts');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(status);
  }, [status, load]);

  const rerun = async () => {
    setRerunBusy(true);
    setRerunMsg(null);
    try {
      const res = await fetch('/api/attendance/conflicts/rerun', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: todayPKT() }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error ?? `Server returned ${res.status}`);
      setRerunMsg(`Detection re-run for ${data.date}: ${data.created} new conflict${data.created === 1 ? '' : 's'} found.`);
      if (status === 'OPEN') load('OPEN');
    } catch (e) {
      setRerunMsg(e instanceof Error ? e.message : 'Re-run failed');
    } finally {
      setRerunBusy(false);
    }
  };

  const closeConflict = async (row: ConflictRow, next: 'RESOLVED' | 'DISMISSED', resolutionNote?: string) => {
    if (next === 'DISMISSED') {
      const ok = await confirm({
        title: 'Dismiss conflict?',
        message: `Dismiss the conflict for ${row.student.name} on ${row.date}? This marks it reviewed with no action taken.`,
        confirmLabel: 'Dismiss',
      });
      if (!ok) return;
    }
    setActionBusy(row.id);
    try {
      const res = await fetch(`/api/attendance/conflicts/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next, note: resolutionNote }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error ?? `Server returned ${res.status}`);
      setRows((prev) => (status === 'OPEN' ? prev.filter((r) => r.id !== row.id) : prev.map((r) => (r.id === row.id ? { ...r, status: next } : r))));
      setResolving(null);
      setNote('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update conflict');
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Gate-present / lecture-absent conflicts</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                options={STATUS_FILTERS}
                aria-label="Conflict status filter"
                className="w-auto"
              />
              <Button variant="secondary" size="sm" loading={rerunBusy} onClick={rerun}>
                <Icon name="refresh-cw" size={16} /> Re-run detection
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
            A conflict means the student <strong>checked in at the gate</strong> but was marked <strong>absent</strong> in at
            least one period the same day. Detection runs automatically after every register submit.
          </p>
          {rerunMsg && (
            <p role="status" className="tnum mb-3 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">
              {rerunMsg}
            </p>
          )}
          {error && (
            <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </p>
          )}
          {loading ? (
            <div className="flex flex-col gap-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon="check"
              title={status === 'OPEN' ? 'No open conflicts' : `No ${status.toLowerCase()} conflicts`}
              guidance={
                status === 'OPEN'
                  ? 'Every gate check-in is consistent with the period registers. Detection runs automatically — or press "Re-run detection" to check right now.'
                  : 'Nothing in this state yet.'
              }
              action={
                status === 'OPEN' ? (
                  <Button variant="secondary" onClick={rerun} loading={rerunBusy}>
                    <Icon name="refresh-cw" size={16} /> Re-run detection
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="thead-sticky">
                  <tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800">
                    <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">Student</th>
                    <th scope="col" className="tnum px-4 py-3 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">Date</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">Detail</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-200 align-top last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3">
                        <Link href={`/students/${r.student.id}`} className="inline-block min-h-[44px] py-2 font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300">
                          {r.student.name}
                        </Link>
                        <p className="tnum text-xs text-slate-500 dark:text-slate-400">
                          {r.student.admissionNo} · {r.student.grade} Sec {r.student.section}
                        </p>
                      </td>
                      <td className="tnum px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-200">{r.date}</td>
                      <td className="px-4 py-3">
                        <p className="tnum text-sm text-slate-700 dark:text-slate-200">{r.detail}</p>
                        {r.note && (
                          <p className="mt-1 text-xs text-slate-500 italic dark:text-slate-400">Note: {r.note}</p>
                        )}
                        {r.status !== 'OPEN' && (
                          <Badge variant="neutral" className="mt-1">{r.status}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.status === 'OPEN' && (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setResolving(r);
                                setNote('');
                              }}
                            >
                              <Icon name="check" size={16} /> Resolve
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={actionBusy === r.id}
                              onClick={() => closeConflict(r, 'DISMISSED')}
                            >
                              Dismiss
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={resolving !== null}
        onClose={() => setResolving(null)}
        title={resolving ? `Resolve conflict — ${resolving.student.name}` : 'Resolve conflict'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResolving(null)}>
              Cancel
            </Button>
            <Button
              loading={actionBusy === resolving?.id}
              onClick={() => resolving && closeConflict(resolving, 'RESOLVED', note)}
            >
              <Icon name="check" size={16} /> Mark resolved
            </Button>
          </>
        }
      >
        <p className="tnum mb-3 text-sm text-slate-600 dark:text-slate-300">{resolving?.detail}</p>
        <Textarea
          label="Resolution note"
          placeholder="e.g. Student was sent to the office during period 2 for a medical check; register corrected."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
        />
      </Dialog>
    </div>
  );
}
