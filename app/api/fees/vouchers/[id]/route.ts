import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUserStrict as apiUser } from '@/lib/api-auth';
import { childStudentIds } from '@/lib/parents';
import { balanceDueWithPolicy, currentFineAmount, displayStatus, effectiveTotalWithPolicy, paidSum, type DisplayStatus, type FinePolicy } from '@/lib/fees';

/** GET /api/fees/vouchers/[id] — voucher detail with lines + payments. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('finance.view');
  if (auth.error) return auth.error;
  const { user } = auth;
  const { id } = await ctx.params;

  const voucher = await prisma.feeVoucher.findUnique({
    where: { id },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          admissionNo: true,
          grade: { select: { name: true } },
          section: { select: { name: true } },
        },
      },
      lines: {
        include: { feeHead: { select: { name: true } } },
        orderBy: { feeHead: { name: 'asc' } },
      },
      payments: { orderBy: { paidAt: 'desc' } },
      session: { select: { name: true, term: true, schoolId: true } },
    },
  });
  if (!voucher) return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });

  if (user.role === 'PARENT') {
    const ids = await childStudentIds(user.id);
    if (!ids.includes(voucher.studentId)) {
      return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });
    }
  }

  const paid = paidSum(voucher.payments);
  // Policy-accrued fine so a voucher generated before its due date still shows the correct fine once overdue.
  const feePolicy: FinePolicy | null = await prisma.feePolicy.findFirst({
    where: { schoolId: voucher.session.schoolId },
    select: { finePerDay: true, fineGraceDays: true },
  });
  const fineAmount = currentFineAmount(voucher, feePolicy);
  const payable = effectiveTotalWithPolicy(voucher, feePolicy);
  const ds: DisplayStatus = displayStatus(voucher);

  return NextResponse.json({
    voucher: {
      id: voucher.id,
      month: voucher.month,
      year: voucher.year,
      dueDate: voucher.dueDate.toISOString(),
      issuedAt: voucher.issuedAt.toISOString(),
      totalAmount: voucher.totalAmount,
      discountAmount: voucher.discountAmount,
      fineAmount,
      storedFineAmount: voucher.fineAmount,
      payable,
      paid,
      balance: Math.max(0, balanceDueWithPolicy(voucher, voucher.payments, feePolicy)),
      status: voucher.status,
      displayStatus: ds,
      student: voucher.student,
      session: voucher.session,
      lines: voucher.lines.map((l) => ({ id: l.id, headName: l.feeHead.name, amount: l.amount })),
      payments: voucher.payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        reference: p.reference,
        receiptNo: p.reference ?? `RCP-${p.id.slice(-6).toUpperCase()}`,
        paidAt: p.paidAt.toISOString(),
      })),
    },
  });
}
