import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';
import { balanceDue } from '@/lib/fees';

/**
 * GET /api/lookup/students/[id]/balance — a student's real outstanding fee
 * balance (sum over all their vouchers). Used for SMS template previews.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser(['finance.view', 'comms.manage']);
  if (auth.error) return auth.error;

  const { id } = await params;
  const student = await prisma.student.findFirst({
    where: { id, isActive: true },
    include: { vouchers: { include: { payments: { select: { amount: true } } } } },
  });
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  const outstanding = student.vouchers.reduce(
    (s, v) => s + Math.max(0, balanceDue(v, v.payments)),
    0,
  );

  return NextResponse.json({
    student: { id: student.id, name: student.name, admissionNo: student.admissionNo },
    outstanding,
  });
}
