'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from './icons';

const STORAGE_KEY = 'kaizen-theme';

export function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/** Sun/moon toggle — flips .dark on <html>, persists to localStorage. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme(getInitialTheme());
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.toggle('dark', next === 'dark');
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* storage unavailable — theme still applies for this session */
      }
      return next;
    });
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={theme === 'dark'}
      className="flex h-[44px] w-[44px] cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
    >
      {/* Render both; hide one after mount to avoid hydration mismatch */}
      <span className={mounted ? 'hidden' : ''} aria-hidden="true">
        <Icon name="sun" size={20} />
      </span>
      {mounted && <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} />}
    </button>
  );
}
