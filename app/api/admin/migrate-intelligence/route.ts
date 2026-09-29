import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';

/** POST /api/admin/migrate-intelligence — one-time: adds review/outcome fields. */
export async function POST() {
  try {
    const auth = await apiUser('admin.manage');
    if (auth.error) return auth.error;
    const stmts = [
      `ALTER TABLE "IntelligenceInsight" ADD COLUMN IF NOT EXISTS "suggestedAction" TEXT`,
      `ALTER TABLE "IntelligenceInsight" ADD COLUMN IF NOT EXISTS "reviewerNotes" TEXT`,
      `ALTER TABLE "IntelligenceInsight" ADD COLUMN IF NOT EXISTS "decision" TEXT`,
      `ALTER TABLE "IntelligenceInsight" ADD COLUMN IF NOT EXISTS "decidedAt" TIMESTAMP(3)`,
      `ALTER TABLE "IntelligenceInsight" ADD COLUMN IF NOT EXISTS "outcome" TEXT`,
      `ALTER TABLE "IntelligenceInsight" ADD COLUMN IF NOT EXISTS "measuredAt" TIMESTAMP(3)`,
      `ALTER TABLE "IntelligenceInsight" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    ];
    for (const sql of stmts) {
      await prisma.$executeRawUnsafe(sql);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 300) }, { status: 500 });
  }
}
