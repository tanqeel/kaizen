'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Badge, Button, Card, CardContent, EmptyState, Input,
  PageHeader, Table, THead, TBody, TRow, TH, TD,
} from '@/components/ui';
import { Icon, type IconName } from '@/components/icons';
import { todayPKT, pktDate } from '@/lib/format';

type Status = 'PRESENT' | 'ABSENT' | 'LEAVE' | 'LATE';
type PersonType = 'teacher' | 'staff';

interface Row {
  personType: PersonType;
  personId: string;
  name: string;
  designation: string;
  status: Status | null;
  note: string | null;
}

interface HistoryRow extends Row {
  date: string;
}

async function api(path: string, method: string, body?: unknown) {
  const r = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data };
}

interface StatusMeta {
  label: string;
  icon: IconName;
  badge: 'present' | 'absent' | 'pending' | 'info';
  active: string;
  idle: string;
}

const STATUS_META: Record<Status, StatusMeta> = {
  PRESENT: {
    label: 'Present', icon: 'check', badge: 'present',
    active: 'border-emerald-600 bg-emerald-600 text-white shadow-sm',
    idle: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-300 dark:hover:bg-emerald-500/10',
  },
  ABSENT: {
    label: 'Absent', icon: 'x', badge: 'absent',
    active: 'border-rose-600 bg-rose-600 text-white shadow-sm',
    idle: 'border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10',
  },
  LEAVE: {
    label: 'Leave', icon: 'calendar-days', badge: 'pending',
    active: 'border-amber-500 bg-amber-500 text-white shadow-sm',
    idle: 'border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/10',
  },
  LATE: {
    label: 'Late', icon: 'clock', badge: 'info',
    active: 'border-sky-600 bg-sky-600 text-white shadow-sm',
    idle: 'border-sky-300 text-sky-700 hover:bg-sky-50 dark:border-sky-500/40 dark:text-sky-300 dark:hover:bg-sky-500/10',
  },
};

const ORDER: Status[] = ['PRESENT', 'ABSENT', 'LEAVE', 'LATE'];

function StatusBadge({ status }: { status: Status | null }) {
  if (!status) {
    return <Badge variant="neutral">Not marked</Badge>;
  }
  const meta = STATUS_META[status];
  return (
    <Badge variant={meta.badge}>
      <Icon name={meta.icon} size={14} /> {meta.label}
    </Badge>
  );
}

/** Shift a YYYY-MM-DD date by n days (plain calendar math, DST-free). */
function shiftPKT(dateStr: string, days: number): string {
  return new Date(new Date(`${dateStr}T00:00:00Z`).getTime() + days * 86400000)
    .toISOString()
    .slice(0, 10);
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <div
      role={msg.ok ? 'status' : 'alert'}
      className={`mb-4 rounded-xl border px-4 py-3 text-sm ${msg.ok
        ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
        : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'}`}
    >
      {msg.text}
    </div>
  );
}

/* ------------------------------- Marker view ------------------------------ */

