'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { safeJson } from '@/lib/api-client';

/**
 * /activate/[token] — one-time account activation.
 * The user creates their own private password. No admin ever sees it.
 */
export default function ActivatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'ready' | 'invalid' | 'done' | 'error'>('checking');
  const [name, setName] = useState('');
  const [kaizenId, setKaizenId] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/auth/activate?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) {
          setName(d.name);
          setKaizenId(d.kaizenId);
          setState('ready');
        } else {
          setState('invalid');
        }
      })
      .catch(() => setState('error'));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const d = await safeJson(res);
      if (d.ok) {
        setState('done');
      } else {
        setError(d.error || 'Activation failed. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="animate-scale-in w-full max-w-md bg-white rounded-2xl shadow-[var(--shadow-pop)] p-8 dark:bg-slate-900 dark:border dark:border-slate-800">
        <h1 className="text-2xl font-bold text-slate-900">Activate your KAIZEN account</h1>

        {state === 'checking' && (
          <p className="mt-4 text-slate-500">Checking your activation link…</p>
        )}

        {state === 'invalid' && (
          <div className="mt-4">
            <p className="text-red-600 font-medium">This activation link is invalid, expired, or already used.</p>
            <p className="mt-2 text-sm text-slate-500">
              Please contact your school office to request a new activation link.
            </p>
          </div>
        )}

        {state === 'error' && (
          <p className="mt-4 text-red-600">Something went wrong. Please try again later.</p>
        )}

        {state === 'ready' && (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="bg-slate-50 rounded-lg p-4 text-sm">
              <p className="text-slate-500">Welcome,</p>
              <p className="font-semibold text-slate-900">{name}</p>
              {kaizenId && <p className="text-slate-500 font-mono text-xs mt-1">{kaizenId}</p>}
            </div>
            <p className="text-sm text-slate-600">
              Create your private password. Nobody at the school will see it — keep it safe.
            </p>
            <div>
              <label htmlFor="pw" className="block text-sm font-medium text-slate-700">New password</label>
              <input
                id="pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="pw2" className="block text-sm font-medium text-slate-700">Confirm password</label>
              <input
                id="pw2"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? 'Activating…' : 'Activate my account'}
            </button>
          </form>
        )}

        {state === 'done' && (
          <div className="mt-4">
            <p className="text-green-700 font-medium">Your account is activated.</p>
            <button
              onClick={() => router.push('/login')}
              className="mt-4 w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700"
            >
              Go to sign in
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
