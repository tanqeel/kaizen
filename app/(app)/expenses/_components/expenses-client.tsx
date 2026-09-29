'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, EmptyState,
  FormGrid, Input, PageHeader, Select, Skeleton, Stat, Table, TBody, TD, TH, THead, TRow,
  Tabs, useConfirm,
} from '@/components/ui';
import { Icon, type IconName } from '@/components/icons';
import { pkr, pktDate, pktDateTime, todayPKT } from '@/lib/format';
import type { ExpenseRow } from '@/app/api/expenses/route';
import type { ExpenseRequestRow } from '@/app/api/expense-requests/route';
import type { BudgetRow } from '@/app/api/finance/budgets/route';
import type { PnlResult } from '@/app/api/finance/pnl/route';
import { safeJson } from '@/lib/api-client';

interface Option { id: string; name: string }

function currentMonth(): string {
  return todayPKT().slice(0, 7);
}

export function ExpensesClient({ heads, sources, canApprove, userId }: {
  heads: Option[]; sources: Option[]; canApprove: boolean; userId: string;
}) {
  // Admin-only page (finance.manage). All tabs visible.
  const [tab, setTab] = useState('expenses');
  const tabs: { id: string; label: string; icon: IconName }[] = [
    { id: 'expenses', label: 'Expenses', icon: 'receipt-text' },
    { id: 'requests', label: 'Requests', icon: 'clipboard-check' as IconName },
    { id: 'budgets', label: 'Budgets', icon: 'wallet' },
    { id: 'pnl', label: 'P&L', icon: 'dashboard' },
  ];

  return (
    <div>
      <PageHeader
        title="Expenses & Budgets"
        subtitle="School spending, expense requests, planned budgets, and monthly profit & loss."
      />
      <Tabs
        tabs={tabs}
        value={tab}
        onChange={setTab}
        className="mb-6"
      />
      {tab === 'expenses' && <ExpensesTab heads={heads} sources={sources} />}
      {tab === 'requests' && <RequestsTab heads={heads} sources={sources} canApprove={canApprove} userId={userId} />}
      {tab === 'budgets' && <BudgetsTab heads={heads} />}
      {tab === 'pnl' && <PnlTab />}
    </div>
  );
}

/* --------------------------------- Expenses ------------------------------- */

