'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Badge, Button, Card, CardContent, Dialog, EmptyState, FormGrid, Input,
  PageHeader, Select, Skeleton, Stat, Table, TBody, TD, TH, THead, TRow, Tabs,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { pkr, pktDate, todayPKT } from '@/lib/format';
import { MONTHS, monthLabel, statusBadgeVariant, type DisplayStatus } from '@/lib/fees';
import FeePolicyCard from './fee-policy-card';
import type { VoucherRow, VoucherSummary } from '@/app/api/fees/vouchers/route';

interface GradeOption {
  id: string;
  name: string;
  level: number;
  sections: Array<{ id: string; name: string }>;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
];

function statusLabel(s: DisplayStatus): string {
  return s === 'PAID' ? 'Paid' : s === 'PARTIAL' ? 'Partial' : s === 'OVERDUE' ? 'Overdue' : 'Unpaid';
}

export function FeesClient({ canManage, grades }: { canManage: boolean; grades: GradeOption[] }) {
  const now = todayPKT();
  const [tab, setTab] = useState('vouchers');
  const [month, setMonth] = useState(parseInt(now.slice(5, 7), 10));
  const [year, setYear] = useState(parseInt(now.slice(0, 4), 10));
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [rows, setRows] = useState<VoucherRow[]>([]);
  const [summary, setSummary] = useState<VoucherSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [genOpen, setGenOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const isDefaulters = tab === 'defaulters';
  const effectiveStatus = isDefaulters ? 'overdue' : status === 'all' ? '' : status;

  const query = useMemo(() => {
    const p = new URLSearchParams({ month: String(month), year: String(year) });
    if (effectiveStatus) p.set('status', effectiveStatus);
    if (qDebounced.trim()) p.set('q', qDebounced.trim());
    return p.toString();
  }, [month, year, effectiveStatus, qDebounced]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fees/vouchers?${query}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load vouchers');
      setRows(data.vouchers);
      setSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load vouchers');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = () => {
    window.location.href = `/api/fees/vouchers?${query}&format=csv`;
  };

  return (
    <div>
      <PageHeader
        title="Fee Management"
        subtitle="Monthly vouchers, payments, and the defaulter list."
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv} disabled={rows.length === 0}>
              <Icon name="download" size={18} /> Export CSV
            </Button>
            {canManage && (
              <Button onClick={() => setGenOpen(true)}>
                <Icon name="plus" size={18} /> Generate vouchers
              </Button>
            )}
          </>
        }
      />

      <Tabs
        tabs={[
          { id: 'vouchers', label: 'Vouchers', icon: 'receipt-text' },
          { id: 'defaulters', label: 'Defaulters', icon: 'alert-triangle' },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-6"
      />

      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Vouchers" value={String(summary.count)} icon="receipt-text" tone="info" />
          <Stat label="Billed" value={pkr(summary.billed)} icon="wallet" tone="neutral" />
          <Stat label="Collected" value={pkr(summary.collected)} icon="check" tone="present" />
          <Stat
            label={isDefaulters ? 'Total outstanding' : 'Outstanding'}
            value={pkr(summary.outstanding)}
            icon="alert-triangle"
            tone="overdue"
          />
        </div>
      )}

      <FeePolicyCard canManage={canManage} />

      {!isDefaulters && (
        <Card className="mb-6">
          <CardContent className="flex flex-wrap items-end gap-3">
            <Select
              label="Month"
              value={String(month)}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
              options={MONTHS.map((m) => ({ value: String(m.value), label: m.label }))}
              className="w-40"
            />
            <Input
              label="Year"
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10) || year)}
              className="w-32"
            />
            <Select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={STATUS_OPTIONS}
              className="w-44"
            />
            <div className="relative min-w-52 flex-1">
              <Input
                label="Search student"
                placeholder="Name or admission no…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Button variant="secondary" onClick={load} aria-label="Refresh list">
              <Icon name="refresh-cw" size={18} />
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Skeleton className="h-64" />
      ) : error ? (
        <EmptyState icon="alert-triangle" title="Couldn't load vouchers" guidance={error} action={<Button onClick={load}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="receipt-text"
          title={isDefaulters ? 'No defaulters' : 'No vouchers found'}
          guidance={
            isDefaulters
              ? `Nobody is overdue for ${monthLabel(month, year)}.`
              : canManage
                ? `No vouchers for ${monthLabel(month, year)} yet. Generate them to get started.`
                : `No vouchers for ${monthLabel(month, year)} match these filters.`
          }
        />
      ) : (
        <Table>
          <THead>
            <TRow>
              <TH>Student</TH>
              <TH>Class</TH>
              <TH>Due date</TH>
              <TH className="text-right">Total</TH>
              <TH className="text-right">Paid</TH>
              <TH className="text-right">Balance</TH>
              <TH>Status</TH>
              <TH><span className="sr-only">Actions</span></TH>
            </TRow>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TRow key={r.id}>
                <TD>
                  <div className="font-medium text-slate-900 dark:text-white">{r.student.name}</div>
                  <div className="tnum text-xs text-slate-500">{r.student.admissionNo}</div>
                </TD>
                <TD className="whitespace-nowrap">{r.student.grade} · {r.student.section}</TD>
                <TD className="tnum whitespace-nowrap">{pktDate(r.dueDate)}</TD>
                <TD className="tnum text-right">{pkr(r.payable)}</TD>
                <TD className="tnum text-right text-emerald-700 dark:text-emerald-300">{pkr(r.paid)}</TD>
                <TD className="tnum text-right font-semibold">{pkr(r.balance)}</TD>
                <TD>
                  <Badge variant={statusBadgeVariant(r.displayStatus)}>{statusLabel(r.displayStatus)}</Badge>
                </TD>
                <TD>
                  <Link
                    href={`/fees/${r.id}`}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-lg px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
                  >
                    <Icon name="eye" size={18} /> View
                  </Link>
                </TD>
              </TRow>
            ))}
          </TBody>
        </Table>
      )}

      {canManage && (
        <GenerateDialog open={genOpen} onClose={() => setGenOpen(false)} grades={grades} onDone={load} />
      )}
    </div>
  );
}

