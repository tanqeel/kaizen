import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/** Minimal liveness check: verifies DB reachability, reveals nothing else. */
export async function GET() {
  try {
    await prisma.school.findFirst({ select: { id: true } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