function ExpensesTab({ heads, sources }: { heads: Option[]; sources: Option[] }) {
  const confirm = useConfirm();
  const [month, setMonth] = useState(currentMonth());
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/expenses?month=${month}`, { cache: 'no-store' });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setRows(data.expenses);
      setTotal(data.total);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    if (!(await confirm({ title: 'Delete expense?', message: 'This expense entry will be removed permanently.', confirmLabel: 'Delete' }))) return;
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    load();
  };

  const exportCsv = () => {
    window.location.href = `/api/expenses?month=${month}&format=csv`;
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Input label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value || currentMonth())} className="w-44" />
          <Button variant="secondary" onClick={exportCsv} disabled={rows.length === 0}>
            <Icon name="download" size={18} /> CSV
          </Button>
        </div>
        <Button onClick={() => setFormOpen(true)} disabled={heads.length === 0 || sources.length === 0}>
          <Icon name="plus" size={18} /> Add expense
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Expenses this month" value={pkr(total)} icon="receipt-text" tone="overdue" />
        <Stat label="Entries" value={String(rows.length)} icon="info" tone="neutral" />
      </div>

      {loading ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <EmptyState icon="receipt-text" title="No expenses recorded" guidance={`No expense entries for ${month}. Add the first one to start tracking spending.`} />
      ) : (
        <Table>
          <THead>
            <TRow>
              <TH>Date</TH>
              <TH>Head</TH>
              <TH>Source</TH>
              <TH>Description</TH>
              <TH className="text-right">Amount</TH>
              <TH>Added by</TH>
              <TH><span className="sr-only">Delete</span></TH>
            </TRow>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TRow key={r.id}>
                <TD className="tnum whitespace-nowrap">{pktDate(r.date)}</TD>
                <TD><Badge variant="info">{r.head.name}</Badge></TD>
                <TD className="whitespace-nowrap">{r.source.name}</TD>
                <TD className="max-w-56 truncate">{r.description ?? '—'}</TD>
                <TD className="tnum text-right font-semibold">{pkr(r.amount)}</TD>
                <TD className="whitespace-nowrap">{r.addedBy ?? '—'}</TD>
                <TD>
                  <Button variant="ghost" size="icon" onClick={() => remove(r.id)} aria-label={`Delete expense of ${pkr(r.amount)}`}>
                    <Icon name="x" size={18} />
                  </Button>
                </TD>
              </TRow>
            ))}
          </TBody>
        </Table>
      )}

      <ExpenseForm open={formOpen} onClose={() => setFormOpen(false)} heads={heads} sources={sources} onSaved={load} />
    </div>
  );
}

function ExpenseForm({
  open, onClose, heads, sources, onSaved,
}: {
  open: boolean; onClose: () => void; heads: Option[]; sources: Option[];
  onSaved: () => void;
}) {
  const [date, setDate] = useState(todayPKT());
  const [headId, setHeadId] = useState(heads[0]?.id ?? '');
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          headId,
          sourceId,
          amount: parseInt(amount, 10),
          description: description.trim() || undefined,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');
      setAmount('');
      setDescription('');
      onClose();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add expense"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={busy} disabled={!amount || parseInt(amount, 10) <= 0}>
            <Icon name="check" size={18} /> Save expense
          </Button>
        </>
      }
    >
      <FormGrid>
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayPKT()} required />
        <Input
          label="Amount (PKR)"
          type="number"
          min={1}
          placeholder="e.g. 12500"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <Select
          label="Expense head"
          value={headId}
          onChange={(e) => setHeadId(e.target.value)}
          options={heads.map((h) => ({ value: h.id, label: h.name }))}
          required
        />
        <Select
          label="Paid from"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          options={sources.map((s) => ({ value: s.id, label: s.name }))}
          required
        />
        <Input
          label="Description"
          placeholder="What was this for?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="sm:col-span-2"
        />
        {error && <p role="alert" className="text-sm text-rose-600 sm:col-span-2 dark:text-rose-400">{error}</p>}
      </FormGrid>
    </Dialog>
  );
}

/* ---------------------------- Expense requests ---------------------------- */

const REQUEST_STATUS_BADGE: Record<ExpenseRequestRow['status'], 'pending' | 'present' | 'overdue'> = {
  PENDING: 'pending',
  APPROVED: 'present',
  REJECTED: 'overdue',
};

function RequestsTab({ heads, sources, canApprove, userId }: {
  heads: Option[]; sources: Option[]; canApprove: boolean; userId: string;
}) {
  const confirm = useConfirm();
  const [rows, setRows] = useState<ExpenseRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<ExpenseRequestRow | null>(null);

  // New-request form state
  const [title, setTitle] = useState('');
  const [headId, setHeadId] = useState(heads[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/expense-requests', { cache: 'no-store' });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setRows(data.requests);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load requests');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pending = rows.filter((r) => r.status === 'PENDING');
  const history = rows.filter((r) => r.status !== 'PENDING');

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/expense-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          amount: parseInt(amount, 10),
          headId,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit');
      setTitle('');
      setAmount('');
      setDescription('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const reject = async (r: ExpenseRequestRow) => {
    if (!(await confirm({
      title: 'Reject request?',
      message: `Reject "${r.title}" (${pkr(r.amount)}) requested by ${r.requestedBy}? No expense entry will be created.`,
      confirmLabel: 'Reject',
    }))) return;
    const res = await fetch(`/api/expense-requests/${r.id}/reject`, { method: 'POST' });
    const data = await safeJson(res);
    if (!res.ok) {
      setError(data.error ?? 'Failed to reject');
      return;
    }
    load();
  };

  return (
    <div className="space-y-6">
      {/* New request */}
      <Card>
        <CardHeader><CardTitle>New expense request</CardTitle></CardHeader>
        <CardContent>
          {heads.length === 0 ? (
            <EmptyState icon="receipt-text" title="No expense heads" guidance="Ask an admin to add expense heads before submitting a request." />
          ) : (
            <FormGrid>
              <Input
                label="Title"
                placeholder="e.g. Printer cartridges for office"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="sm:col-span-2"
              />
              <Select
                label="Expense head"
                value={headId}
                onChange={(e) => setHeadId(e.target.value)}
                options={heads.map((h) => ({ value: h.id, label: h.name }))}
                required
              />
              <Input
                label="Amount (PKR)"
                type="number"
                min={1}
                placeholder="e.g. 8500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <Input
                label="Description (optional)"
                placeholder="Why is this needed?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="sm:col-span-2"
              />
              <div className="sm:col-span-2">
                <Button
                  onClick={submit}
                  loading={submitting}
                  disabled={!title.trim() || !amount || parseInt(amount, 10) <= 0 || !headId}
                >
                  <Icon name="check" size={18} /> Submit for approval
                </Button>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Your request goes to a principal / admin for approval. Approved requests are recorded as expenses automatically.
                </p>
              </div>
            </FormGrid>
          )}
        </CardContent>
      </Card>

      {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      {loading ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          {/* Pending */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Pending approval ({pending.length})
            </h3>
            {pending.length === 0 ? (
              <EmptyState icon="clipboard-check" title="Nothing waiting" guidance="No expense requests are pending right now." />
            ) : (
              <Table>
                <THead>
                  <TRow>
                    <TH>Request</TH>
                    <TH>Head</TH>
                    <TH className="text-right">Amount</TH>
                    <TH>Requested by</TH>
                    <TH>Requested</TH>
                    {canApprove && <TH><span className="sr-only">Actions</span></TH>}
                  </TRow>
                </THead>
                <TBody>
                  {pending.map((r) => {
                    const own = r.requestedById === userId;
                    return (
                      <TRow key={r.id}>
                        <TD>
                          <div className="font-medium text-slate-900 dark:text-white">{r.title}</div>
                          {r.description && <div className="max-w-56 truncate text-xs text-slate-500">{r.description}</div>}
                        </TD>
                        <TD><Badge variant="info">{r.head.name}</Badge></TD>
                        <TD className="tnum text-right font-semibold">{pkr(r.amount)}</TD>
                        <TD className="whitespace-nowrap">{r.requestedBy}</TD>
                        <TD className="tnum whitespace-nowrap">{pktDateTime(r.createdAt)}</TD>
                        {canApprove && (
                          <TD>
                            {own ? (
                              <span className="text-xs text-slate-500">Waiting for another approver</span>
                            ) : (
                              <div className="flex min-h-[44px] items-center gap-2">
                                <Button size="sm" onClick={() => setApproveTarget(r)}>
                                  <Icon name="check" size={16} /> Approve
                                </Button>
                                <Button size="sm" variant="danger" onClick={() => reject(r)}>
                                  <Icon name="x" size={16} /> Reject
                                </Button>
                              </div>
                            )}
                          </TD>
                        )}
                      </TRow>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </div>

          {/* History */}
          {history.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Request history ({history.length})
              </h3>
              <Table>
                <THead>
                  <TRow>
                    <TH>Request</TH>
                    <TH className="text-right">Amount</TH>
                    <TH>Requested by</TH>
                    <TH>Status</TH>
                    <TH>Decided</TH>
                  </TRow>
                </THead>
                <TBody>
                  {history.map((r) => (
                    <TRow key={r.id}>
                      <TD>
                        <div className="font-medium text-slate-900 dark:text-white">{r.title}</div>
                        {r.description && <div className="max-w-56 truncate text-xs text-slate-500">{r.description}</div>}
                      </TD>
                      <TD className="tnum text-right font-semibold">{pkr(r.amount)}</TD>
                      <TD className="whitespace-nowrap">{r.requestedBy}</TD>
                      <TD><Badge variant={REQUEST_STATUS_BADGE[r.status]}>{r.status}</Badge></TD>
                      <TD className="whitespace-nowrap text-xs text-slate-500">
                        {r.decidedBy && r.decidedAt ? `${r.decidedBy} · ${pktDate(r.decidedAt)}` : '—'}
                      </TD>
                    </TRow>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </>
      )}

      <ApproveRequestDialog
        key={approveTarget?.id ?? 'closed'}
        request={approveTarget}
        sources={sources}
        onClose={() => setApproveTarget(null)}
        onApproved={() => { setApproveTarget(null); load(); }}
        onError={setError}
      />
    </div>
  );
}

function ApproveRequestDialog({ request, sources, onClose, onApproved, onError }: {
  request: ExpenseRequestRow | null;
  sources: Option[];
  onClose: () => void;
  onApproved: () => void;
  onError: (msg: string | null) => void;
}) {
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  // Remounted per request (parent passes a key), so the initial sourceId is fresh each time.

  const approve = async () => {
    if (!request || !sourceId) return;
    setBusy(true);
    onError(null);
    try {
      const res = await fetch(`/api/expense-requests/${request.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error ?? 'Failed to approve');
      onApproved();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to approve');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!request}
      onClose={onClose}
      title="Approve expense request"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={approve} loading={busy} disabled={!sourceId}>
            <Icon name="check" size={18} /> Approve & record expense
          </Button>
        </>
      }
    >
      {request && (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800">
            <div className="font-medium text-slate-900 dark:text-white">{request.title}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-slate-500">
              <Badge variant="info">{request.head.name}</Badge>
              <span className="tnum font-semibold text-slate-900 dark:text-white">{pkr(request.amount)}</span>
              <span>·</span>
              <span>{request.requestedBy}</span>
            </div>
          </div>
          {sources.length === 0 ? (
            <EmptyState icon="wallet" title="No payment sources" guidance="Ask an admin to add payment sources before approving expenses." />
          ) : (
            <Select
              label="Pay from"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              options={sources.map((s) => ({ value: s.id, label: s.name }))}
              required
            />
          )}
        </div>
      )}
    </Dialog>
  );
}

