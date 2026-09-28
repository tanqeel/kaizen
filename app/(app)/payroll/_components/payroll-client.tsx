'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  EmptyState,
  FormGrid,
  Input,
  Select,
  Skeleton,
  Stat,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TRow,
} from '@/components/ui';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import type { PayslipRow } from '@/app/api/payroll/route';


const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

function pkr(n: number): string {
  return `Rs. ${n.toLocaleString('en-PK')}`;
}

function monthLabel(m: number, y: number): string {
  return `${MONTHS[m - 1]?.label ?? ''} ${y}`;
}

const STATUS_VARIANT: Record<PayslipRow['status'], 'neutral' | 'info' | 'paid'> = {
  DRAFT: 'neutral',
  GENERATED: 'info',
  PAID: 'paid',
};

/** Payroll list + generate + edit. Teachers/staff without payroll.manage see their own slips only. */
export function PayrollClient({ canManage }: { canManage: boolean }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [payslips, setPayslips] = useState<PayslipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<PayslipRow | null>(null);
  const [editAllowances, setEditAllowances] = useState('0');
  const [editDeductions, setEditDeductions] = useState('0');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = useCallback(async (m: number, y: number) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/payroll?month=${m}&year=${y}`, { credentials: 'same-origin' });
      if (!r.ok) throw new Error('Failed to load payslips.');
      const d = (await r.json()) as { payslips: PayslipRow[] };
      setPayslips(d.payslips);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load payslips.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(month, year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  const generate = async () => {
    if (!window.confirm(`Generate payslips for ${monthLabel(month, year)}? This creates slips only for staff who don't already have one.`)) return;
    setBusy(true);
    try {
      const r = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ month, year }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Failed to generate payroll.');
      alert(`Payroll generated: ${d.created} created, ${d.skipped} already existed.`);
      await load(month, year);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to generate payroll.');
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async (row: PayslipRow) => {
    if (!window.confirm(`Mark ${row.person.name}'s ${monthLabel(row.month, row.year)} payslip as PAID?`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/payroll/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ status: 'PAID' }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Failed to mark as paid.');
      await load(month, year);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to mark as paid.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: PayslipRow) => {
    if (!window.confirm(`Delete ${row.person.name}'s ${monthLabel(row.month, row.year)} payslip? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/payroll/${row.id}`, { method: 'DELETE', credentials: 'same-origin' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Failed to delete payslip.');
      await load(month, year);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete payslip.');
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (row: PayslipRow) => {
    setEditing(row);
    setEditAllowances(String(row.allowances));
    setEditDeductions(String(row.deductions));
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const allowances = Number(editAllowances);
    const deductions = Number(editDeductions);
    if (!Number.isInteger(allowances) || allowances < 0 || !Number.isInteger(deductions) || deductions < 0) {
      setEditError('Allowances and deductions must be whole numbers ≥ 0.');
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const r = await fetch(`/api/payroll/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ allowances, deductions }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Failed to update payslip.');
      setEditing(null);
      await load(month, year);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Failed to update payslip.');
    } finally {
      setEditSaving(false);
    }
  };

  const totalNet = payslips.reduce((s, p) => s + p.netPay, 0);
  const paidCount = payslips.filter((p) => p.status === 'PAID').length;

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 3 + i);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="min-w-[140px]">
            <Select
              id="pay-month"
              label="Month"
              value={String(month)}
              onChange={(e) => setMonth(Number(e.target.value))}
              options={MONTHS.map((m) => ({ value: String(m.value), label: m.label }))}
            />
          </div>
          <div className="min-w-[110px]">
            <Select
              id="pay-year"
              label="Year"
              value={String(year)}
              onChange={(e) => setYear(Number(e.target.value))}
              options={years.map((y) => ({ value: String(y), label: String(y) }))}
            />
          </div>
          {canManage && (
            <Button onClick={generate} disabled={busy} className="min-h-[44px]">
              <Icon name="plus" size={16} /> {busy ? 'Working…' : 'Generate payroll'}
            </Button>
          )}
        </CardContent>
      </Card>

      {!loading && payslips.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Payslips" value={String(payslips.length)} />
          <Stat label="Total net pay" value={pkr(totalNet)} />
          <Stat label="Paid" value={`${paidCount} / ${payslips.length}`} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="wallet" size={18} /> Payslips — {monthLabel(month, year)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" />
            </div>
          ) : error ? (
            <EmptyState icon="info" title="Couldn't load payslips" guidance={error} />
          ) : payslips.length === 0 ? (
            <EmptyState
              icon="wallet"
              title="No payslips"
              guidance={canManage
                ? `No payslips generated for ${monthLabel(month, year)} yet. Use “Generate payroll” above.`
                : `No payslip found for you for ${monthLabel(month, year)}.`}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TRow>
                    <TH>Name</TH>
                    <TH>Role</TH>
                    <TH>Base</TH>
                    <TH>Allowances</TH>
                    <TH>Deductions</TH>
                    <TH>Net pay</TH>
                    <TH>Status</TH>
                    {canManage && <TH className="text-right">Actions</TH>}
                    {!canManage && <TH className="text-right">Print</TH>}
                  </TRow>
                </THead>
                <TBody>
                  {payslips.map((p) => (
                    <TRow key={p.id}>
                      <TD className="font-medium">{p.person.name}</TD>
                      <TD>{p.person.role}</TD>
                      <TD className="tnum">{pkr(p.baseSalary)}</TD>
                      <TD className="tnum">{pkr(p.allowances)}</TD>
                      <TD className="tnum">{pkr(p.deductions)}</TD>
                      <TD className="tnum font-semibold">{pkr(p.netPay)}</TD>
                      <TD><Badge variant={STATUS_VARIANT[p.status]}>{p.status}</Badge></TD>
                      <TD className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Link
                            href={`/payroll/${p.id}`}
                            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            <Icon name="printer" size={14} /> Print
                          </Link>
                          {canManage && (
                            <>
                              <Button variant="secondary" size="sm" className="min-h-[44px]" onClick={() => openEdit(p)}>
                                Edit
                              </Button>
                              {p.status !== 'PAID' && (
                                <>
                                  <Button variant="secondary" size="sm" className="min-h-[44px]" onClick={() => markPaid(p)} disabled={busy}>
                                    <Icon name="check" size={14} /> Mark paid
                                  </Button>
                                  <Button variant="danger" size="sm" className="min-h-[44px]" onClick={() => remove(p)} disabled={busy}>
                                    Delete
                                  </Button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </TD>
                    </TRow>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Adjust — ${editing?.person.name ?? ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} className="min-h-[44px]">Cancel</Button>
            <Button onClick={saveEdit} disabled={editSaving} className="min-h-[44px]">
              {editSaving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        {editError && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{editError}</p>}
        <FormGrid>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="edit-allowances">Allowances (Rs.)</label>
            <Input
              id="edit-allowances"
              type="number"
              min={0}
              step={1}
              value={editAllowances}
              onChange={(e) => setEditAllowances(e.target.value)}
              className="min-h-[44px]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="edit-deductions">Deductions (Rs.)</label>
            <Input
              id="edit-deductions"
              type="number"
              min={0}
              step={1}
              value={editDeductions}
              onChange={(e) => setEditDeductions(e.target.value)}
              className="min-h-[44px]"
            />
          </div>
        </FormGrid>
        {editing && (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            New net pay: <strong className="tnum">{pkr(editing.baseSalary + Math.max(0, Math.floor(Number(editAllowances) || 0)) - Math.max(0, Math.floor(Number(editDeductions) || 0)))}</strong>
          </p>
        )}
      </Dialog>
    </div>
  );
}
