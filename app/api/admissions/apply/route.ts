import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const PHONE_RE = /^[0-9+\-\s]{10,15}$/;
const MAX_PER_HOUR = 5;
const WINDOW_MS = 60 * 60 * 1000;

/** Module-level IP rate-limit bucket: ip -> timestamps of recent submissions. */
const buckets = new Map<string, number[]>();

function rateLimited(req: Request): boolean {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const now = Date.now();
  const hits = (buckets.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_HOUR) {
    buckets.set(ip, hits);
    return true;
  }
  hits.push(now);
  buckets.set(ip, hits);
  return false;
}

/**
 * POST /api/admissions/apply — PUBLIC (no auth).
 * Accepts an admission application. Honeypot field `website` silently
 * succeeds without creating anything so bots can't probe the guard.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Honeypot: bots fill it, humans never see it. Fake success, no reveal.
  if (typeof body.website === 'string' && body.website.length > 0) {
    return NextResponse.json({ ok: true });
  }

  if (rateLimited(req)) {
    return NextResponse.json({ error: 'Too many applications. Please try again later.' }, { status: 429 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const parentName = typeof body.parentName === 'string' ? body.parentName.trim() : '';
  const parentPhone = typeof body.parentPhone === 'string' ? body.parentPhone.trim() : '';
  const gradeId = typeof body.gradeId === 'string' ? body.gradeId.trim() : '';
  const gender = typeof body.gender === 'string' && body.gender.trim() ? body.gender.trim() : null;
  const address = typeof body.address === 'string' && body.address.trim() ? body.address.trim() : null;

  if (!name || !parentName || !parentPhone || !gradeId) {
    return NextResponse.json(
      { error: 'Name, grade, parent name and parent phone are required.' },
      { status: 400 },
    );
  }
  if (!PHONE_RE.test(parentPhone)) {
    return NextResponse.json({ error: 'Parent phone number looks invalid.' }, { status: 400 });
  }

  let dob: Date | null = null;
  if (body.dob != null && body.dob !== '') {
    if (typeof body.dob !== 'string') {
      return NextResponse.json({ error: 'Date of birth is invalid.' }, { status: 400 });
    }
    const parsed = new Date(body.dob);
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() >= Date.now()) {
      return NextResponse.json({ error: 'Date of birth must be a valid past date.' }, { status: 400 });
    }
    dob = parsed;
  }

  const school = await prisma.school.findFirst({ select: { id: true } });
  if (!school) {
    return NextResponse.json({ error: 'No school configured' }, { status: 400 });
  }

  const grade = await prisma.grade.findFirst({
    where: { id: gradeId, schoolId: school.id },
    select: { id: true },
  });
  if (!grade) {
    return NextResponse.json({ error: 'Selected grade is not valid.' }, { status: 400 });
  }

  await prisma.admissionApplication.create({
    data: {
      schoolId: school.id,
      name,
      dob,
      gender,
      gradeId: grade.id,
      parentName,
      parentPhone,
      address,
      status: 'PENDING',
    },
  });

  return NextResponse.json({ ok: true });
}
