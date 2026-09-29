import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUserStrict as apiUser } from '@/lib/api-auth';

/** Defaults applied when no FeePolicy row exists yet. */
export const FEE_POLICY_DEFAULTS = { fineGraceDays: 10, finePerDay: 0 };

/** GET /api/fee-policy — current fine policy (defaults when unconfigured). */
export async function GET() {
  const auth = await apiUser('finance.manage');
  if (auth.error) return auth.error;

  const policy = await prisma.feePolicy.findFirst({
    select: { fineGraceDays: true, finePerDay: true, updatedAt: true },
  });
  if (!policy) {
    return NextResponse.json({ ...FEE_POLICY_DEFAULTS, configured: false });
  }
  return NextResponse.json({ fineGraceDays: policy.fineGraceDays, finePerDay: policy.finePerDay, configured: true });
}

/** PUT /api/fee-policy { fineGraceDays, finePerDay } — upsert per school. */
export async function PUT(req: Request) {
  const auth = await apiUser('finance.manage');
  if (auth.error) return auth.error;

  let body: { fineGraceDays?: unknown; finePerDay?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const fineGraceDays = Number(body.fineGraceDays);
  const finePerDay = Number(body.finePerDay);
  if (!Number.isInteger(fineGraceDays) || fineGraceDays < 0) {
    return NextResponse.json({ error: 'fineGraceDays must be an integer ≥ 0' }, { status: 400 });
  }
  if (!Number.isInteger(finePerDay) || finePerDay < 0) {
    return NextResponse.json({ error: 'finePerDay must be an integer ≥ 0' }, { status: 400 });
  }

  const school = await prisma.school.findFirst({ select: { id: true } });
  if (!school) return NextResponse.json({ error: 'No school configured' }, { status: 400 });

  const policy = await prisma.feePolicy.upsert({
    where: { schoolId: school.id },
    update: { fineGraceDays, finePerDay },
    create: { schoolId: school.id, fineGraceDays, finePerDay },
    select: { fineGraceDays: true, finePerDay: true },
  });
  return NextResponse.json({ ...policy, configured: true });
}
