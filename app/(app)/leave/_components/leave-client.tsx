'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Badge, Button, Card, CardContent, Dialog, EmptyState, Input,
  PageHeader, Select, Table, TBody, TD, TH, THead, TRow, Tabs, Textarea,
  useConfirm,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { pktDate, todayPKT } from '@/lib/format';

type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface Leave {
  id: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: LeaveStatus;
  who: string;
  whoKind: string;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
}

interface ChildOption { id: string; name: string; }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function api(path: string, method: string, body?: unknown) {
  const r = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data };
}

function StatusBadge({ status }: { status: LeaveStatus }) {
  const variant = status === 'PENDING' ? 'pending' : status === 'APPROVED' ? 'present' : 'absent';
  return <Badge variant={variant}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}

function dateRange(l: Leave) {
  const from = l.fromDate;
  const to = l.toDate;
  return from === to ? from : `${from} → ${to}`;
}

const emptyForm = { studentId: '', fromDate: '', toDate: '', reason: '' };

export function LeaveClient({
  initialLeaves, pendingCount, canManage, isParent, children,
}: {
  initialLeaves: Leave[];
  pendingCount: number;
  canManage: boolean;
  isParent: boolean;
  children: ChildOption[];
}) {
  const confirm = useConfirm();
  const [tab, setTab] = useState('mine');

  const [leaves, setLeaves] = useState<Leave[]>(initialLeaves);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Apply dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Approvals tab
  const [statusFilter, setStatusFilter] = useState<'ALL' | LeaveStatus>('PENDING');
  const [queue, setQueue] = useState<Leave[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueCount, setQueueCount] = useState(pendingCount);
  const [deciding, setDeciding] = useState<string | null>(null);

  const loadMine = useCallback(async () => {
    setLoading(true);
    const r = await api('/api/leave', 'GET');
    setLoading(false);
    if (r.ok) setLeaves((r.data.leaves ?? []) as Leave[]);
    else setMsg({ ok: false, text: String(r.data.error ?? 'Could not load your requests') });
  }, []);

  const loadQueue = useCallback(async (status: 'ALL' | LeaveStatus) => {
    setQueueLoading(true);
    const r = await api(`/api/leave?scope=all&status=${status}`, 'GET');
    setQueueLoading(false);
    if (r.ok) {
      setQueue((r.data.leaves ?? []) as Leave[]);
      if (status === 'PENDING') setQueueCount((r.data.leaves ?? []).length);
    } else {
      setMsg({ ok: false, text: String(r.data.error ?? 'Could not load requests') });
    }
  }, []);

  useEffect(() => {
    if (canManage && tab === 'approvals') void loadQueue(statusFilter);
  }, [canManage, tab, statusFilter, loadQueue]);

  const set = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  const canApply = () => {
    if (isParent && !form.studentId) return false;
    if (!form.fromDate || !form.toDate) return false;
    if (!DATE_RE.test(form.fromDate) || !DATE_RE.test(form.toDate)) return false;
    if (form.fromDate > form.toDate) return false;
    if (!form.reason.trim()) return false;
    return !saving;
  };

  const apply = async () => {
    if (!canApply()) return;
    setSaving(true);
    setMsg(null);
    const r = await api('/api/leave', 'POST', {
      forType: isParent ? 'child' : 'self',
      studentId: isParent ? form.studentId : undefined,
      fromDate: form.fromDate,
      toDate: form.toDate,
      reason: form.reason.trim(),
    });
    setSaving(false);
    if (r.ok) {
      setDialogOpen(false);
      setForm(emptyForm);
      setMsg({ ok: true, text: 'Leave request submitted.' });
      void loadMine();
    } else {
      setMsg({ ok: false, text: String(r.data.error ?? 'Could not submit request') });
    }
  };

  const cancelMine = async (l: Leave) => {
    if (!(await confirm({
      title: 'Cancel this leave request?',
      message: `Cancel your request for ${dateRange(l)}?`,
      confirmLabel: 'Cancel request',
    }))) return;
    const r = await api(`/api/leave/${l.id}`, 'DELETE');
    if (r.ok) {
      setMsg({ ok: true, text: 'Leave request cancelled.' });
      void loadMine();
    } else {
      setMsg({ ok: false, text: String(r.data.error ?? 'Could not cancel') });
    }
  };

  const decide = async (l: Leave, action: 'approve' | 'reject') => {
    if (!(await confirm({
      title: action === 'approve' ? 'Approve this leave?' : 'Reject this leave?',
      message: `${action === 'approve' ? 'Approve' : 'Reject'} leave for ${l.who} (${dateRange(l)})?`,
      confirmLabel: action === 'approve' ? 'Approve' : 'Reject',
    }))) return;
    setDeciding(l.id);
    const r = await api(`/api/leave/${l.id}`, 'POST', { action });
    setDeciding(null);
    if (r.ok) {
      setMsg({ ok: true, text: `Leave ${action === 'approve' ? 'approved' : 'rejected'}.` });
      void loadQueue(statusFilter);
    } else {
      setMsg({ ok: false, text: String(r.data.error ?? `Could not ${action}`) });
    }
  };

  const deleteAny = async (l: Leave) => {
    if (!(await confirm({
      title: 'Delete this leave request?',
      message: `Delete the ${l.status.toLowerCase()} request for ${l.who} (${dateRange(l)})? This cannot be undone.`,
      confirmLabel: 'Delete',
    }))) return;
    const r = await api(`/api/leave/${l.id}`, 'DELETE');
    if (r.ok) {
      setMsg({ ok: true, text: 'Leave request deleted.' });
      void loadQueue(statusFilter);
    } else {
      setMsg({ ok: false, text: String(r.data.error ?? 'Could not delete') });
    }
  };

  const tabs = canManage
    ? [
        { id: 'mine', label: 'My requests', icon: 'user' as const },
        { id: 'approvals', label: `Approvals${queueCount > 0 ? ` (${queueCount})` : ''}`, icon: 'clipboard-check' as const },
      ]
    : [{ id: 'mine', label: 'My requests', icon: 'user' as const }];

  const rows = tab === 'approvals' ? queue : leaves;
  const busy = tab === 'approvals' ? queueLoading : loading;

  return (
    <div>
      <PageHeader
        title="Leave"
        subtitle={isParent
          ? 'Apply for leave on behalf of your children and track the request status.'
          : 'Apply for leave and track the request status.'}
        actions={(
          <Button onClick={() => { setMsg(null); setForm(emptyForm); setDialogOpen(true); }}>
            <Icon name="plus" size={16} /> Apply for leave
          </Button>
        )}
      />

      {canManage && (
        <Tabs tabs={tabs} value={tab} onChange={setTab} ariaLabel="Leave sections" className="mb-5" />
      )}

      {msg && (
        <div role={msg.ok ? 'status' : 'alert'} className={`mb-4 rounded-xl border px-4 py-3 text-sm ${msg.ok ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'}`}>
          {msg.text}
        </div>
      )}

      {tab === 'approvals' && (
        <div className="mb-5 max-w-xs">
          <Select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | LeaveStatus)}
            options={[
              { value: 'PENDING', label: 'Pending' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'REJECTED', label: 'Rejected' },
              { value: 'ALL', label: 'All' },
            ]}
          />
        </div>
      )}

      {busy ? (
        <Card><CardContent><p className="py-6 text-center text-sm text-slate-500">Loading…</p></CardContent></Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="calendar-days"
          title={tab === 'approvals'
            ? (statusFilter === 'PENDING' ? 'No pending leave requests' : 'No requests found')
            : 'No leave requests yet'}
          guidance={tab === 'approvals'
            ? 'There is nothing to decide right now.'
            : 'Apply for leave and it will appear here with its approval status.'}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TRow>
                  <TH>Who</TH>
                  <TH>Dates</TH>
                  <TH>Reason</TH>
                  <TH>Status</TH>
                  <TH>Decided</TH>
                  <TH><span className="sr-only">Actions</span></TH>
                </TRow>
              </THead>
              <TBody>
                {rows.map((l) => (
                  <TRow key={l.id}>
                    <TD>
                      <div className="font-medium text-slate-900 dark:text-white">{l.who}</div>
                      {l.whoKind && <div className="text-xs text-slate-500 dark:text-slate-400">{l.whoKind}</div>}
                    </TD>
                    <TD className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name="calendar-days" size={14} /> {dateRange(l)}
                      </span>
                    </TD>
                    <TD>
                      <span className="block max-w-xs truncate" title={l.reason}>{l.reason}</span>
                      <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                        Filed {pktDate(l.createdAt)}
                      </span>
                    </TD>
                    <TD><StatusBadge status={l.status} /></TD>
                    <TD className="text-xs text-slate-500 dark:text-slate-400">
                      {l.decidedBy ? `${l.decidedBy}${l.decidedAt ? ` · ${pktDate(l.decidedAt)}` : ''}` : '—'}
                    </TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        {tab === 'approvals' && l.status === 'PENDING' ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => decide(l, 'approve')}
                              disabled={deciding === l.id}
                              aria-label={`Approve leave for ${l.who}`}
                            >
                              <Icon name="check" size={16} /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => decide(l, 'reject')}
                              disabled={deciding === l.id}
                              aria-label={`Reject leave for ${l.who}`}
                            >
                              <Icon name="x" size={16} /> Reject
                            </Button>
                          </>
                        ) : tab === 'approvals' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteAny(l)}
                            aria-label={`Delete request for ${l.who}`}
                          >
                            <Icon name="x" size={16} /> Delete
                          </Button>
                        ) : (
                          l.status === 'PENDING' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => cancelMine(l)}
                              aria-label={`Cancel request for ${dateRange(l)}`}
                            >
                              <Icon name="x" size={16} /> Cancel
                            </Button>
                          )
                        )}
                      </div>
                    </TD>
                  </TRow>
                ))}
              </TBody>
            </Table>
          </div>
        </Card>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Apply for leave"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={apply} disabled={!canApply()}>
              <Icon name="check" size={16} /> {saving ? 'Submitting…' : 'Submit request'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {isParent ? (
            <Select
              label="Child"
              value={form.studentId}
              onChange={set('studentId')}
              options={children.map((c) => ({ value: c.id, label: c.name }))}
              placeholder={children.length === 0 ? 'No children linked to your account' : 'Select child'}
              disabled={children.length === 0}
              required
            />
          ) : (
            <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <Icon name="user" size={16} /> Applying for: <strong>Self</strong>
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="From"
              type="date"
              value={form.fromDate}
              onChange={set('fromDate')}
              min={todayPKT()}
              required
            />
            <Input
              label="To"
              type="date"
              value={form.toDate}
              onChange={set('toDate')}
              min={form.fromDate || todayPKT()}
              required
            />
          </div>
          {form.fromDate && form.toDate && form.fromDate > form.toDate && (
            <p className="text-sm text-rose-600 dark:text-rose-400">The end date must be on or after the start date.</p>
          )}
          <Textarea
            label="Reason"
            rows={3}
            value={form.reason}
            onChange={set('reason')}
            placeholder="Why is leave needed?"
            maxLength={2000}
            required
          />
          {isParent && children.length === 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              No children are linked to your account yet — ask the school office to link them.
            </p>
          )}
        </div>
      </Dialog>
    </div>
  );
}
