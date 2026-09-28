import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';
import { pktTime, todayPKT } from '@/lib/format';
import type { CheckInMethod } from '@prisma/client';

const METHODS: CheckInMethod[] = ['FINGERPRINT', 'FACE', 'RFID', 'MANUAL'];

/**
 * POST /api/attendance/gate/checkout { studentId, method? }
 * Records gate check-out. Requires a check-in for the same day; upserts so a
 * re-tap updates the time instead of erroring.
 */
export async function POST(req: Request) {
  const auth = await apiUser('attendance.gate');
  if (auth.error) return auth.error;

  let body: { studentId?: string; method?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { studentId, method } = body;
  if (!studentId || typeof studentId !== 'string') {
    return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
  }
  if (method && !METHODS.includes(method as CheckInMethod)) {
    return NextResponse.json({ error: `method must be one of ${METHODS.join(', ')}` }, { status: 400 });
  }

  const today = todayPKT();
  const checkIn = await prisma.gateCheckIn.findUnique({
    where: { studentId_date: { studentId, date: today } },
    include: { student: { select: { name: true } } },
  });
  if (!checkIn) {
    return NextResponse.json(
      { error: 'Cannot check out: no gate check-in recorded for this student today' },
      { status: 400 },
    );
  }

  const now = new Date();
  const out = await prisma.gateCheckOut.upsert({
    where: { studentId_date: { studentId, date: today } },
    create: {
      studentId,
      date: today,
      checkOutTime: now,
      method: (method as CheckInMethod) ?? checkIn.method,
      terminalId: checkIn.terminalId,
    },
    update: {
      checkOutTime: now,
      method: (method as CheckInMethod) ?? checkIn.method,
    },
  });

  return NextResponse.json({
    ok: true,
    checkOut: { date: today, checkOutDisplay: pktTime(out.checkOutTime) },
  });
}
