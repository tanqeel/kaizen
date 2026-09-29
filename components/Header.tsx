'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Role, User } from '@prisma/client';
import { DEMO_LOGINS } from '@/lib/format';
import { Icon } from './icons';
import { Badge } from './ui';
import { ThemeToggle } from './ThemeToggle';
import { NotificationBell } from './NotificationBell';

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  PRINCIPAL: 'Principal',
  ADMIN: 'Admin',
  TEACHER: 'Teacher',
  STAFF: 'Staff',
  PARENT: 'Parent',
  STUDENT: 'Student',
};

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  SUPER_ADMIN: 'Full access — manage everything',
  PRINCIPAL: 'School oversight, attendance & finance',
  ADMIN: 'Operational management — users, admissions & records',
  TEACHER: 'Period registers, exams, timetable',
  STAFF: 'Gate check-ins, fees, notices',
  PARENT: 'Child status, fees, results',
  STUDENT: 'Own attendance & results',
};

async function postJson(url: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Persona switcher — only rendered for demo sessions. Re-issues the session as the chosen role. */
function PersonaSwitcher({ currentRole }: { currentRole: Role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const switchTo = async (role: string) => {
    if (role === currentRole) {
      setOpen(false);
      return;
    }
    setSwitching(role);
    setError(null);
    const ok = await postJson('/api/auth/demo', { role });
    setSwitching(null);
    if (ok) {
      setOpen(false);
      router.push('/');
      router.refresh();
    } else {
      setError('Could not switch persona. Please try again.');
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch demo persona"
        className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-100 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20"
      >
        <Icon name="users" size={18} />
        <span className="hidden sm:inline">Demo: {ROLE_LABELS[currentRole]}</span>
        <Icon name="chevron-down" size={16} className={open ? 'rotate-180' : ''} />
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-pop)] dark:border-slate-700 dark:bg-slate-900">
          <p className="border-b border-slate-200 px-4 py-2.5 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:border-slate-800 dark:text-slate-400">
            Switch persona
          </p>
          <ul role="listbox" aria-label="Demo personas" className="nice-scroll max-h-80 overflow-y-auto py-1">
            {DEMO_LOGINS.map((d) => {
              const role = d.role as Role;
              const active = role === currentRole;
              return (
                <li key={d.role}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={switching !== null}
                    onClick={() => switchTo(d.role)}
                    className={
                      'flex w-full cursor-pointer items-start gap-3 px-4 py-2.5 text-left transition-colors disabled:cursor-wait ' +
                      (active
                        ? 'bg-brand-50 dark:bg-brand-500/10'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800')
                    }
                  >
                    <span
                      className={
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ' +
                        (active
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400')
                      }
                    >
                      {switching === d.role ? (
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                          <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                      ) : (
                        <Icon name="user" size={16} />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {d.label}
                        {active && (
                          <Badge variant="info" className="px-1.5">
                            current
                          </Badge>
                        )}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {ROLE_DESCRIPTIONS[role]}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {error && (
            <p role="alert" className="border-t border-slate-200 px-4 py-2.5 text-xs text-rose-600 dark:border-slate-800 dark:text-rose-400">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const logout = async () => {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* logout is best-effort; still leave the page */
    }
    router.push('/login');
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      aria-label="Log out"
      title="Log out"
      className="flex h-[44px] min-w-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg px-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-wait dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 sm:px-3"
    >
      <Icon name="log-out" size={20} />
      <span className="hidden text-sm font-medium md:inline">{busy ? 'Logging out…' : 'Log out'}</span>
    </button>
  );
}

export function Header({
  user,
  isDemo,
  schoolName,
  sessionLabel,
}: {
  user: Pick<User, 'name' | 'role'>;
  isDemo: boolean;
  schoolName: string;
  sessionLabel: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 pl-16 sm:px-6 lg:pl-6">
        {/* pl-16 on mobile leaves room for the fixed hamburger */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{schoolName}</p>
          <p className="hidden truncate text-xs text-slate-500 sm:block dark:text-slate-400">{sessionLabel}</p>
        </div>

        {isDemo && (
          <Badge variant="pending" className="hidden sm:inline-flex" title="This is a demo session">
            Demo
          </Badge>
        )}
        {isDemo && <PersonaSwitcher currentRole={user.role} />}

        <div
          className="flex min-h-[44px] items-center gap-2 rounded-lg px-2"
          title={`${user.name} — ${ROLE_LABELS[user.role]}`}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            {user.name.trim().charAt(0).toUpperCase()}
          </span>
          <span className="hidden min-w-0 lg:block">
            <span className="block max-w-40 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              {user.name}
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">{ROLE_LABELS[user.role]}</span>
          </span>
        </div>

        <NotificationBell />
        <ThemeToggle />
        <LogoutButton />
      </div>
    </header>
  );
}
