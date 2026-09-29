import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUserStrict as apiUser, schoolIdOr400 } from '@/lib/api-auth';

/** GET /api/expenses/sources — payment sources (Cash, Bank, …) for forms. */
export async function GET() {
  const auth = await apiUser('finance.manage');
  if (auth.error) return auth.error;
  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  const sources = await prisma.paymentSource.findMany({
    where: { schoolId: sres.schoolId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
  return NextResponse.json({ sources });
}
