import { NextResponse } from 'next/server';
import { apiUser } from '@/lib/api-auth';
import { detectConflicts } from '@/lib/attendance';
import { todayPKT } from '@/lib/format';

/** POST /api/attendance/conflicts/rerun { date? } — re-run detection for a date. */
export async function POST(req: Request) {
  const auth = await apiUser('attendance.conflicts');
  if (auth.error) return auth.error;

  let date = todayPKT();
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) date = body.date;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const created = await detectConflicts(date);
  return NextResponse.json({ ok: true, date, created });
}
