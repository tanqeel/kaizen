'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dialog } from '@/components/ui';
import { Icon } from '@/components/icons';
import { safeJson } from '@/lib/api-client';

/** Discharge (leave school) or reactivate a student. Records are kept; the student leaves the active directory. */
export function DischargeButton({ studentId, studentName, isActive }: { studentId: string; studentName: string; isActive: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error ?? 'Failed.');
      setOpen(false);
      if (!isActive) {
        router.refresh();
      } else {
        router.push('/students');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Icon name="user" size={16} />
        {isActive ? 'Discharge' : 'Re-admit'}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={isActive ? 'Discharge student' : 'Re-admit student'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant={isActive ? 'danger' : 'primary'} onClick={run} disabled={saving}>
              {saving ? 'Saving…' : isActive ? 'Discharge' : 'Re-admit'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {isActive ? (
            <>
              Discharge <strong>{studentName}</strong> from the school? They will be removed from the
              active student directory, attendance registers and fee generation — but all historical
              records (attendance, results, payments) are kept.
            </>
          ) : (
            <>
              Re-admit <strong>{studentName}</strong>? They will return to the active student directory.
            </>
          )}
        </p>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        )}
      </Dialog>
    </>
  );
}
