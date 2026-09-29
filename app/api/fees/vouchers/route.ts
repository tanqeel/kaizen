import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUserStrict as apiUser } from '@/lib/api-auth';
import { balanceDueWithPolicy, currentFineAmount, displayStatus, effectiveTotalWithPolicy, monthLabel, paidSum, type DisplayStatus, type FinePolicy } from '@/lib/fees';
import { childStudentIds } from '@/lib/parents';
import { todayPKT } from '@/lib/format';
import type { VoucherStatus } from '@prisma/client';

export interface VoucherRow {
  id: string;
  month: number;
  year: number;
  dueDate: string;
  totalAmount: number;
  discountAmount: number;
  fineAmount: number;
  payable: number;
  status: VoucherStatus;
  paid: number;
  balance: number;
  displayStatus: DisplayStatus;
  student: { id: string; name: string; admissionNo: string; grade: string; section: string };
}

export interface VoucherSummary {
  count: number;
  billed: number;
  collected: number;
  outstanding: number;
}

const STATUS_FILTERS = ['paid', 'partial', 'unpaid', 'overdue'] as const;

/**
 * GET /api/fees/vouchers?month&year&status&q&format
 * Lists fee vouchers with computed balance + displayStatus (OVERDUE is
 * computed, never stored). status filter: paid|partial|unpaid|overdue.
 * format=csv returns a CSV download. Parents only see their own children.
 */
export async function GET(req: Request) {
  const auth = await apiUser('finance.view');
  if (auth.error) return auth.error;
  const { user } = auth;

  const url = new URL(req.url);
  const now = todayPKT();
  const month = parseInt(url.searchParams.get('month') ?? '', 10) || parseInt(now.slice(5, 7), 10);
  const year = parseInt(url.searchParams.get('year') ?? '', 10) || parseInt(now.slice(0, 4), 10);
  const statusFilter = (url.searchParams.get('status') ?? '').toUpperCase();
  const q = url.searchParams.get('q')?.trim() ?? '';
  const format = url.searchParams.get('format');

  const childIds = user.role === 'PARENT' ? await childStudentIds(user.id) : null;

  // Single policy fetch for the whole list — fine accrues per voucher from it.
  const school = await prisma.school.findFirst({ select: { id: true } });
  const feePolicy: FinePolicy | null = school
    ? await prisma.feePolicy.findFirst({
        where: { schoolId: school.id },
        select: { finePerDay: true, fineGraceDays: true },
      })
    : null;

  const vouchers = await prisma.feeVoucher.findMany({
    where: {
      month, year,
      ...(childIds ? { studentId: { in: childIds } } : {}),
      ...(q
        ? {
            student: {
              OR: [
                { name: { contains: q } },
                { admissionNo: { contains: q } },
              ],
            },
          }
        : {}),
    },
    include: {
      student: { include: { grade: true, section: true } },
      payments: { select: { amount: true } },
    },
    orderBy: [{ student: { name: 'asc' } }],
  });

  const rows: VoucherRow[] = vouchers.map((v) => {
    const paid = paidSum(v.payments);
    const fineAmount = currentFineAmount(v, feePolicy);
    const payable = effectiveTotalWithPolicy(v, feePolicy);
    const balance = Math.max(0, balanceDueWithPolicy(v, v.payments, feePolicy));
    return {
      id: v.id,
      month: v.month, year: v.year,
      dueDate: v.dueDate.toISOString(),
      totalAmount: v.totalAmount, discountAmount: v.discountAmount, fineAmount,
      payable,
      status: v.status,
      paid, balance,
      displayStatus: displayStatus(v),
      student: {
        id: v.student.id, name: v.student.name, admissionNo: v.student.admissionNo,
        grade: v.student.grade.name, section: v.student.section.name,
      },
    };
  });

  const filtered =
    (STATUS_FILTERS as readonly string[]).includes(statusFilter.toLowerCase())
      ? rows.filter((r) => r.displayStatus === statusFilter)
      : rows;

  if (format === 'csv') {
    const header = 'Month,Admission No,Student,Grade,Section,Total (PKR),Paid (PKR),Balance (PKR),Status,Due Date';
    const lines = filtered.map((r) =>
      [
        monthLabel(r.month, r.year),
        r.student.admissionNo,
        `"${r.student.name.replace(/"/g, '""')}"`,
        r.student.grade,
        r.student.section,
        r.payable, r.paid, r.balance,
        r.displayStatus,
        r.dueDate.slice(0, 10),
      ].join(','),
    );
    const csv = [header, ...lines].join('\n');
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="fee-vouchers-${year}-${String(month).padStart(2, '0')}.csv"`,
      },
    });
  }

  const summary: VoucherSummary = {
    count: filtered.length,
    billed: filtered.reduce((s, r) => s + r.payable, 0),
    collected: filtered.reduce((s, r) => s + r.paid, 0),
    outstanding: filtered.reduce((s, r) => s + r.balance, 0),
  };
  return NextResponse.json({ vouchers: filtered, summary });
}
