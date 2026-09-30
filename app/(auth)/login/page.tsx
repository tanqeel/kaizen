'use client';

import { Suspense, useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/icons';
import { Button, Input } from '@/components/ui';
import { safeJson } from '@/lib/api-client';
import { AuthShell } from '../_components/auth-shell';

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
            <a
              href="/forgot-password"
              className="inline-flex min-h-[44px] items-center rounded px-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
            >
              Forgot password?
            </a>
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
    <AuthShell
      heading="Welcome back"
      subheading="Sign in to your school account, or request a new one."
    >
      <Suspense fallback={<p className="text-sm text-slate-500">Loading sign-in…</p>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
