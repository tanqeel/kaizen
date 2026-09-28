import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';
import { balanceDue, effectiveTotal, paidSum } from '@/lib/fees';
import { pkr } from '@/lib/format';
import { PaymentMethod } from '@prisma/client';

const METHODS = new Set(Object.values(PaymentMethod));

/**
 * POST /api/fees/vouchers/[id]/payments { amount, method, reference? }
 * Records a real payment against a voucher; recomputes paid sum and the
 * voucher status (PAID when fully covered, else PARTIAL).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('finance.manage');
  if (auth.error) return auth.error;
  const { user } = auth;
  const { id } = await ctx.params;

  let body: { amount?: number; method?: string; reference?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive whole number (PKR)' }, { status: 400 });
  }
  if (!body.method || !METHODS.has(body.method as PaymentMethod)) {
    return NextResponse.json(
      { error: `method must be one of: ${[...METHODS].join(', ')}` },
      { status: 400 },
    );
  }
  const reference =
    typeof body.reference === 'string' && body.reference.trim()
      ? body.reference.trim().slice(0, 100)
      : null;

  const voucher = await prisma.feeVoucher.findUnique({
    where: { id },
    include: { payments: { select: { amount: true } } },
  });
  if (!voucher) return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });

  const payable = effectiveTotal(voucher);
  const paid = paidSum(voucher.payments);
  const balance = Math.max(0, balanceDue(voucher, voucher.payments));
  if (amount > balance) {
    return NextResponse.json(
      { error: `Amount ${pkr(amount)} exceeds the balance due of ${pkr(balance)}` },
      { status: 400 },
    );
  }

  const payment = await prisma.payment.create({
    data: {
      voucherId: voucher.id,
      amount,
      method: body.method as PaymentMethod,
      reference,
      receivedById: user.id,
      paidAt: new Date(),
    },
  });
  // Receipt numbers are always system-generated; the user's reference stays untouched.
  const receiptNo = `RCP-${payment.id.slice(-6).toUpperCase()}`;

  const newPaid = paid + amount;
  const status = newPaid >= payable ? 'PAID' : 'PARTIAL';
  await prisma.feeVoucher.update({ where: { id: voucher.id }, data: { status } });

  return NextResponse.json({
    ok: true,
    payment: {
      id: payment.id,
      amount: payment.amount,
      method: payment.method,
      reference: payment.reference,
      receiptNo,
      paidAt: payment.paidAt.toISOString(),
    },
    status,
    paid: newPaid,
    balance: Math.max(0, payable - newPaid),
  });
}