function MarkingView({ initialDate }: { initialDate: string }) {
  const [date, setDate] = useState(initialDate);
  const [rows, setRows] = useState<Row[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setMsg(null);
    const r = await api(`/api/staff-attendance?date=${d}`, 'GET');
    setLoading(false);
    if (r.ok) {
      const list = (r.data.rows ?? []) as Row[];
      setRows(list);
      setDrafts(Object.fromEntries(list.map((x) => [x.personId, x.note ?? ''])));
    } else {
      setMsg({ ok: false, text: String(r.data.error ?? 'Could not load attendance') });
    }
  }, []);

  useEffect(() => { void load(date); }, [date, load]);

  const counts = ORDER.map((s) => ({ status: s, count: rows.filter((r) => r.status === s).length }));
  const notMarked = rows.filter((r) => r.status === null).length;

  /** Save one row (status click or note save), with optimistic status update. */
  const save = async (row: Row, status: Status | null, note: string | null) => {
    if (savingId) return;
    setMsg(null);
    const prev = row.status;
    if (status !== null) {
      setRows((rs) => rs.map((x) => (x.personId === row.personId ? { ...x, status } : x)));
    }
    setSavingId(row.personId);
    const r = await api('/api/staff-attendance', 'POST', {
      date,
      personType: row.personType,
      personId: row.personId,
      status: status ?? row.status,
      note: (note ?? '').trim() === '' ? null : (note ?? '').trim(),
    });
    setSavingId(null);
    if (r.ok) {
      const saved = r.data.row as Row;
      setRows((rs) => rs.map((x) => (x.personId === row.personId ? { ...x, status: saved.status, note: saved.note } : x)));
      setDrafts((d) => ({ ...d, [row.personId]: saved.note ?? '' }));
      setMsg({ ok: true, text: `${row.name} marked ${STATUS_META[saved.status as Status].label}.` });
    } else {
      if (status !== null) {
        setRows((rs) => rs.map((x) => (x.personId === row.personId ? { ...x, status: prev } : x)));
      }
      setMsg({ ok: false, text: String(r.data.error ?? `Could not save attendance for ${row.name}`) });
    }
  };

  const today = todayPKT();

  return (
    <div>
      <PageHeader
        title="Staff Attendance"
        subtitle="Mark daily attendance for teachers and staff. A blank row means not marked yet — not absent."
        actions={
          <Input
            type="date"
            value={date}
            max={today}
            onChange={(e) => { if (e.target.value) setDate(e.target.value); }}
            aria-label="Attendance date"
            className="w-auto"
          />
        }
      />

      <Msg msg={msg} />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {counts.map(({ status, count }) => (
          <span key={status} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900">
            <StatusBadge status={status} />
            <span className="font-bold text-slate-900 dark:text-white">{count}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900">
          <StatusBadge status={null} />
          <span className="font-bold text-slate-900 dark:text-white">{notMarked}</span>
        </span>
      </div>

      {loading ? (
        <Card><CardContent><p className="py-6 text-center text-sm text-slate-500">Loading roster…</p></CardContent></Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="users"
          title="No active staff found"
          guidance="There are no active teachers or staff members to mark for this school."
        />
      ) : (
        <Table>
          <THead>
            <TRow>
              <TH>Person</TH>
              <TH>Status</TH>
              <TH>Note &amp; save</TH>
            </TRow>
          </THead>
          <TBody>
            {rows.map((row) => {
              const busy = savingId === row.personId;
              const draft = drafts[row.personId] ?? '';
              return (
                <TRow key={row.personId}>
                  <TD className="min-w-[140px]">
                    <p className="font-semibold text-slate-900 dark:text-white">{row.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {row.personType === 'teacher' ? 'Teacher' : row.designation}
                    </p>
                    <div className="mt-1"><StatusBadge status={row.status} /></div>
                  </TD>
                  <TD>
                    <div className="grid min-w-[220px] grid-cols-2 gap-1.5 sm:grid-cols-4 sm:min-w-[340px]" role="group" aria-label={`Mark ${row.name}`}>
                      {ORDER.map((s) => {
                        const meta = STATUS_META[s];
                        const active = row.status === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            disabled={busy}
                            aria-pressed={active}
                            title={`Mark ${row.name} as ${meta.label}`}
                            onClick={() => save(row, s, draft)}
                            className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border px-2 text-sm font-semibold transition-colors disabled:opacity-50 ${active ? meta.active : meta.idle}`}
                          >
                            <Icon name={meta.icon} size={16} />
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>
                  </TD>
                  <TD className="min-w-[200px]">
                    <div className="flex items-start gap-2">
                      <Input
                        value={draft}
                        onChange={(e) => setDrafts((d) => ({ ...d, [row.personId]: e.target.value }))}
                        placeholder="Note (optional)"
                        maxLength={500}
                        aria-label={`Note for ${row.name}`}
                        className="min-h-[44px] flex-1"
                        disabled={busy}
                      />
                      <Button
                        variant="secondary"
                        onClick={() => save(row, row.status, draft)}
                        disabled={busy || row.status === null}
                        title={row.status === null ? 'Pick a status first, then save the note' : `Save note for ${row.name}`}
                        className="min-h-[44px] shrink-0"
                      >
                        <Icon name="check" size={16} />
                        <span className="sr-only sm:not-sr-only">Save</span>
                      </Button>
                    </div>
                  </TD>
                </TRow>
              );
            })}
          </TBody>
        </Table>
      )}
    </div>
  );
}

/* ------------------------------ History view ---------------------------- */

function HistoryView({ initialDate }: { initialDate: string }) {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const to = initialDate;
      const from = shiftPKT(to, -29);
      const r = await api(`/api/staff-attendance?from=${from}&to=${to}`, 'GET');
      setLoading(false);
      if (r.ok) setHistory((r.data.rows ?? []) as HistoryRow[]);
      else setMsg({ ok: false, text: String(r.data.error ?? 'Could not load your attendance history') });
    };
    void run();
  }, [initialDate]);

  const counts = ORDER.map((s) => ({ status: s, count: history.filter((h) => h.status === s).length }));
  const notMarked = history.filter((h) => h.status === null).length;

  return (
    <div>
      <PageHeader
        title="My Attendance"
        subtitle="Your staff attendance for the last 30 days. Not marked means no one recorded attendance that day — it is not the same as absent."
      />

      <Msg msg={msg} />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {counts.map(({ status, count }) => (
          <span key={status} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900">
            <StatusBadge status={status} />
            <span className="font-bold text-slate-900 dark:text-white">{count}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900">
          <StatusBadge status={null} />
          <span className="font-bold text-slate-900 dark:text-white">{notMarked}</span>
        </span>
      </div>

      {loading ? (
        <Card><CardContent><p className="py-6 text-center text-sm text-slate-500">Loading your history…</p></CardContent></Card>
      ) : history.length === 0 ? (
        <EmptyState
          icon="clipboard-check"
          title="No staff record linked to your account"
          guidance="Ask your administrator to link your login to your teacher or staff profile — your attendance history will appear here."
        />
      ) : (
        <Card>
          <CardContent className="divide-y divide-slate-100 p-0 dark:divide-slate-800">
            {history.map((h) => (
              <div key={h.date} className="flex min-h-[56px] items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{pktDate(h.date)}</p>
                  {h.note && (
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{h.note}</p>
                  )}
                </div>
                <StatusBadge status={h.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* --------------------------------- Entry --------------------------------- */

export function StaffAttendanceClient({
  canMark,
  initialDate,
}: {
  canMark: boolean;
  initialDate: string;
}) {
  return canMark
    ? <MarkingView initialDate={initialDate} />
    : <HistoryView initialDate={initialDate} />;
}
