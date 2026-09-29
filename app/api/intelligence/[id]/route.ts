import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';
import { auditLog } from '@/lib/audit';

/**
 * PATCH /api/intelligence/[id] — review an insight (human-in-the-loop).
 *
 * Body: {
 *   status: 'REVIEWED' | 'DISMISSED' | 'IMPLEMENTED',
 *   reviewerNotes?: string,   // dedicated field, not appended to explanation
 *   decision?: 'APPROVED' | 'REJECTED' | 'DEFERRED',
 *   outcome?: string,          // what happened after implementation
 * }
 *
 * Insights never auto-apply. A principal/admin records the decision,
 * and later records the measured outcome — closing the
 * Observe → Analyze → Detect → Recommend → Review → Decide → Implement → Measure → Learn loop.
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

  const decision = body.decision ? String(body.decision).toUpperCase() : null;
  if (decision && !['APPROVED', 'REJECTED', 'DEFERRED'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision.' }, { status: 400 });
  }

  const insight = await prisma.intelligenceInsight.findUnique({ where: { id } });
  if (!insight) return NextResponse.json({ error: 'Insight not found.' }, { status: 404 });

  const reviewerNotes = String(body.reviewerNotes ?? body.note ?? '').trim() || null;
  const outcome = String(body.outcome ?? '').trim() || null;

  await prisma.intelligenceInsight.update({
    where: { id },
    data: {
      status,
      reviewedById: auth.user.id,
      reviewedAt: new Date(),
      ...(reviewerNotes ? { reviewerNotes } : {}),
      ...(decision ? { decision, decidedAt: new Date() } : {}),
      ...(outcome ? { outcome, measuredAt: new Date() } : {}),
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
      detail: `"${insight.title}" → ${status}${decision ? ` (${decision})` : ''}`,
    });
  }

  return NextResponse.json({ ok: true, status });
}
