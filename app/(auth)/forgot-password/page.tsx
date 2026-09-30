'use client';

import { Suspense, useState } from 'react';
import { Icon } from '@/components/icons';
import { Button, Input } from '@/components/ui';
import { safeJson } from '@/lib/api-client';
import { AuthShell } from '../_components/auth-shell';

function ForgotForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await safeJson(res).catch(() => null)) as { error?: string } | null;
      if (res.ok) {
        setDone(true);
      } else {
        setError(data?.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
        <p className="flex items-start gap-2.5 text-sm text-emerald-900 dark:text-emerald-200">
          <Icon name="check" size={18} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold">Request received.</span>
            <br />
            If an account exists for <span className="font-semibold">{email}</span>, the school office
            has been notified. Ask your administrator for your one-time reset link — it lets you
            set a brand-new password that only you will know.
          </span>
        </p>
        <a
          href="/login"
          className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
        >
          <Icon name="arrow-left" size={16} /> Back to sign in
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="lg:hidden">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Forgot your password?</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Enter your account email and the school office will issue you a one-time reset link.
        </p>
      </div>
      <Input
        label="Account email address"
        type="email"
        autoComplete="email"
        placeholder="you@school.pk"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={busy}
      />
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          <Icon name="alert-triangle" size={18} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
      <Button type="submit" loading={busy} className="w-full">
        Send reset request
      </Button>
      <p className="text-center text-sm text-slate-600 dark:text-slate-300">
        <a href="/login" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
          Back to sign in
        </a>
      </p>
    </form>
  );
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      heading="Forgot your password?"
      subheading="Enter your account email and the school office will issue you a one-time reset link."
    >
      <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
        <ForgotForm />
      </Suspense>
    </AuthShell>
  );
}
