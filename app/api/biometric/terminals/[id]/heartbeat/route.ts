import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser, schoolIdOr400 } from '@/lib/api-auth';

/**
 * POST /api/biometric/terminals/[id]/heartbeat
 * Simulates the terminal phoning home: lastHeartbeat = now, status = ONLINE.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('biometric.use');
  if (auth.error) return auth.error;
  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  const { id } = await params;
  const existing = await prisma.biometricTerminal.findFirst({
    where: { id, schoolId: sres.schoolId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Terminal not found' }, { status: 404 });

  const terminal = await prisma.biometricTerminal.update({
    where: { id },
    data: { lastHeartbeat: new Date(), status: 'ONLINE' },
    select: { id: true, name: true, status: true, lastHeartbeat: true },
  });
  return NextResponse.json({
    ok: true,
    terminal: { ...terminal, lastHeartbeat: terminal.lastHeartbeat!.toISOString() },
  });
}
