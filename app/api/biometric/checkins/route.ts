import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser, schoolIdOr400 } from '@/lib/api-auth';
import { todayPKT } from '@/lib/format';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/biometric/checkins?date=YYYY-MM-DD
 * Gate check-ins for one PKT date (default: today), newest first —
 * powers the "today's scans" list on the biometric simulator page.
 */
export async function GET(req: Request) {
  const auth = await apiUser('biometric.use');
  if (auth.error) return auth.error;
  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  const dateParam = new URL(req.url).searchParams.get('date') ?? todayPKT();
  if (!DATE_RE.test(dateParam)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
  }

  const checkIns = await prisma.gateCheckIn.findMany({
    where: { date: dateParam, student: { grade: { schoolId: sres.schoolId } } },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          admissionNo: true,
          grade: { select: { name: true } },
          section: { select: { name: true } },
        },
      },
      terminal: { select: { name: true } },
    },
    orderBy: { checkInTime: 'desc' },
    take: 300,
  });

  return NextResponse.json({
    date: dateParam,
    count: checkIns.length,
    checkIns: checkIns.map((c) => ({
      id: c.id,
      checkInTime: c.checkInTime.toISOString(),
      method: c.method,
      student: c.student,
      terminalName: c.terminal?.name ?? null,
    })),
  });
}