/* --------------------------------- Budgets -------------------------------- */

function BudgetsTab({ heads }: { heads: Option[] }) {
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [session, setSession] = useState('');
  const [totals, setTotals] = useState({ planned: 0, actual: 0 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/finance/budgets', { cache: 'no-store' });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setRows(data.budgets);
      setTotals(data.totals);
      setSession(data.session);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (headId: string) => {
    const raw = editing[headId];
    const plannedAmount = raw === undefined || raw === '' ? 0 : parseInt(raw, 10);
    if (!Number.isInteger(plannedAmount) || plannedAmount < 0) return;
    setSaving(headId);
    try {
      const res = await fetch('/api/finance/budgets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headId, plannedAmount }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');
      setEditing((e) => { const c = { ...e }; delete c[headId]; return c; });
      load();
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <Skeleton className="h-64" />;
  if (heads.length === 0) {
    return <EmptyState icon="wallet" title="No expense heads" guidance="Add expense heads first, then set a planned budget for each." />;
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label={`Planned · ${session}`} value={pkr(totals.planned)} icon="wallet" tone="info" />
        <Stat label="Spent so far" value={pkr(totals.actual)} icon="receipt-text" tone={totals.actual > totals.planned && totals.planned > 0 ? 'overdue' : 'neutral'} />
        <Stat label="Remaining" value={pkr(totals.planned - totals.actual)} icon="check" tone={totals.planned - totals.actual >= 0 ? 'present' : 'overdue'} />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table wrapperClassName="rounded-none border-0">
            <THead>
              <TRow>
                <TH>Head</TH>
                <TH className="text-right">Planned</TH>
                <TH className="text-right">Actual</TH>
                <TH className="w-1/3">Utilisation</TH>
                <TH><span className="sr-only">Save</span></TH>
              </TRow>
            </THead>
            <TBody>
              {rows.map((r) => {
                const pct = r.planned > 0 ? Math.min(100, Math.round((r.actual / r.planned) * 100)) : r.actual > 0 ? 100 : 0;
                const over = r.planned > 0 && r.actual > r.planned;
                return (
                  <TRow key={r.headId}>
                    <TD className="font-medium text-slate-900 dark:text-white">{r.head}</TD>
                    <TD>
                      <div className="flex items-center justify-end gap-2">
                        <Input
                          aria-label={`Planned budget for ${r.head}`}
                          type="number"
                          min={0}
                          className="w-32"
                          value={editing[r.headId] ?? String(r.planned)}
                          onChange={(e) => setEditing((prev) => ({ ...prev, [r.headId]: e.target.value }))}
                        />
                      </div>
                    </TD>
                    <TD className="tnum text-right">{pkr(r.actual)}</TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 min-w-24 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${r.head} budget utilisation`}>
                          <div
                            className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-brand-600 dark:bg-brand-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`tnum w-12 text-right text-xs font-semibold ${over ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}`}>
                          {pct}%
                        </span>
                      </div>
                    </TD>
                    <TD>
                      <Button size="sm" variant="secondary" loading={saving === r.headId} onClick={() => save(r.headId)} disabled={editing[r.headId] === undefined}>
                        Save
                      </Button>
                    </TD>
                  </TRow>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Actuals are real expense entries in the current session ({session || '—'}). Planned amounts save per head immediately.
      </p>
    </div>
  );
}

/* ----------------------------------- P&L ---------------------------------- */

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash', BANK_TRANSFER: 'Bank Transfer', KUICKPAY_1LINK: 'Kuickpay / 1Link',
  JAZZCASH: 'JazzCash', EASYPAISA: 'Easypaisa',
};

function PnlTab() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<PnlResult | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/pnl?month=${month}`, { cache: 'no-store' });
      const d = await safeJson(res);
      if (!res.ok) throw new Error(d.error ?? 'Failed');
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="mb-4">
        <Input label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value || currentMonth())} className="w-44" />
      </div>
      {loading || !data ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Income (fee collection)" value={pkr(data.income)} icon="check" tone="present" />
            <Stat label="Expenses" value={pkr(data.expenses)} icon="receipt-text" tone="overdue" />
            <Stat label="Net" value={pkr(data.net)} sub={data.net >= 0 ? 'Surplus' : 'Deficit'} icon="dashboard" tone={data.net >= 0 ? 'present' : 'overdue'} />
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Expenses by head</CardTitle></CardHeader>
              <CardContent>
                {data.byHead.length === 0 ? (
                  <EmptyState icon="receipt-text" title="No expenses" guidance={`No expenses recorded in ${month}.`} />
                ) : (
                  <Table>
                    <THead><TRow><TH>Head</TH><TH className="text-right">Amount</TH></TRow></THead>
                    <TBody>
                      {data.byHead.map((b) => (
                        <TRow key={b.head}>
                          <TD>{b.head}</TD>
                          <TD className="tnum text-right font-semibold">{pkr(b.amount)}</TD>
                        </TRow>
                      ))}
                    </TBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Income by payment method</CardTitle></CardHeader>
              <CardContent>
                {data.byMethod.length === 0 ? (
                  <EmptyState icon="wallet" title="No income" guidance={`No fee payments recorded in ${month}.`} />
                ) : (
                  <Table>
                    <THead><TRow><TH>Method</TH><TH className="text-right">Collected</TH></TRow></THead>
                    <TBody>
                      {data.byMethod.map((b) => (
                        <TRow key={b.method}>
                          <TD>{METHOD_LABELS[b.method] ?? b.method}</TD>
                          <TD className="tnum text-right font-semibold text-emerald-700 dark:text-emerald-300">{pkr(b.amount)}</TD>
                        </TRow>
                      ))}
                    </TBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
