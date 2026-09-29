import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

/**
 * POST /api/admin/cleanup-test-data
 * TEMPORARY — removes test users created during activation debugging.
 * Delete this file after use.
 */
export async function POST() {
  const session = await getSession();
  if (!session || (session as { role?: string }).role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const testPatterns = [
    'E2E Test',
    'Activation E2E',
    'Final Verify',
    'Pwd Test',
    'Debug Test',
    'Retry Pwd',
    'Deploy Check',
    'Clean Test',
    'Raw SQL Test',
    'Final Success',
    'Final Pwd Test',
    'Test Parent',
    'Token Test',
  ];

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { in: testPatterns } },
        { name: 'X' },
        { email: { contains: '@kaizen.local' } },
      ],
    },
    select: { id: true, name: true, email: true },
  });

  // Safety: never delete the 6 demo accounts or superadmin
  const safeUsers = users.filter(
    (u) =>
      !u.email?.includes('@kaizen.pk') &&
      u.email !== 'superadmin@kaizen.pk',
  );

  const ids = safeUsers.map((u) => u.id);

  // Delete related records first
  await prisma.activationToken.deleteMany({ where: { userId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } });
  await prisma.registrationRequest.deleteMany({
    where: { OR: testPatterns.map((p) => ({ fullName: { contains: p } })) },
  });

  const deleted = await prisma.user.deleteMany({ where: { id: { in: ids } } });

  return NextResponse.json({
    ok: true,
    deleted: deleted.count,
    names: safeUsers.map((u) => u.name),
  });
}
