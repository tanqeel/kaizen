'use client';

import { Icon } from '@/components/icons';
import { Button } from '@/components/ui';

/**
 * Public offline fallback (allowlisted in proxy.ts). Served from the
 * service-worker cache when the network is unreachable.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-16 dark:bg-slate-950">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <Icon name="wifi-off" size={32} />
        </span>
        <h1 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white">You&apos;re offline</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Kaizen couldn&apos;t reach the school server. Check your connection and try again —
          nothing you typed is lost if you were on a saved page.
        </p>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-left dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            What still works offline
          </p>
          <ul className="mt-2 flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
            {[
              'Pages you already opened stay readable from cache',
              'Cached dashboards and notices remain viewable',
              'Attendance marks and payments will sync once you reconnect',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Icon name="check" size={16} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8">
          <Button onClick={() => window.location.reload()} className="w-full sm:w-auto">
            <Icon name="refresh-cw" size={18} />
            Retry connection
          </Button>
        </div>
      </div>
    </main>
  );
}
