import type { ReactNode } from 'react';
import { Icon } from '@/components/icons';
import { Reveal } from '@/components/reveal';

/**
 * Shared two-panel auth layout (brand panel + form panel).
 * Used by login, forgot-password, and future public auth pages so they
 * always look identical.
 */
export function AuthShell({
  heading,
  subheading,
  children,
}: {
  heading: string;
  subheading: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh bg-white dark:bg-slate-950">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 p-10 text-white lg:flex">
        {/* Ambient 3D depth: slow-drifting light orbs behind the content */}
        <div
          aria-hidden="true"
          className="animate-float-slow pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="animate-float-slower pointer-events-none absolute -right-32 -bottom-32 h-[28rem] w-[28rem] rounded-full bg-indigo-300/20 blur-3xl"
        />
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
        <Reveal className="relative">
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
            ].map((point, i) => (
              <Reveal as="li" key={point} delay={120 + i * 110} className="flex items-start gap-2.5 text-white/85">
                <Icon name="check" size={18} className="mt-0.5 shrink-0 text-emerald-300" />
                {point}
              </Reveal>
            ))}
          </ul>
        </Reveal>
        <p className="relative text-xs text-white/60">Kaizen Model School · Asia/Karachi</p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="animate-fade-up w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Icon name="school" size={26} />
            </span>
            <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">Kaizen</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">School Management System</p>
          </div>
          <h2 className="hidden text-2xl font-bold text-slate-900 lg:block dark:text-white">
            {heading}
          </h2>
          <p className="mt-1 mb-6 hidden text-sm text-slate-500 lg:block dark:text-slate-400">
            {subheading}
          </p>
          {children}
        </div>
      </div>
    </main>
  );
}
