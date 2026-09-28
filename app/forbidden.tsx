import Link from 'next/link';
import { Icon } from '@/components/icons';

/**
 * Rendered by Next.js when requirePagePermission() calls forbidden().
 * Root-level forbidden.tsx covers the whole app.
 */
export default function Forbidden() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-16 dark:bg-slate-950">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
          <Icon name="alert-triangle" size={32} />
        </span>
        <p className="tnum mt-6 text-sm font-semibold tracking-widest text-slate-400 uppercase">403</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Access denied</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Your account doesn&apos;t have permission to open this page. If you believe you should have
          access, ask your school administrator to update your role.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Icon name="arrow-left" size={18} />
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
