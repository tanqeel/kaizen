'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem } from '@/lib/rbac';
import { Icon, type IconName } from './icons';

const NAV_ICONS: Record<string, IconName> = {
  '/': 'dashboard',
  '/portal': 'users',
  '/students': 'users',
  '/attendance': 'clipboard-check',
  '/academics': 'book-open',
  '/exams': 'award',
  '/fees': 'wallet',
  '/expenses': 'receipt-text',
  '/comms': 'megaphone',
  '/biometric': 'fingerprint',
  '/ai': 'sparkles',
  '/staff': 'id-card',
  '/admin': 'settings',
};

function isActiveLink(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1 px-3">
      {items.map((item) => {
        const active = isActiveLink(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={
              'flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ' +
              (active
                ? 'bg-brand-600 text-white shadow-sm dark:bg-brand-500'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white')
            }
          >
            <Icon name={NAV_ICONS[item.href] ?? 'dashboard'} size={20} className="shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function BrandMark({ schoolName }: { schoolName: string }) {
  return (
    <Link href="/" className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2" aria-label={`${schoolName} — home`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white dark:bg-brand-500">
        <Icon name="school" size={22} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">Kaizen</span>
        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{schoolName}</span>
      </span>
    </Link>
  );
}

/**
 * Desktop: fixed sidebar (lg+). Mobile: hamburger opens a slide-in drawer.
 */
export function Sidebar({ items, schoolName }: { items: NavItem[]; schoolName: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open ]);

  return (
    <>
      {/* Mobile hamburger — part of the shell, fixed top-left under the header */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        className="fixed top-3 left-3 z-40 flex h-[44px] w-[44px] cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        <Icon name="menu" size={22} />
      </button>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex dark:border-slate-800 dark:bg-slate-900">
        <div className="px-2 py-4">
          <BrandMark schoolName={schoolName} />
        </div>
        <div className="nice-scroll flex-1 overflow-y-auto pb-6">
          <NavLinks items={items} />
        </div>
        <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <p className="text-xs text-slate-400 dark:text-slate-500">Kaizen SMS · v0.1 (Wave 1)</p>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div
            className="absolute inset-0 bg-slate-950/50"
            role="presentation"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-[var(--shadow-pop)] dark:bg-slate-900">
            <div className="flex items-center justify-between px-2 py-4">
              <BrandMark schoolName={schoolName} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="flex h-[44px] w-[44px] cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <Icon name="x" size={22} />
              </button>
            </div>
            <div className="nice-scroll flex-1 overflow-y-auto pb-6">
              <NavLinks items={items} onNavigate={() => setOpen(false)} />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
