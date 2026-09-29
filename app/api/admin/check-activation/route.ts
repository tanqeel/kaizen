import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';

/** POST /api/admin/check-activation — one-time: verifies ActivationToken table exists. */
export async function POST() {
  try {
    const auth = await apiUser('admin.manage');
    if (auth.error) return auth.error;
    // Try to count tokens — if table doesn't exist, this throws.
    const count = await prisma.activationToken.count();
    // Try creating a test token to verify the full flow works.
    let testTokenOk = false;
    let testError = '';
    try {
      const { createActivationToken } = await import('@/lib/activation');
      // Use a dummy user ID — this will fail FK constraint, but tests the code path.
      await createActivationToken('test-dummy-id', 'ACTIVATION');
      testTokenOk = true;
    } catch (e) {
      testError = String(e).slice(0, 200);
    }
    return NextResponse.json({ ok: true, tableExists: true, count, testTokenOk, testError });
  } catch (e) {
    const msg = String(e);
    if (msg.includes('does not exist') || msg.includes('relation')) {
      // Create the table.
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "ActivationToken" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE, "tokenHash" TEXT NOT NULL UNIQUE, "purpose" TEXT NOT NULL DEFAULT 'ACTIVATION', "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "ActivationToken_userId_idx" ON "ActivationToken"("userId")`
      );
      return NextResponse.json({ ok: true, tableExists: false, created: true });
    }
    return NextResponse.json({ ok: false, error: msg.slice(0, 300) }, { status: 500 });
  }
}
