import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';
import { generateInsights } from '@/lib/intelligence';

/**
 * GET /api/intelligence — list insights for the school (principal/admin).
 * POST /api/intelligence — trigger a new analysis run.
 */
export async function GET() {
  const auth = await apiUser(['admin.manage', 'users.manage']);
  if (auth.error) return auth.error;

  const school = await prisma.school.findFirst({ select: { id: true } });
  if (!school) return NextResponse.json({ error: 'No school configured.' }, { status: 400 });

  const insights = await prisma.intelligenceInsight.findMany({
    where: { schoolId: school.id },
    include: { reviewedBy: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({ insights });
}

export async function POST() {
  const auth = await apiUser(['admin.manage', 'users.manage']);
  if (auth.error) return auth.error;

  const school = await prisma.school.findFirst({ select: { id: true } });
  if (!school) return NextResponse.json({ error: 'No school configured.' }, { status: 400 });

  const created = await generateInsights(school.id);
  return NextResponse.json({ ok: true, created });
}
