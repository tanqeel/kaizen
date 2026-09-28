'use client';

import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './icons';

/* ---------------------------------- utils --------------------------------- */

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ---------------------------------- Button -------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'md' | 'sm' | 'icon';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors select-none ' +
  'disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 dark:bg-brand-500 dark:hover:bg-brand-400',
  secondary:
    'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 ' +
    'dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
  ghost:
    'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 ' +
    'dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
  danger:
    'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  md: 'min-h-[44px] min-w-[44px] px-4 py-2.5 text-sm',
  sm: 'min-h-[44px] min-w-[44px] px-3 py-2 text-sm',
  icon: 'h-[44px] w-[44px] p-0',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <svg
          className="h-4 w-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  );
}

/* ----------------------------------- Card --------------------------------- */

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        'rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-card)]',
        'dark:border-slate-800 dark:bg-slate-900',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('border-b border-slate-200 px-5 py-4 dark:border-slate-800', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cx('text-base font-semibold text-slate-900 dark:text-white', className)} {...rest}>
      {children}
    </h2>
  );
}

export function CardContent({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('px-5 py-4', className)} {...rest}>
      {children}
    </div>
  );
}

/* ------------------------------ Form controls ----------------------------- */

const INPUT_BASE =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'hover:border-slate-400 focus:border-brand-600 focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ' +
  'dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 ' +
  'dark:hover:border-slate-600 dark:focus:border-brand-400 dark:disabled:bg-slate-900 min-h-[44px]';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, id, className, required, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
          {label} {required && <span className="text-rose-600" aria-hidden="true">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-err` : hint ? `${fieldId}-hint` : undefined}
        className={cx(INPUT_BASE, error && 'border-rose-500 focus:border-rose-600 dark:focus:border-rose-500')}
        {...rest}
      />
      {error ? (
        <p id={`${fieldId}-err`} role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, options, placeholder, id, className, required, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
          {label} {required && <span className="text-rose-600" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={fieldId}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cx(INPUT_BASE, 'appearance-none pr-10', error && 'border-rose-500')}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon
          name="chevron-down"
          size={18}
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-slate-400"
        />
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, id, className, required, rows = 4, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
          {label} {required && <span className="text-rose-600" aria-hidden="true">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cx(INPUT_BASE, 'min-h-[88px] resize-y py-2.5', error && 'border-rose-500')}
        {...rest}
      />
      {error ? (
        <p role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
});

/* ----------------------------------- Table -------------------------------- */

export function Table({
  className,
  wrapperClassName,
  children,
  ...rest
}: React.TableHTMLAttributes<HTMLTableElement> & { wrapperClassName?: string }) {
  return (
    <div className={cx('nice-scroll overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800', wrapperClassName)}>
      <table className={cx('w-full border-collapse text-left text-sm', className)} {...rest}>
        {children}
      </table>
    </div>
  );
}

export function THead({ className, children, ...rest }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cx('thead-sticky', className)} {...rest}>
      {children}
    </thead>
  );
}

export function TRow({ className, children, ...rest }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cx(
        'border-b border-slate-200 bg-slate-50/80 backdrop-blur last:border-0 dark:border-slate-800 dark:bg-slate-900/80',
        className,
      )}
      {...rest}
    >
      {children}
    </tr>
  );
}

export function TH({ className, children, ...rest }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cx(
        'thead-sticky bg-slate-100 px-4 py-3 text-xs font-semibold tracking-wide text-slate-600 uppercase whitespace-nowrap',
        'dark:bg-slate-800 dark:text-slate-300',
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TBody({ className, children, ...rest }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={className} {...rest}>
      {children}
    </tbody>
  );
}

export function TD({ className, children, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cx('px-4 py-3 text-sm text-slate-700 dark:text-slate-200', className)} {...rest}>
      {children}
    </td>
  );
}

/* ----------------------------------- Badge -------------------------------- */

type BadgeVariant = 'present' | 'absent' | 'pending' | 'overdue' | 'info' | 'neutral' | 'paid' | 'unpaid';

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  present: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  absent: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  info: 'bg-brand-100 text-brand-800 dark:bg-brand-500/15 dark:text-brand-300',
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  unpaid: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
};

export function Badge({
  variant = 'neutral',
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cx(
        'inline-flex min-h-[24px] items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        BADGE_VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

/* ----------------------------------- Tabs --------------------------------- */

export interface TabItem {
  id: string;
  label: string;
  icon?: IconName;
}

interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  ariaLabel?: string;
}

export function Tabs({ tabs, value, onChange, className, ariaLabel = 'Tabs' }: TabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      let next: number | null = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % tabs.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      if (next !== null) {
        e.preventDefault();
        tabRefs.current[next]?.focus();
        onChange(tabs[next].id);
      }
    },
    [tabs, onChange],
  );

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cx(
        'nice-scroll flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-1',
        'dark:border-slate-800 dark:bg-slate-900',
        className,
      )}
    >
      {tabs.map((tab, i) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={active}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cx(
              'inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
              active
                ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-800 dark:text-brand-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100',
            )}
          >
            {tab.icon && <Icon name={tab.icon} size={16} />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  id,
  active,
  className,
  children,
}: {
  id: string;
  active: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  if (!active) return null;
  return (
    <div role="tabpanel" id={`tabpanel-${id}`} aria-labelledby={`tab-${id}`} className={className}>
      {children}
    </div>
  );
}

/* ---------------------------------- Dialog -------------------------------- */

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Extra actions rendered in the footer. */
  footer?: React.ReactNode;
  /** 'sm' | 'md' | 'lg' */
  size?: 'sm' | 'md' | 'lg';
}

const DIALOG_SIZES: Record<NonNullable<DialogProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
};

export function Dialog({ open, onClose, title, children, footer, size = 'md' }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Keep the latest onClose in a ref: parent components often pass inline
  // arrow closures that change identity every render. If the effect below
  // depended on `onClose` directly, it would re-run (and yank focus back to
  // the dialog panel) on every keystroke typed inside the dialog.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    // Lock body scroll while the modal is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus into the dialog
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(
          'flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-[var(--shadow-pop)]',
          'sm:rounded-2xl dark:bg-slate-900',
          DIALOG_SIZES[size],
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
            <Icon name="x" size={20} />
          </Button>
        </div>
        <div className="nice-scroll flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ----------------------------------- Stat --------------------------------- */

export function Stat({
  label,
  value,
  sub,
  icon,
  tone = 'info',
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: IconName;
  tone?: 'info' | 'present' | 'absent' | 'pending' | 'overdue' | 'neutral';
  className?: string;
}) {
  const tones: Record<string, string> = {
    info: 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
    present: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    absent: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  };
  return (
    <Card className={cx('p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">{label}</p>
          <p title={String(value)} className="tnum mt-1 truncate text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
        </div>
        {icon && (
          <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', tones[tone])}>
            <Icon name={icon} size={22} />
          </span>
        )}
      </div>
    </Card>
  );
}

/* -------------------------------- EmptyState ------------------------------ */

export function EmptyState({
  icon = 'info',
  title,
  guidance,
  action,
  className,
}: {
  icon?: IconName;
  title: string;
  guidance: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center',
        'dark:border-slate-700',
        className,
      )}
      role="status"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <Icon name={icon} size={24} />
      </span>
      <p className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</p>
      <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{guidance}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/* -------------------------------- PageHeader ------------------------------ */

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('mb-6 flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* --------------------------------- Skeleton ------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx('skeleton-shimmer rounded-lg', className)} />;
}

/* ------------------------------- Form row --------------------------------- */

export function FormGrid({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('grid grid-cols-1 gap-4 sm:grid-cols-2', className)}>{children}</div>;
}

/* --------------------------------- Context -------------------------------- */

const ConfirmCtx = createContext<((opts: { title: string; message: string; confirmLabel?: string }) => Promise<boolean>) | null>(null);

/**
 * Provides a promise-based confirm dialog. Wrap interactive pages once:
 *   <ConfirmProvider>{children}</ConfirmProvider>
 * Then `const confirm = useConfirm(); if (await confirm({title, message})) { ... }`
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<null | { title: string; message: string; confirmLabel: string }>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((opts: { title: string; message: string; confirmLabel?: string }) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setState({ title: opts.title, message: opts.message, confirmLabel: opts.confirmLabel ?? 'Confirm' });
    });
  }, []);

  const settle = useCallback((v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setState(null);
  }, []);

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Dialog open={state !== null} onClose={() => settle(false)} title={state?.title ?? ''} size="sm">
        <p className="whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{state?.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => settle(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => settle(true)}>
            {state?.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      </Dialog>
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}
