'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Dialog, Input,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { pkr } from '@/lib/format';

interface Policy {
  fineGraceDays: number;
  finePerDay: number;
  configured: boolean;
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

/** Late-fine policy card for the fees page. Read-only unless canManage. */
export default function FeePolicyCard({ canManage }: { canManage: boolean }) {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [graceDays, setGraceDays] = useState('10');
  const [perDay, setPerDay] = useState('0');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api('/api/fee-policy', 'GET');
    setLoading(false);
    if (r.ok) {
      setPolicy({
        fineGraceDays: Number(r.data.fineGraceDays),
        finePerDay: Number(r.data.finePerDay),
        configured: Boolean(r.data.configured),
      });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openEdit = () => {
    setMsg(null);
    setGraceDays(String(policy?.fineGraceDays ?? 10));
    setPerDay(String(policy?.finePerDay ?? 0));
    setDialogOpen(true);
  };

  const gd = graceDays.trim() === '' ? NaN : Number(graceDays);
  const pd = perDay.trim() === '' ? NaN : Number(perDay);
  const gdValid = Number.isInteger(gd) && gd >= 0;
  const pdValid = Number.isInteger(pd) && pd >= 0;
  const canSave = gdValid && pdValid && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setMsg(null);
    const r = await api('/api/fee-policy', 'PUT', { fineGraceDays: gd, finePerDay: pd });
    setSaving(false);
    if (r.ok) {
      setDialogOpen(false);
      void load();
    } else {
      setMsg(String(r.data.error ?? 'Could not save policy'));
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Late-fine policy</CardTitle>
          {canManage && (
            <Button size="sm" variant="secondary" onClick={openEdit}>
              <Icon name="settings" size={16} /> Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-2 text-sm text-slate-500">Loading policy…</p>
        ) : !policy ? (
          <p className="text-sm text-slate-500">Could not load the fine policy.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">Grace days</p>
              <p className="tnum mt-1 text-2xl font-bold text-slate-900 dark:text-white">{policy.fineGraceDays}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">after the due date before fines start</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">Fine per day</p>
              <p className="tnum mt-1 text-2xl font-bold text-slate-900 dark:text-white">{pkr(policy.finePerDay)}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">per overdue day past the grace period</p>
            </div>
          </div>
        )}
        {!policy?.configured && !loading && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            No policy saved yet — vouchers are generated with the defaults (10 grace days, no fine).
          </p>
        )}
        {policy && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            The fine applies when new vouchers are generated for already-overdue billing months — existing vouchers keep their stored fine.
          </p>
        )}
      </CardContent>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Edit late-fine policy"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!canSave}>
              <Icon name="check" size={16} /> {saving ? 'Saving…' : 'Save policy'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Grace days"
            type="number"
            min={0}
            step={1}
            value={graceDays}
            onChange={(e) => setGraceDays(e.target.value)}
            error={!gdValid ? 'Whole number ≥ 0' : undefined}
            required
          />
          <Input
            label="Fine per day (Rs)"
            type="number"
            min={0}
            step={1}
            value={perDay}
            onChange={(e) => setPerDay(e.target.value)}
            error={!pdValid ? 'Whole number ≥ 0' : undefined}
            required
          />
        </div>
        {msg && <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-400">{msg}</p>}
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Set the fine per day to 0 to disable late fines entirely.
        </p>
      </Dialog>
    </Card>
  );
}
