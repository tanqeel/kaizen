import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser, schoolIdOr400 } from '@/lib/api-auth';

/**
 * GET /api/lookup/students?q — student search for pickers across modules.
 * Returns id, name, admissionNo, grade/section labels. Limited to 20 rows.
 * Permitted to any role that can see fee/comms/biometric/student views.
 */
export async function GET(req: Request) {
  const auth = await apiUser(['finance.view', 'comms.manage', 'biometric.use', 'students.view']);
  if (auth.error) return auth.error;

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ students: [] });

  const students = await prisma.student.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: q } },
        { admissionNo: { contains: q } },
      ],
    },
    include: { grade: { select: { name: true } }, section: { select: { name: true } } },
    orderBy: { name: 'asc' },
    take: 20,
  });

  return NextResponse.json({
    students: students.map((s) => ({
      id: s.id,
      name: s.name,
      admissionNo: s.admissionNo,
      grade: s.grade.name,
      section: s.section.name,
    })),
  });
}
