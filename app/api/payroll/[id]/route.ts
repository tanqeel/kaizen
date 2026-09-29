import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUserStrict as apiUser } from '@/lib/api-auth';

const STATUSES = ['DRAFT', 'GENERATED', 'PAID'] as const;
type PayslipStatus = (typeof STATUSES)[number];

function validMoney(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

/**
 * PATCH /api/payroll/[id] { allowances?, deductions?, status? }
 * payroll.manage only. Recomputes netPay = baseSalary + allowances − deductions.
 * Transitioning to PAID stamps paidAt; moving away from PAID clears it.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('payroll.manage');
  if (auth.error) return auth.error;

  const { id } = await params;
  const slip = await prisma.payslip.findUnique({ where: { id } });
  if (!slip) return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });

  let body: { allowances?: unknown; deductions?: unknown; status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (body.allowances !== undefined && !validMoney(body.allowances)) {
    return NextResponse.json({ error: 'allowances must be an integer ≥ 0' }, { status: 400 });
  }
  if (body.deductions !== undefined && !validMoney(body.deductions)) {
    return NextResponse.json({ error: 'deductions must be an integer ≥ 0' }, { status: 400 });
  }
  const status: PayslipStatus | undefined =
    body.status === undefined
      ? undefined
      : STATUSES.includes(body.status as PayslipStatus)
        ? (body.status as PayslipStatus)
        : undefined;
  if (body.status !== undefined && status === undefined) {
    return NextResponse.json({ error: `status must be one of ${STATUSES.join(', ')}` }, { status: 400 });
  }

  const allowances = body.allowances === undefined ? slip.allowances : (body.allowances as number);
  const deductions = body.deductions === undefined ? slip.deductions : (body.deductions as number);
  const netPay = slip.baseSalary + allowances - deductions;
  if (netPay < 0) {
    return NextResponse.json({ error: 'netPay cannot be negative' }, { status: 400 });
  }

  const nextStatus = status ?? slip.status;
  let paidAt = slip.paidAt;
  if (nextStatus === 'PAID' && slip.status !== 'PAID') paidAt = new Date();
  else if (nextStatus !== 'PAID') paidAt = null;

  const updated = await prisma.payslip.update({
    where: { id },
    data: { allowances, deductions, netPay, status: nextStatus, paidAt },
  });

  return NextResponse.json({
    id: updated.id,
    allowances: updated.allowances,
    deductions: updated.deductions,
    netPay: updated.netPay,
    status: updated.status,
    paidAt: updated.paidAt ? updated.paidAt.toISOString() : null,
  });
}

/**
 * DELETE /api/payroll/[id] — payroll.manage only; PAID payslips cannot be deleted.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('payroll.manage');
  if (auth.error) return auth.error;

  const { id } = await params;
  const slip = await prisma.payslip.findUnique({ where: { id }, select: { status: true } });
  if (!slip) return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
  if (slip.status === 'PAID') {
    return NextResponse.json({ error: 'Paid payslips cannot be deleted' }, { status: 409 });
  }

  await prisma.payslip.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
