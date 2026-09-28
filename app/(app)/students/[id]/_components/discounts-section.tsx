'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, ConfirmProvider,
  Dialog, EmptyState, Input, Select, Textarea, useConfirm,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { pkr, pktDate } from '@/lib/format';

type DiscountType = 'SIBLING' | 'STAFF_WARD' | 'MERIT' | 'NEED_BASED' | 'OTHER';

interface Discount {
  id: string;
  type: DiscountType;
  percent: number | null;
  amount: number | null;
  reason: string | null;
  createdAt: string;
  approvedBy: { name: string };
}

const TYPE_LABELS: Record<DiscountType, string> = {
  SIBLING: 'Sibling',
  STAFF_WARD: 'Staff ward',
  MERIT: 'Merit',
  NEED_BASED: 'Need-based',
  OTHER: 'Other',
};

const TYPE_OPTIONS = (Object.keys(TYPE_LABELS) as DiscountType[]).map((t) => ({
  value: t,
  label: TYPE_LABELS[t],
}));

const emptyForm = { type: 'SIBLING' as DiscountType, percent: '', amount: '', reason: '' };

async function api(path: string, method: string, body?: unknown) {
  const r = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data };
}

/**
 * Discounts applied to a student (student detail page).
 * Self-contained: wraps itself in ConfirmProvider so it can be dropped
 * anywhere without depending on the page's providers.
 */
export default function DiscountsSection({ studentId, canManage }: { studentId: string; canManage: boolean }) {
  return (
    <ConfirmProvider>
      <DiscountsInner studentId={studentId} canManage={canManage} />
    </ConfirmProvider>
  );
}

function DiscountsInner({ studentId, canManage }: { studentId: string; canManage: boolean }) {
  const confirm = useConfirm();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api(`/api/discounts?studentId=${encodeURIComponent(studentId)}`, 'GET');
    setLoading(false);
    if (r.ok) {
      setDiscounts((r.data.discounts ?? []) as Discount[]);
      setMsg(null);
    } else {
      setMsg(String(r.data.error ?? 'Could not load discounts'));
    }
  }, [studentId]);

  useEffect(() => { void load(); }, [load]);

  const remove = async (id: string) => {
    if (!(await confirm({
      title: 'Remove this discount?',
      message: 'The discount stops applying to future vouchers. Existing vouchers are not changed. This cannot be undone.',
      confirmLabel: 'Remove',
    }))) return;
    const r = await api(`/api/discounts/${id}`, 'DELETE');
    if (r.ok) void load();
    else setMsg(String(r.data.error ?? 'Could not remove discount'));
  };

  const set = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const percent = form.percent.trim() === '' ? null : Number(form.percent);
  const amount = form.amount.trim() === '' ? null : Number(form.amount);
  const hasPercent = percent !== null;
  const hasAmount = amount !== null;
  const percentValid = !hasPercent || (Number.isInteger(percent) && (percent as number) >= 1 && (percent as number) <= 100);
  const amountValid = !hasAmount || (Number.isInteger(amount) && (amount as number) > 0);
  const canSave =
    hasPercent !== hasAmount && percentValid && amountValid && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setMsg(null);
    const r = await api('/api/discounts', 'POST', {
      studentId,
      type: form.type,
      ...(hasPercent ? { percent } : { amount }),
      reason: form.reason.trim() || undefined,
    });
    setSaving(false);
    if (r.ok) {
      setDialogOpen(false);
      setForm(emptyForm);
      void load();
    } else {
      setMsg(String(r.data.error ?? 'Could not add discount'));
    }
  };

  const valueOf = (d: Discount) => (d.percent != null ? `${d.percent}%` : pkr(d.amount ?? 0));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Discounts</CardTitle>
          {canManage && (
            <Button size="sm" onClick={() => { setForm(emptyForm); setMsg(null); setDialogOpen(true); }}>
              <Icon name="plus" size={16} /> Add
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {msg && (
          <p role="alert" className="mb-3 text-sm text-rose-600 dark:text-rose-400">{msg}</p>
        )}
        {loading ? (
          <p className="py-4 text-center text-sm text-slate-500">Loading discounts…</p>
        ) : discounts.length === 0 ? (
          <EmptyState
            icon="receipt-text"
            title="No discounts"
            guidance="This student has no fee discounts. Discounts apply automatically when new vouchers are generated."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {discounts.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="info">{TYPE_LABELS[d.type]}</Badge>
                    <span className="tnum text-sm font-bold text-slate-900 dark:text-white">{valueOf(d)}</span>
                  </div>
                  {d.reason && (
                    <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{d.reason}</p>
                  )}
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    Approved by {d.approvedBy.name} · {pktDate(d.createdAt)}
                  </p>
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(d.id)}
                    aria-label={`Remove ${TYPE_LABELS[d.type]} discount`}
                    className="min-h-[44px] min-w-[44px]"
                  >
                    <Icon name="x" size={16} />
                  </Button>
                )}
              </div>
            ))}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Discounts apply to vouchers generated after the discount is added — existing vouchers keep their stored discount.
            </p>
          </div>
        )}
      </CardContent>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Add discount"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!canSave}>
              <Icon name="check" size={16} /> {saving ? 'Adding…' : 'Add discount'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Discount type"
            value={form.type}
            onChange={set('type')}
            options={TYPE_OPTIONS}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Percent (%)"
              type="number"
              min={1}
              max={100}
              step={1}
              value={form.percent}
              onChange={set('percent')}
              placeholder="e.g. 15"
              error={hasPercent && !percentValid ? 'Whole number 1–100' : undefined}
            />
            <Input
              label="Flat amount (Rs)"
              type="number"
              min={1}
              step={1}
              value={form.amount}
              onChange={set('amount')}
              placeholder="e.g. 2000"
              error={hasAmount && !amountValid ? 'Whole PKR value above 0' : undefined}
            />
          </div>
          <p className="-mt-2 text-xs text-slate-500 dark:text-slate-400">
            Fill exactly one: a percentage off the voucher total, or a flat PKR amount.
          </p>
          <Textarea
            label="Reason (optional)"
            rows={2}
            value={form.reason}
            onChange={set('reason')}
            placeholder="Why is this discount granted?"
            maxLength={500}
          />
        </div>
      </Dialog>
    </Card>
  );
}
