import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

/**
 * TEMPORARY — applies PeriodAttendance performance indexes to production.
 * DELETE THIS FILE after use. Super Admin only.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user || user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const statements = [
    'CREATE INDEX IF NOT EXISTS "PeriodAttendance_sectionId_date_idx" ON "PeriodAttendance"("sectionId", "date")',
    'CREATE INDEX IF NOT EXISTS "PeriodAttendance_studentId_date_idx" ON "PeriodAttendance"("studentId", "date")',
    'CREATE INDEX IF NOT EXISTS "PeriodAttendance_markedById_date_idx" ON "PeriodAttendance"("markedById", "date")',
  ];
  const applied: string[] = [];
  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
    applied.push(sql);
  }
  return NextResponse.json({ ok: true, applied: applied.length });
}
