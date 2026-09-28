import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiPermission } from '@/lib/api-guard';

/** GET /api/academics/subjects — list subjects with usage counts. */
export async function GET() {
  const auth = await requireApiPermission('academics.view');
  if (auth instanceof NextResponse) return auth;

  const subjects = await prisma.subject.findMany({
    include: {
      _count: { select: { allocations: true, timetableSlots: true, examSchedules: true, periodAttendance: true } },
    },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({
    subjects: subjects.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      usage: s._count,
      deletable:
        s._count.allocations === 0 &&
        s._count.timetableSlots === 0 &&
        s._count.examSchedules === 0 &&
        s._count.periodAttendance === 0,
    })),
  });
}

/** POST /api/academics/subjects { name, code } */
export async function POST(req: Request) {
  const auth = await requireApiPermission('academics.manage');
  if (auth instanceof NextResponse) return auth;

  let body: { name?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const name = body.name?.trim();
  const code = body.code?.trim().toUpperCase();
  if (!name || !code) return NextResponse.json({ error: 'Name and code are required' }, { status: 400 });

  const school = await prisma.school.findFirst();
  if (!school) return NextResponse.json({ error: 'School not configured' }, { status: 500 });
  const dup = await prisma.subject.findFirst({ where: { schoolId: school.id, code } });
  if (dup) return NextResponse.json({ error: `A subject with code "${code}" already exists` }, { status: 409 });

  const subject = await prisma.subject.create({ data: { schoolId: school.id, name, code } });
  return NextResponse.json({ subject }, { status: 201 });
}
