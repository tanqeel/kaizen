import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';
import { generateKaizenId } from '@/lib/kaizen-id';

/**
 * POST /api/admin/backfill-kaizen-ids — assigns KAIZEN IDs to existing users
 * that don't have one. SUPER_ADMIN only. Idempotent and concurrency-safe
 * (relies on the unique constraint; retries on collision).
 * One-time use: run once after migration, then remove.
 */
export async function POST() {
  const auth = await apiUser('admin.manage');
  if (auth.error) return auth.error;

  const users = await prisma.user.findMany({
    where: { kaizenId: null },
    select: { id: true, role: true, name: true, email: true },
  });

  let assigned = 0;
  const errors: string[] = [];

  for (const u of users) {
    // Retry on unique-constraint collision (extremely rare, but safe).
    for (let attempt = 0; attempt < 5; attempt++) {
      const kaizenId = await generateKaizenId(u.role);
      try {
        await prisma.user.update({
          where: { id: u.id },
          data: { kaizenId },
        });
        assigned++;
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (msg.includes('Unique constraint') && attempt < 4) continue;
        errors.push(`${u.email}: ${msg.slice(0, 100)}`);
        break;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    total: users.length,
    assigned,
    errors,
  });
}
