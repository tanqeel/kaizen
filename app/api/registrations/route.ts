import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';

/** GET /api/registrations — list registration requests (principal/admin). */
export async function GET() {
  const auth = await apiUser('users.manage');
  if (auth.error) return auth.error;

  const school = await prisma.school.findFirst({ select: { id: true } });
  if (!school) return NextResponse.json({ error: 'No school configured.' }, { status: 400 });

  const requests = await prisma.registrationRequest.findMany({
    where: { schoolId: school.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({ requests });
}
