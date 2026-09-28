import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';
import type { DiscountType } from '@prisma/client';

export const DISCOUNT_TYPES: readonly DiscountType[] = [
  'SIBLING',
  'STAFF_WARD',
  'MERIT',
  'NEED_BASED',
  'OTHER',
];

/**
 * GET /api/discounts?studentId=… — list discounts (with approver name).
 * POST /api/discounts { studentId, type, percent?, amount?, reason? }
 *   — exactly one of percent (1–100) or amount (> 0 PKR) is required.
 *   The discount is auto-approved by the caller (approvedById = me).
 */
export async function GET(req: Request) {
  const auth = await apiUser('finance.manage');
  if (auth.error) return auth.error;

  const studentId = new URL(req.url).searchParams.get('studentId') ?? undefined;
  const discounts = await prisma.discount.findMany({
    where: studentId ? { studentId } : undefined,
    include: { approvedBy: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ discounts });
}

export async function POST(req: Request) {
  const auth = await apiUser('finance.manage');
  if (auth.error) return auth.error;
  const { user } = auth;

  let body: {
    studentId?: string;
    type?: string;
    percent?: number | string | null;
    amount?: number | string | null;
    reason?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const studentId = body.studentId?.trim();
  if (!studentId) {
    return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
  }
  const student = await prisma.student.findFirst({
    where: { id: studentId, isActive: true },
    select: { id: true },
  });
  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  const type = body.type as DiscountType;
  if (!type || !DISCOUNT_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `type must be one of: ${DISCOUNT_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  const rawPercent = body.percent === undefined || body.percent === null || body.percent === '' ? null : Number(body.percent);
  const rawAmount = body.amount === undefined || body.amount === null || body.amount === '' ? null : Number(body.amount);
  const hasPercent = rawPercent !== null;
  const hasAmount = rawAmount !== null;
  if (hasPercent === hasAmount) {
    return NextResponse.json(
      { error: 'Provide exactly one of percent or amount' },
      { status: 400 },
    );
  }

  let percent: number | null = null;
  let amount: number | null = null;
  if (hasPercent) {
    if (!Number.isInteger(rawPercent) || (rawPercent as number) < 1 || (rawPercent as number) > 100) {
      return NextResponse.json({ error: 'percent must be a whole number 1–100' }, { status: 400 });
    }
    percent = rawPercent as number;
  } else {
    if (!Number.isInteger(rawAmount) || (rawAmount as number) <= 0) {
      return NextResponse.json({ error: 'amount must be a whole PKR value greater than 0' }, { status: 400 });
    }
    amount = rawAmount as number;
  }

  const discount = await prisma.discount.create({
    data: {
      studentId,
      type,
      percent,
      amount,
      reason: body.reason?.trim() || null,
      approvedById: user.id,
    },
    include: { approvedBy: { select: { name: true } } },
  });
  return NextResponse.json({ discount }, { status: 201 });
}
