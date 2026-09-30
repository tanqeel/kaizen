import { NextResponse } from 'next/server';
import { CheckInMethod } from '@prisma/client';
import { prisma } from '@/lib/db';
import { apiUser, schoolIdOr400 } from '@/lib/api-auth';
import { todayPKT, pktTime } from '@/lib/format';
import { createManyCompat } from '@/lib/prisma-batch';

const METHODS = ['FINGERPRINT', 'FACE', 'RFID'] as const;
const METHOD_LABELS: Record<CheckInMethod, string> = {
  FINGERPRINT: 'Fingerprint',
  FACE: 'Face',
  RFID: 'RFID',
  MANUAL: 'Manual',
};

/**
 * POST /api/biometric/simulate { studentId, method, terminalId? }
 * Simulates a biometric scan: writes a REAL GateCheckIn row (date = today,
 * checkInTime = now) plus an ARRIVAL IN_APP notification to the parent.
 * A second scan for the same student on the same day is rejected honestly.
 */
export async function POST(req: Request) {
  const auth = await apiUser('biometric.use');
  if (auth.error) return auth.error;
  const { user } = auth;
  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  let body: { studentId?: string; method?: string; terminalId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const method = body.method as CheckInMethod | undefined;
  if (!method || !(METHODS as readonly string[]).includes(method)) {
    return NextResponse.json({ error: 'method must be FINGERPRINT, FACE, or RFID' }, { status: 400 });
  }
  if (!body.studentId) {
    return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
  }

  const student = await prisma.student.findFirst({
    where: { id: body.studentId, isActive: true },
    include: {
      parents: { include: { parent: { select: { userId: true, name: true } } } },
    },
  });
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  if (body.terminalId) {
    const terminal = await prisma.biometricTerminal.findFirst({
      where: { id: body.terminalId, schoolId: sres.schoolId },
      select: { id: true },
    });
    if (!terminal) return NextResponse.json({ error: 'Terminal not found' }, { status: 404 });
  }

  const date = todayPKT();
  const existing = await prisma.gateCheckIn.findUnique({
    where: { studentId_date: { studentId: student.id, date } },
    select: { id: true, checkInTime: true, method: true },
  });
  if (existing) {
    return NextResponse.json(
      {
        error: `${student.name} is already checked in today (at ${pktTime(existing.checkInTime)} via ${METHOD_LABELS[existing.method]}). Check-out or wait for tomorrow.`,
      },
      { status: 400 },
    );
  }

  const checkInTime = new Date();
  await prisma.gateCheckIn.create({
    data: {
      studentId: student.id,
      date,
      checkInTime,
      method,
      terminalId: body.terminalId ?? null,
      createdById: user.id,
    },
  });

  // ARRIVAL notification to every linked parent account (IN_APP, SENT).
  const parentUserIds = [...new Set(student.parents.map((p) => p.parent.userId).filter(Boolean))] as string[];
  if (parentUserIds.length > 0) {
    // NOTE: prisma.createMany throws "Transactions are not supported in HTTP
    // mode" on the Neon HTTP driver — insert individually in chunks instead.
    await createManyCompat(
      (data) => prisma.notificationLog.create({ data }),
      parentUserIds.map((userId) => ({
        userId,
        studentId: student.id,
        type: 'ARRIVAL' as const,
        channel: 'IN_APP' as const,
        message: `${student.name} checked in at ${pktTime(checkInTime)} via ${METHOD_LABELS[method]} (simulated scan).`,
        status: 'SENT' as const,
      })),
    );
  }

  return NextResponse.json({
    ok: true,
    student: { id: student.id, name: student.name, admissionNo: student.admissionNo },
    checkInTime: checkInTime.toISOString(),
    checkInTimeLabel: pktTime(checkInTime),
    method,
    methodLabel: METHOD_LABELS[method],
  });
}
