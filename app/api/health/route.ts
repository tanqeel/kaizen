import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/** Module-load fingerprint: same value across requests = warm instance reuse. */
const INSTANCE_ID = Math.random().toString(36).slice(2, 10);
const STARTED_AT = Date.now();

/**
 * Lightweight keep-warm endpoint. Hit every few minutes by a cron so the
 * serverless function stays warm and the Neon Postgres compute (free tier,
 * scales to zero after ~5 min idle) doesn't go cold between user clicks.
 * No auth — it only checks DB reachability and reveals nothing.
 */
export async function GET() {
  const t0 = performance.now();
  try {
    await prisma.school.findFirst({ select: { id: true } });
    const dbMs = Math.round(performance.now() - t0);
    // Shape-only check of the connection string (never the value itself).
    const url = process.env.DATABASE_URL ?? '';
    return NextResponse.json({
      ok: true,
      instance: INSTANCE_ID,
      uptimeSec: Math.round((Date.now() - STARTED_AT) / 1000),
      dbMs,
      pooled: url.includes('pooler') || url.includes('pgbouncer'),
    });
  } catch {
    return NextResponse.json({ ok: false, instance: INSTANCE_ID }, { status: 503 });
  }
}
