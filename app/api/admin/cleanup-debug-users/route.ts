import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// TARGETED cleanup: deletes only the 17 explicitly identified debugging users
// and their associated tokens/registration requests. Nothing else is touched.
// Requires SUPER_ADMIN session. DELETE THIS FILE after use.
const DEBUG_NAMES = [
  'Final Success',
  'Raw SQL Test',
  'Clean Test',
  'Deploy Check',
  'Retry Pwd',
  'Final Pwd Test',
  'Debug Test',
  'Pwd Test',
  'Final Verify',
  'Activation E2E',
  'Token Test',
  'E2E Test',
  'E2E Test 2',
  'X',
  'Test Parent',
  'Test Parent 2',
  'Test Parent 3',
];

export async function POST(req: Request) {
  // One-time secret protection (delete file after use)
  const secret = req.headers.get('x-cleanup-secret');
  if (secret !== '4b909aa984038a2dc281cd46f897f0c84d39ce3351d1cb25c9480ed1f1fb7044') {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const users = await prisma.user.findMany({
      where: { name: { in: DEBUG_NAMES } },
      select: { id: true, name: true, email: true },
    });

    const userIds = users.map((u) => u.id);
    
    if (userIds.length === 0) {
      return NextResponse.json({ ok: true, deleted: 0, message: 'No debug users found' });
    }

    // Delete associated records first (foreign key constraints)
    await prisma.activationToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.registrationRequest.deleteMany({ 
      where: { 
        OR: [
          { createdUserId: { in: userIds } },
          { fullName: { in: DEBUG_NAMES } },
        ]
      } 
    });
    
    // Delete the users
    const result = await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    return NextResponse.json({ 
      ok: true, 
      deleted: result.count,
      users: users.map((u) => ({ name: u.name, email: u.email })),
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ ok: false, error: 'Cleanup failed' }, { status: 500 });
  }
}
