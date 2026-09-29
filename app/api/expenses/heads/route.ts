import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUserStrict as apiUser, schoolIdOr400 } from '@/lib/api-auth';

/**
 * GET /api/expenses/heads — expense heads for this school.
 * POST /api/expenses/heads { name } — add a head.
 */
export async function GET() {
  const auth = await apiUser('finance.manage');
  if (auth.error) return auth.error;
  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  const heads = await prisma.expenseHead.findMany({
    where: { schoolId: sres.schoolId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
  return NextResponse.json({ heads });
}

export async function POST(req: Request) {
  const auth = await apiUser('finance.manage');
  if (auth.error) return auth.error;
  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const existing = await prisma.expenseHead.findFirst({
    where: { schoolId: sres.schoolId, name },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ error: 'An expense head with this name already exists' }, { status: 400 });

  const head = await prisma.expenseHead.create({ data: { schoolId: sres.schoolId, name: name.slice(0, 80) } });
  return NextResponse.json({ ok: true, head: { id: head.id, name: head.name } }, { status: 201 });
}
