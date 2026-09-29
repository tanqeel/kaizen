'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, Button, Input, Select, Textarea } from '@/components/ui';
import { Icon } from '@/components/icons';
import { safeJson } from '@/lib/api-client';

interface RegisterFormProps {
  schoolName: string;
  grades: Array<{ id: string; name: string }>;
}

const ACCOUNT_TYPES = [
  { value: 'PARENT', label: 'Parent / Guardian', hint: 'View your children\u2019s attendance, results and fees' },
  { value: 'STUDENT', label: 'Student', hint: 'View your own attendance, timetable and results' },
  { value: 'TEACHER', label: 'Teacher', hint: 'Period registers, exams and class diary' },
  { value: 'STAFF', label: 'Staff', hint: 'Office, accounts, security or support staff' },
] as const;

export function RegisterForm({ schoolName, grades }: RegisterFormProps) {
  const [fullName, setFullName] = useState('');
  const [accountType, setAccountType] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [admissionNo, setAdmissionNo] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [notes, setNotes] = useState('');
  // Honeypot — bots fill it, humans don't.
  const [website, setWebsite] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const isStudent = accountType === 'STUDENT';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!fullName.trim() || !accountType || !phone.trim()) {
      setError('Please fill in your full name, account type and phone number.');
      return;
    }
    if (!/^[0-9+\-\s]{10,15}$/.test(phone.trim())) {
      setError('Phone number looks invalid.');
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Email address looks invalid.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          accountType,
          phone: phone.trim(),
          email: email.trim() || undefined,
          admissionNo: admissionNo.trim() || undefined,
          gradeId: gradeId || undefined,
          guardianName: guardianName.trim() || undefined,
          guardianPhone: guardianPhone.trim() || undefined,
          notes: notes.trim() || undefined,
          website,
        }),
      });
      const data = await safeJson(res).catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Submission failed. Please try again.');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            <Icon name="check" size={28} />
          </span>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Request received</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Thank you{schoolName ? ` for registering with ${schoolName}` : ''}. Your account
            request is now <strong>pending approval</strong> by the school administration.
            You will be able to sign in once it is approved.
          </p>
          <Link href="/login" className="mt-2">
            <Button variant="secondary">Back to sign in</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardContent className="px-6 py-6">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {error && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </p>
          )}

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              I am registering as
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Account type">
              {ACCOUNT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={accountType === t.value}
                  onClick={() => setAccountType(t.value)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    accountType === t.value
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{t.label}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{t.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="reg-name" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Full name *
              </label>
              <Input id="reg-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Ahmed Raza" autoComplete="name" />
            </div>
            <div>
              <label htmlFor="reg-phone" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Phone number *
              </label>
              <Input id="reg-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xx xxxxxxx" autoComplete="tel" inputMode="tel" />
            </div>
          </div>

          <div>
            <label htmlFor="reg-email" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Email (optional)
            </label>
            <Input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </div>

          {isStudent && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="reg-adm" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Admission / roll number (if known)
                </label>
                <Input id="reg-adm" value={admissionNo} onChange={(e) => setAdmissionNo(e.target.value)} placeholder="e.g. 0921" />
              </div>
              <div>
                <label htmlFor="reg-grade" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Class
                </label>
                <Select
                  id="reg-grade"
                  value={gradeId}
                  onChange={(e) => setGradeId(e.target.value)}
                  options={grades.map((g) => ({ value: g.id, label: g.name }))}
                  placeholder="Select class…"
                />
              </div>
              <div>
                <label htmlFor="reg-gname" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Parent / guardian name
                </label>
                <Input id="reg-gname" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="e.g. Muhammad Ali" />
              </div>
              <div>
                <label htmlFor="reg-gphone" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Parent / guardian phone
                </label>
                <Input id="reg-gphone" value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} placeholder="03xx xxxxxxx" inputMode="tel" />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="reg-notes" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Notes (optional)
            </label>
            <Textarea id="reg-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Anything the school office should know…" />
          </div>

          {/* Honeypot */}
          <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />

          <Button type="submit" loading={submitting} className="w-full">
            Submit registration request
          </Button>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
