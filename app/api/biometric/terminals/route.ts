import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser, schoolIdOr400 } from '@/lib/api-auth';

/**
 * GET /api/biometric/terminals — terminal list (name, ip:port, status, heartbeat).
 * POST /api/biometric/terminals { name, ipAddress, port? } — add a terminal.
 */
export async function GET() {
  const auth = await apiUser('biometric.use');
  if (auth.error) return auth.error;
  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  const terminals = await prisma.biometricTerminal.findMany({
    where: { schoolId: sres.schoolId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, ipAddress: true, port: true, status: true, lastHeartbeat: true },
  });
  return NextResponse.json({
    terminals: terminals.map((t) => ({
      ...t,
      lastHeartbeat: t.lastHeartbeat?.toISOString() ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const auth = await apiUser('biometric.manage');
  if (auth.error) return auth.error;
  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  let body: { name?: string; ipAddress?: string; port?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const name = body.name?.trim();
  const ipAddress = body.ipAddress?.trim();
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!ipAddress) return NextResponse.json({ error: 'ipAddress is required' }, { status: 400 });
  if (!/^[\d.:a-fA-F]+$/.test(ipAddress)) {
    return NextResponse.json({ error: 'ipAddress looks invalid' }, { status: 400 });
  }
  const port = Number(body.port ?? 4370);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return NextResponse.json({ error: 'port must be 1–65535' }, { status: 400 });
  }

  const terminal = await prisma.biometricTerminal.create({
    data: { schoolId: sres.schoolId, name: name.slice(0, 80), ipAddress, port, status: 'OFFLINE' },
    select: { id: true, name: true, ipAddress: true, port: true, status: true, lastHeartbeat: true },
  });
  return NextResponse.json(
    { ok: true, terminal: { ...terminal, lastHeartbeat: terminal.lastHeartbeat?.toISOString() ?? null } },
    { status: 201 },
  );
}
