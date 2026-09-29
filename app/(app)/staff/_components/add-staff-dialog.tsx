'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dialog, Input, Select } from '@/components/ui';
import { Icon } from '@/components/icons';

export function AddStaffDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState<'TEACHER' | 'STAFF'>('TEACHER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [cnic, setCnic] = useState('');
  const [designation, setDesignation] = useState('');
  const [salaryMonthly, setSalaryMonthly] = useState('');
  const [hireDate, setHireDate] = useState('');

  const save = async () => {
    setError(null);
    if (!name.trim()) { setError('Name is required.'); return; }
    if (!email.trim()) { setError('Email is required.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!phone.trim()) { setError('Phone is required.'); return; }
    if (kind === 'STAFF' && !designation.trim()) { setError('Designation is required for staff.'); return; }
    const salary = Number(salaryMonthly);
    if (!Number.isFinite(salary) || salary < 0) { setError('Enter a valid monthly salary.'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          name: name.trim(),
          email: email.trim(),
          password,
          phone: phone.trim(),
          cnic: cnic.trim() || undefined,
          designation: designation.trim() || undefined,
          salaryMonthly: salary,
          hireDate: hireDate || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to add.');
      setOpen(false);
      setName(''); setEmail(''); setPassword(''); setPhone(''); setCnic('');
      setDesignation(''); setSalaryMonthly(''); setHireDate('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        <Icon name="plus" size={16} /> Add Teacher / Staff
      </Button>
      <Dialog
        open={open}
        onClose={() => { setOpen(false); setError(null); }}
        title="Add Teacher / Staff Member"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Create Account'}</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Role *"
            value={kind}
            onChange={(e) => setKind(e.target.value as 'TEACHER' | 'STAFF')}
            options={[
              { value: 'TEACHER', label: 'Teacher' },
              { value: 'STAFF', label: 'Staff (office/support)' },
            ]}
          />
          {kind === 'STAFF' ? (
            <Input label="Designation *" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Accountant" />
          ) : (
            <div />
          )}
          <Input label="Full name *" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ayesha Khan" />
          <Input label="Login email *" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@school.pk" inputMode="email" />
          <Input label="Password (min 8 chars) *" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Input label="Phone *" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0300-1234567" inputMode="tel" />
          <Input label="CNIC" value={cnic} onChange={(e) => setCnic(e.target.value)} placeholder="12345-6789012-3" />
          <Input label="Monthly salary (PKR) *" value={salaryMonthly} onChange={(e) => setSalaryMonthly(e.target.value)} placeholder="45000" inputMode="numeric" />
          <Input label="Hire date" type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Creates a login account with the {kind === 'TEACHER' ? 'Teacher' : 'Staff'} role plus the employee record.
          The new member can sign in immediately with the email and password above.
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
