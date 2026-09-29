'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dialog } from '@/components/ui';
import { Icon } from '@/components/icons';

/** Deactivate (or reactivate) a teacher/staff record + linked login. */
export function DeactivateStaffButton({
  id,
  kind,
  name,
  isActive,
}: {
  id: string;
  kind: 'TEACHER' | 'STAFF';
  name: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/${id}?kind=${kind}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed.');
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label={`${isActive ? 'Deactivate' : 'Reactivate'} ${name}`}>
        <Icon name="x" size={16} />
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={isActive ? 'Deactivate' : 'Reactivate'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant={isActive ? 'danger' : 'primary'} onClick={run} disabled={saving}>
              {saving ? 'Saving…' : isActive ? 'Deactivate' : 'Reactivate'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {isActive ? (
            <>Deactivate <strong>{name}</strong>? Their login will stop working and they leave the active roster. Records are kept.</>
          ) : (
            <>Reactivate <strong>{name}</strong>? Their login will work again.</>
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
