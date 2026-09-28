'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from './icons';

const REFRESH_MS = 60_000;

/** Header bell: unread IN_APP count badge linking to /notifications. Fails silently. */
export function NotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const res = await fetch('/api/notifications?count=1', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && typeof data.unreadCount === 'number') {
          setCount(data.unreadCount);
        }
      } catch {
        /* bell stays quiet on failure */
      }
    };
    fetchCount();
    const id = setInterval(fetchCount, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
      className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
    >
      <Icon name="bell" size={20} />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] leading-none font-bold text-white"
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}
