'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Role, User } from '@prisma/client';
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
  schoolName,
  sessionLabel,
}: {
  user: Pick<User, 'name' | 'role'>;
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