function GenerateDialog({
  open, onClose, grades, onDone,
}: {
  open: boolean;
  onClose: () => void;
  grades: GradeOption[];
  onDone: () => void;
}) {
  const now = todayPKT();
  const [gradeId, setGradeId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [month, setMonth] = useState(parseInt(now.slice(5, 7), 10));
  const [year, setYear] = useState(parseInt(now.slice(0, 4), 10));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sections = gradeId ? (grades.find((g) => g.id === gradeId)?.sections ?? []) : grades.flatMap((g) => g.sections);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/fees/vouchers/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(gradeId ? { gradeId } : {}),
          ...(sectionId ? { sectionId } : {}),
          month, year,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Generation failed');
      setResult({ created: data.created, skipped: data.skipped });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => { setResult(null); setError(null); onClose(); }}
      title="Generate fee vouchers"
      footer={
        result ? (
          <Button onClick={() => { setResult(null); onClose(); }}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} loading={busy}>
              <Icon name="plus" size={18} /> Generate
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            <Icon name="check" size={24} />
          </span>
          <p className="text-base font-semibold text-slate-900 dark:text-white">
            {result.created} voucher{result.created === 1 ? '' : 's'} created
          </p>
          <p className="tnum text-sm text-slate-500 dark:text-slate-400">
            {result.skipped} skipped (already existed for {monthLabel(month, year)})
          </p>
        </div>
      ) : (
        <FormGrid>
          <Select
            label="Grade"
            value={gradeId}
            onChange={(e) => { setGradeId(e.target.value); setSectionId(''); }}
            options={[{ value: '', label: 'All grades' }, ...grades.map((g) => ({ value: g.id, label: g.name }))]}
          />
          <Select
            label="Section"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            options={[{ value: '', label: 'All sections' }, ...sections.map((s) => ({ value: s.id, label: `Section ${s.name}` }))]}
          />
          <Select
            label="Billing month"
            value={String(month)}
            onChange={(e) => setMonth(parseInt(e.target.value, 10))}
            options={MONTHS.map((m) => ({ value: String(m.value), label: m.label }))}
          />
          <Input
            label="Billing year"
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10) || year)}
          />
          <p className="-mt-1 text-xs text-slate-500 sm:col-span-2 dark:text-slate-400">
            Due date is the 10th of the billing month. Students who already have a voucher for this month are skipped automatically.
          </p>
          {error && (
            <p role="alert" className="text-sm text-rose-600 sm:col-span-2 dark:text-rose-400">{error}</p>
          )}
        </FormGrid>
      )}
    </Dialog>
  );
}
