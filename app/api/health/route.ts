import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Lightweight keep-warm endpoint. Hit every few minutes by a cron so the
 * serverless function stays warm and the Neon Postgres compute (free tier,
 * scales to zero after ~5 min idle) doesn't go cold between user clicks.
 * No auth — it only checks DB reachability and reveals nothing.
 */
export async function GET() {
  try {
    await prisma.school.findFirst({ select: { id: true } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
