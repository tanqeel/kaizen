import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';
import { auditLog } from '@/lib/audit';

/**
 * PATCH /api/intelligence/[id] — review an insight.
 * Body: { status: 'REVIEWED' | 'DISMISSED' | 'IMPLEMENTED', note? }
 * Human-in-the-loop: insights never auto-apply; a principal/admin records the decision.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser(['admin.manage', 'users.manage']);
  if (auth.error) return auth.error;

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const status = String(body.status ?? '').toUpperCase();
  if (!['REVIEWED', 'DISMISSED', 'IMPLEMENTED'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }

  const insight = await prisma.intelligenceInsight.findUnique({ where: { id } });
  if (!insight) return NextResponse.json({ error: 'Insight not found.' }, { status: 404 });

  const note = String(body.note ?? '').trim() || null;
  await prisma.intelligenceInsight.update({
    where: { id },
    data: {
      status,
      reviewedById: auth.user.id,
      reviewedAt: new Date(),
      ...(note ? { explanation: insight.explanation + `\n\nReviewer note: ${note}` } : {}),
    },
  });

  const school = await prisma.school.findFirst({ select: { id: true } });
  if (school) {
    await auditLog({
      schoolId: school.id,
      actorId: auth.user.id,
      action: 'INSIGHT_REVIEWED',
      targetType: 'IntelligenceInsight',
      targetId: id,
      detail: `"${insight.title}" → ${status}`,
    });
  }

  return NextResponse.json({ ok: true, status });
}
