import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getDashboardSummary } from '@/lib/dashboard';

/**
 * Temporary performance probe: breaks down server-side time for the
 * dashboard page (session lookup vs summary queries vs overhead).
 * Remove once the latency work is done.
 */
export async function GET() {
  const t0 = performance.now();
  const user = await getSessionUser();
  const t1 = performance.now();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const summary = await getDashboardSummary(user);
  const t2 = performance.now();
  return NextResponse.json({
    sessionMs: Math.round(t1 - t0),
    summaryMs: Math.round(t2 - t1),
    totalMs: Math.round(t2 - t0),
    summaryKeys: Object.keys(summary ?? {}),
  });
}
