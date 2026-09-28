'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dialog, FormGrid, Input, Select } from '@/components/ui';
import { Icon } from '@/components/icons';
import { pkr } from '@/lib/format';
import { PAYMENT_METHODS } from '@/lib/fees';

/** "Record payment" dialog for a voucher. Validates client-side; the API re-validates. */
export function RecordPayment({ voucherId, balance }: { voucherId: string; balance: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(balance);
  const [method, setMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/fees/vouchers/${voucherId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(Number(amount)),
          method,
          ...(reference.trim() ? { reference: reference.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Payment failed');
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button onClick={() => { setAmount(balance); setReference(''); setError(null); setOpen(true); }}>
        <Icon name="plus" size={18} /> Record payment
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Record payment"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} loading={busy} disabled={amount <= 0 || amount > balance}>
              <Icon name="check" size={18} /> Save payment
            </Button>
          </>
        }
      >
        <FormGrid>
          <Input
            label="Amount (PKR)"
            type="number"
            min={1}
            max={balance}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            hint={`Balance due: ${pkr(balance)}`}
            required
          />
          <Select
            label="Method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            options={PAYMENT_METHODS}
            required
          />
          <Input
            label="Reference"
            placeholder="Receipt / transaction no. (optional)"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="sm:col-span-2"
          />
          {error && (
            <p role="alert" className="text-sm text-rose-600 sm:col-span-2 dark:text-rose-400">{error}</p>
          )}
        </FormGrid>
      </Dialog>
    </>
  );
}
