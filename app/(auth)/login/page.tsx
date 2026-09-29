'use client';

import { Suspense, useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/icons';
import { Button, Input } from '@/components/ui';
import { safeJson } from '@/lib/api-client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'login' | string | null>(null);

  const onKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === 'function') {
      setCapsLock(e.getModifierState('CapsLock'));
    }
  }, []);

  const goNext = useCallback(() => {
    router.push(next.startsWith('/') ? next : '/');
    router.refresh();
  }, [next, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy('login');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const data = (await safeJson(res).catch(() => null)) as { forcePasswordReset?: boolean } | null;
        if (data?.forcePasswordReset) {
          router.push('/security');
        } else {
          goNext();
        }
        router.refresh();
      } else {
        const data = (await safeJson(res).catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? 'Sign-in failed. Please try again.');
      }
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleLogin} className="flex flex-col gap-4" noValidate={false}>
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@school.pk"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={busy !== null}
        />
        <div>
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onKey}
            onKeyUp={onKey}
            required
            disabled={busy !== null}
          />
          <div className="mt-1.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-pressed={showPassword}
              disabled={busy !== null}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded px-1 text-xs font-medium text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200"
            >
              <Icon name={showPassword ? 'eye-off' : 'eye'} size={16} />
              {showPassword ? 'Hide password' : 'Show password'}
            </button>
            {capsLock && (
              <span role="status" className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                <Icon name="alert-triangle" size={14} />
                Caps Lock is on
              </span>
            )}
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            <Icon name="alert-triangle" size={18} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        <Button type="submit" loading={busy === 'login'} className="w-full">
          Sign in
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-600 dark:text-slate-300">
        New here?{' '}
        <a href="/register" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
          Create an account request
        </a>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh bg-white dark:bg-slate-950">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 p-10 text-white lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(255,255,255,.25) 0, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,.18) 0, transparent 45%)',
          }}
        />
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
            <Icon name="school" size={24} />
          </span>
          <span>
            <span className="block text-lg font-bold">Kaizen</span>
            <span className="block text-xs text-white/70">School Management System</span>
          </span>
        </div>
        <div className="relative">
          <h1 className="text-3xl leading-tight font-bold">
            One system for the whole school day.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80">
            Gate check-ins, period registers, exams, fees, and parent communication —
            with attendance conflicts flagged before they become problems.
          </p>
          <ul className="mt-6 flex flex-col gap-3 text-sm">
            {[
              'Dual-tier attendance: biometric gate + per-period register',
              'Parent portal with live at-school status',
              'Fee vouchers, payments & expense tracking in PKR',
            ].map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-white/85">
                <Icon name="check" size={18} className="mt-0.5 shrink-0 text-emerald-300" />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/60">Kaizen Model School · Asia/Karachi</p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Icon name="school" size={26} />
            </span>
            <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">Kaizen</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">School Management System</p>
          </div>
          <h2 className="hidden text-2xl font-bold text-slate-900 lg:block dark:text-white">
            Welcome back
          </h2>
          <p className="mt-1 mb-6 hidden text-sm text-slate-500 lg:block dark:text-slate-400">
            Sign in to your school account, or request a new one.
          </p>
          <Suspense fallback={<p className="text-sm text-slate-500">Loading sign-in…</p>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
