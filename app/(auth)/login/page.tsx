'use client';

import { Suspense, useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Role } from '@prisma/client';
import { DEMO_LOGINS, DEMO_PASSWORD_HINT } from '@/lib/format';
import { Icon } from '@/components/icons';
import { Button, Input } from '@/components/ui';

const ROLE_DESCRIPTIONS: Record<string, string> = {
  SUPER_ADMIN: 'Full access — manage everything',
  PRINCIPAL: 'School oversight, attendance & finance',
  TEACHER: 'Period registers, exams, timetable',
  STAFF: 'Gate check-ins, fees, notices',
  PARENT: 'Child status, fees, results',
  STUDENT: 'Own attendance & results',
};

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
        goNext();
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? 'Sign-in failed. Please try again.');
      }
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  };

  const handleDemo = async (role: Role) => {
    setError(null);
    setBusy(role);
    try {
      const res = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        goNext();
      } else {
        setError('Demo login failed for this role. Please try again.');
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

      <div className="my-6 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        <span className="text-xs font-semibold tracking-wide text-slate-400 uppercase dark:text-slate-500">
          One-click demo login
        </span>
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Demo personas">
        {DEMO_LOGINS.map((d) => (
          <button
            key={d.role}
            type="button"
            onClick={() => handleDemo(d.role as Role)}
            disabled={busy !== null}
            className="flex min-h-[56px] cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/50 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
              {busy === d.role ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                  <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : (
                <Icon name="user" size={18} />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{d.label}</span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                {ROLE_DESCRIPTIONS[d.role]}
              </span>
            </span>
          </button>
        ))}
      </div>

      <p className="mt-5 rounded-lg bg-slate-100 px-3.5 py-2.5 text-center text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        Demo password for all personas: <code className="tnum font-mono font-bold">{DEMO_PASSWORD_HINT}</code>
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
            Sign in to your school account, or explore with a one-click demo login.
          </p>
          <Suspense fallback={<p className="text-sm text-slate-500">Loading sign-in…</p>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
