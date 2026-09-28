import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Public route with no session — must run per-request, never statically
// prerender at build time.
export const dynamic = 'force-dynamic';

/**
 * GET /api/admissions/grades — PUBLIC (no auth).
 * Powers the public application form. Returns only the school name and
 * the grade list (id + name), ordered by level ascending. No other data.
 */
export async function GET() {
  const school = await prisma.school.findFirst({ select: { id: true, name: true } });
  const grades = school
    ? await prisma.grade.findMany({
        where: { schoolId: school.id },
        select: { id: true, name: true },
        orderBy: { level: 'asc' },
      })
    : [];

  return NextResponse.json({ schoolName: school?.name ?? '', grades });
}
