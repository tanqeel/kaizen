import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';

/** GET /api/users — list users with identity info (principal/admin). Never returns passwordHash. */
export async function GET(req: Request) {
  const auth = await apiUser('users.manage');
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const role = url.searchParams.get('role');
  const status = url.searchParams.get('status');
  const q = url.searchParams.get('q')?.trim();

  const users = await prisma.user.findMany({
    where: {
      ...(role ? { role: role as never } : {}),
      ...(status ? { status: status as never } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { kaizenId: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      kaizenId: true,
      name: true,
      email: true,
      role: true,
      status: true,
      isActive: true,
      forcePasswordReset: true,
      phone: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return NextResponse.json({ users });
}
