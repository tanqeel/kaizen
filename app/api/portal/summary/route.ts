import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getPortalSummary, PortalError } from '@/lib/portal';

/** GET /api/portal/summary?studentId= — parent portal data, strictly scoped. */
export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  try {
    const summary = await getPortalSummary(
      { id: user.id, role: user.role },
      searchParams.get('studentId') ?? undefined,
    );
    return NextResponse.json(summary);
  } catch (e) {
    if (e instanceof PortalError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
