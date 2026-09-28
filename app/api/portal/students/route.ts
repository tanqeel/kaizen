import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/portal/students?q= — support picker for SUPER_ADMIN/PRINCIPAL
 * opening the parent portal for a specific child. Max 20 results.
 */
export async function GET(req: Request) {
  const user = await requireUser();
  // Only leadership opens the portal in support mode; parents use their own children.
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'PRINCIPAL') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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
    include: {
      grade: true,
      section: true,
      parents: { include: { parent: true } },
    },
    orderBy: { name: 'asc' },
    take: 20,
  });

  return NextResponse.json({
    students: students.map((s) => ({
      id: s.id,
      name: s.name,
      admissionNo: s.admissionNo,
      class: `${s.grade.name} - ${s.section.name}`,
      parents: s.parents.map((sp) => sp.parent.name).join(', '),
    })),
  });
}
