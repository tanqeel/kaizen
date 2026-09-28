import type { FeeHead, VoucherStatus } from '@prisma/client';
import { todayPKT } from './format';

/**
 * Fee-domain helpers. Client-safe: no prisma imports here so pages'
 * client components can use them too.
 */

export const MONTHS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export type DisplayStatus = 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE';

/** "September 2026" for a month number + year. */
export function monthLabel(month: number, year: number): string {
  const m = MONTHS.find((x) => x.value === month);
  return `${m ? m.label : ''} ${year}`;
}

/**
 * OVERDUE is always computed, never stored: a voucher is overdue when its
 * due date (PKT calendar day) is before today and it is not fully paid.
 */
export function displayStatus(
  v: { status: VoucherStatus; dueDate: Date },
  todayStr: string = todayPKT(),
): DisplayStatus {
  if (v.status === 'PAID') return 'PAID';
  return todayPKT(v.dueDate) < todayStr ? 'OVERDUE' : v.status;
}

/** Badge variant for the shared <Badge> component. */
export function statusBadgeVariant(s: DisplayStatus): 'paid' | 'pending' | 'unpaid' | 'overdue' {
  switch (s) {
    case 'PAID':
      return 'paid';
    case 'PARTIAL':
      return 'pending';
    case 'OVERDUE':
      return 'overdue';
    default:
      return 'unpaid';
  }
}

/** Total the family owes on a voucher after discount/fine adjustments. */
export function effectiveTotal(v: { totalAmount: number; discountAmount: number; fineAmount: number }): number {
  return v.totalAmount + v.fineAmount - v.discountAmount;
}

export function paidSum(payments: Array<{ amount: number }>): number {
  return payments.reduce((s, p) => s + p.amount, 0);
}

export function balanceDue(
  v: { totalAmount: number; discountAmount: number; fineAmount: number },
  payments: Array<{ amount: number }>,
): number {
  return effectiveTotal(v) - paidSum(payments);
}

/**
 * Fee heads applicable to one student: for each head name, prefer the
 * grade-specific head matching the student's grade; otherwise fall back to
 * the global (gradeId = null) head(s) of that name.
 */
export function headsForStudent(heads: FeeHead[], gradeId: string): FeeHead[] {
  const byName = new Map<string, FeeHead[]>();
  for (const h of heads) {
    const arr = byName.get(h.name);
    if (arr) arr.push(h);
    else byName.set(h.name, [h]);
  }
  const out: FeeHead[] = [];
  for (const arr of byName.values()) {
    const specific = arr.find((h) => h.gradeId === gradeId);
    if (specific) out.push(specific);
    else out.push(...arr.filter((h) => h.gradeId === null));
  }
  return out;
}

/** Payment methods accepted on fee vouchers (matches PaymentMethod enum). */
export const PAYMENT_METHODS: Array<{ value: string; label: string }> = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'KUICKPAY_1LINK', label: 'Kuickpay / 1Link' },
  { value: 'JAZZCASH', label: 'JazzCash' },
  { value: 'EASYPAISA', label: 'Easypaisa' },
];

/** Escape one CSV cell. */
export function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Trigger a browser download of CSV text. */
export function downloadCsv(filename: string, header: string[], rows: Array<Array<string | number>>): void {
  const lines = [header.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
