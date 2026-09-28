import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiPermission } from '@/lib/api-guard';

/** GET /api/exams/terms — exam terms with schedule/result counts. */
export async function GET() {
  const auth = await requireApiPermission('exams.view');
  if (auth instanceof NextResponse) return auth;

  const terms = await prisma.examTerm.findMany({
    include: {
      _count: { select: { schedules: true } },
      schedules: { include: { _count: { select: { results: true } } } },
    },
    orderBy: { startDate: 'desc' },
  });
  return NextResponse.json({
    terms: terms.map((t) => ({
      id: t.id,
      name: t.name,
      startDate: t.startDate.toISOString(),
      endDate: t.endDate.toISOString(),
      scheduleCount: t._count.schedules,
      resultCount: t.schedules.reduce((n, s) => n + s._count.results, 0),
      deletable: t._count.schedules === 0,
    })),
  });
}

/** POST /api/exams/terms { name, startDate, endDate } */
export async function POST(req: Request) {
  const auth = await requireApiPermission('exams.manage');
  if (auth instanceof NextResponse) return auth;

  let body: { name?: string; startDate?: string; endDate?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const name = body.name?.trim();
  const startDate = body.startDate ? new Date(body.startDate) : null;
  const endDate = body.endDate ? new Date(body.endDate) : null;
  if (!name) return NextResponse.json({ error: 'Term name is required' }, { status: 400 });
  if (!startDate || Number.isNaN(+startDate) || !endDate || Number.isNaN(+endDate)) {
    return NextResponse.json({ error: 'Valid start and end dates are required' }, { status: 400 });
  }
  if (startDate > endDate) {
    return NextResponse.json({ error: 'Start date must be on or before the end date' }, { status: 400 });
  }

  const session = await prisma.academicSession.findFirst({ where: { isCurrent: true } });
  if (!session) return NextResponse.json({ error: 'No current academic session' }, { status: 500 });

  const term = await prisma.examTerm.create({
    data: { sessionId: session.id, name, startDate, endDate },
  });
  return NextResponse.json({ term }, { status: 201 });
}
