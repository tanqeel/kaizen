import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { todayPKT } from '@/lib/format';

/** TEMPORARY — times portal queries. DELETE AFTER USE. Super Admin only. */
export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const t: Record<string, number> = {};
  const time = async (name: string, fn: () => Promise<unknown>) => {
    const s = Date.now();
    await fn();
    t[name] = Date.now() - s;
  };
  const today = todayPKT();
  const studentId = 'cmulvw4r5000a3l04k5z8d3m9'; // placeholder, replaced below

  // Get a real student id first
  const s0 = Date.now();
  const st = await prisma.student.findFirst({ select: { id: true, sectionId: true, gradeId: true } });
  t['student.findFirst'] = Date.now() - s0;
  if (!st) return NextResponse.json({ error: 'no student' });
  const sid = st.id;

  await time('gateCheckIn.findUnique', () =>
    prisma.gateCheckIn.findUnique({ where: { studentId_date: { studentId: sid, date: today } } }));
  await time('student.findUnique+basic', () =>
    prisma.student.findUnique({ where: { id: sid } }));
  await time('feeVoucher.findMany+payments', () =>
    prisma.feeVoucher.findMany({ where: { studentId: sid }, include: { payments: true } }));
  await time('examResult.findMany+deep', () =>
    prisma.examResult.findMany({
      where: { studentId: sid },
      include: { examSchedule: { include: { subject: true, examTerm: true } } },
    }));
  await time('periodAttendance.count', () =>
    prisma.periodAttendance.count({ where: { studentId: sid, date: today } }));
  await time('periodAttendance.findFirst-desc', () =>
    prisma.periodAttendance.findFirst({ where: { sectionId: st.sectionId }, orderBy: { date: 'desc' }, select: { date: true } }));
  await time('timetableSlot.count', () =>
    prisma.timetableSlot.count({ where: { sectionId: st.sectionId } }));
  await time('diaryEntry.findMany', () =>
    prisma.diaryEntry.findMany({ where: { sectionId: st.sectionId }, take: 10 }));
  await time('announcement.findMany', () =>
    prisma.announcement.findMany({ take: 5 }));

  void studentId;
  return NextResponse.json({ timings_ms: t });
}
