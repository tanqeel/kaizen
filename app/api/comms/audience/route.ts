import { NextResponse } from 'next/server';
import { apiUser } from '@/lib/api-auth';
import { ANNOUNCEMENT_AUDIENCES, AUDIENCE_LABELS, resolveRecipients } from '@/lib/comms';
import type { AnnouncementAudience } from '@prisma/client';

/**
 * GET /api/comms/audience?audience&gradeId
 * Honest recipient count for the announcement preview-before-send step.
 */
export async function GET(req: Request) {
  const auth = await apiUser('comms.manage');
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const audience = url.searchParams.get('audience') as AnnouncementAudience | null;
  const gradeId = url.searchParams.get('gradeId');

  if (!audience || !ANNOUNCEMENT_AUDIENCES.includes(audience)) {
    return NextResponse.json({ error: 'Invalid audience' }, { status: 400 });
  }
  if (audience === 'GRADES' && !gradeId) {
    return NextResponse.json({ error: 'gradeId is required for the GRADES audience' }, { status: 400 });
  }

  const recipients = await resolveRecipients(audience, gradeId);
  const uniqueUsers = new Set(recipients.map((r) => r.userId).filter(Boolean)).size;

  return NextResponse.json({
    audience,
    count: uniqueUsers,
    label: AUDIENCE_LABELS[audience],
  });
}
