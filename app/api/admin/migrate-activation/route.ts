import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';

/** POST /api/admin/migrate-activation — one-time: creates ActivationToken table. */
export async function POST() {
  try {
    const auth = await apiUser('admin.manage');
    if (auth.error) return auth.error;
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "ActivationToken" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE, "tokenHash" TEXT NOT NULL UNIQUE, "purpose" TEXT NOT NULL DEFAULT 'ACTIVATION', "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "ActivationToken_userId_idx" ON "ActivationToken"("userId")`
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 300) }, { status: 500 });
  }
}
