import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getPortalSummary, PortalError } from '@/lib/portal';

/** GET /api/portal/summary?studentId= — parent portal data, strictly scoped. */
export async function GET(req: Request) {
  const t0 = Date.now();
  const user = await requireUser();
  const t1 = Date.now();
  const { searchParams } = new URL(req.url);
  try {
    const summary = await getPortalSummary(
      { id: user.id, role: user.role },
      searchParams.get('studentId') ?? undefined,
    );
    const t2 = Date.now();
    // TEMP timing header — remove after diagnosis
    return NextResponse.json(summary, {
      headers: { 'X-Timing': `requireUser=${t1 - t0}ms,summary=${t2 - t1}ms,total=${t2 - t0}ms` },
    });
  } catch (e) {
    if (e instanceof PortalError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
