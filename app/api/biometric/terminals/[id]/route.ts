import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser, schoolIdOr400 } from '@/lib/api-auth';

/** PUT /api/biometric/terminals/[id] { name?, ipAddress?, port? } — edit terminal config. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('biometric.manage');
  if (auth.error) return auth.error;
  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  const { id } = await params;
  const existing = await prisma.biometricTerminal.findFirst({
    where: { id, schoolId: sres.schoolId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Terminal not found' }, { status: 404 });

  let body: { name?: string; ipAddress?: string; port?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const updates: { name?: string; ipAddress?: string; port?: number } = {};
  if (body.name !== undefined) {
    if (!body.name.trim()) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
    updates.name = body.name.trim().slice(0, 80);
  }
  if (body.ipAddress !== undefined) {
    const ip = body.ipAddress.trim();
    if (!ip || !/^[\d.:a-fA-F]+$/.test(ip)) {
      return NextResponse.json({ error: 'ipAddress looks invalid' }, { status: 400 });
    }
    updates.ipAddress = ip;
  }
  if (body.port !== undefined) {
    const port = Number(body.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return NextResponse.json({ error: 'port must be 1–65535' }, { status: 400 });
    }
    updates.port = port;
  }

  const terminal = await prisma.biometricTerminal.update({
    where: { id },
    data: updates,
    select: { id: true, name: true, ipAddress: true, port: true, status: true, lastHeartbeat: true },
  });
  return NextResponse.json({
    ok: true,
    terminal: { ...terminal, lastHeartbeat: terminal.lastHeartbeat?.toISOString() ?? null },
  });
}
