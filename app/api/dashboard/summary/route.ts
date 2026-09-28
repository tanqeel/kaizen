import { NextResponse } from 'next/server';
import { apiUser } from '@/lib/api-auth';
import { getDashboardSummary } from '@/lib/dashboard';

/** GET /api/dashboard/summary — role-shaped dashboard JSON. */
export async function GET() {
  const auth = await apiUser('dashboard.view');
  if (auth.error) return auth.error;
  const summary = await getDashboardSummary(auth.user);
  return NextResponse.json(summary);
}
