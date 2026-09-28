import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';
import { todayPKT } from '@/lib/format';

export interface StudentRow {
  id: string;
  admissionNo: string;
  name: string;
  grade: string;
  section: string;
  parentPhone: string | null;
  gateToday: 'IN' | 'OUT' | '—';
}

/**
 * GET /api/students?q=&gradeId=&sectionId= — students directory listing.
 * q matches name or admission number. gateToday reflects today's gate
 * check-in / check-out status (never invented).
 */
export async function GET(req: Request) {
  const auth = await apiUser('students.view');
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const gradeId = url.searchParams.get('gradeId')?.trim() ?? '';
  const sectionId = url.searchParams.get('sectionId')?.trim() ?? '';
  const today = todayPKT();

  const students = await prisma.student.findMany({
    where: {
      isActive: true,
      ...(gradeId ? { gradeId } : {}),
      ...(sectionId ? { sectionId } : {}),
      ...(q
        ? { OR: [{ name: { contains: q } }, { admissionNo: { contains: q } }] }
        : {}),
    },
    include: {
      grade: { select: { name: true } },
      section: { select: { name: true } },
      parents: { select: { parent: { select: { phone: true } } } },
    },
    orderBy: [{ grade: { level: 'asc' } }, { section: { name: 'asc' } }, { name: 'asc' }],
    take: 200,
  });

  const ids = students.map((s) => s.id);
  const [ins, outs] = await Promise.all([
    prisma.gateCheckIn.findMany({ where: { date: today, studentId: { in: ids } }, select: { studentId: true } }),
    prisma.gateCheckOut.findMany({ where: { date: today, studentId: { in: ids } }, select: { studentId: true } }),
  ]);
  const inSet = new Set(ins.map((r) => r.studentId));
  const outSet = new Set(outs.map((r) => r.studentId));

  const rows: StudentRow[] = students.map((s) => ({
    id: s.id,
    admissionNo: s.admissionNo,
    name: s.name,
    grade: s.grade.name,
    section: s.section.name,
    parentPhone: s.parents[0]?.parent.phone ?? null,
    gateToday: outSet.has(s.id) ? 'OUT' : inSet.has(s.id) ? 'IN' : '—',
  }));

  return NextResponse.json({ students: rows, total: rows.length, date: today });
}
