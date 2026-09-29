import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * POST /api/register — public self-registration request.
 * Creates a PENDING RegistrationRequest. No account is activated until
 * an admin/principal approves it.
 * Body: { fullName, accountType, phone, email?, admissionNo?, gradeId?,
 *         sectionId?, guardianName?, guardianPhone?, notes? }
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const fullName = String(body.fullName ?? '').trim();
  const accountType = String(body.accountType ?? '').toUpperCase();
  const phone = String(body.phone ?? '').trim();

  if (!fullName || !phone) {
    return NextResponse.json({ error: 'Full name and phone are required.' }, { status: 400 });
  }
  if (!['PARENT', 'STUDENT', 'TEACHER', 'STAFF'].includes(accountType)) {
    return NextResponse.json(
      { error: 'accountType must be PARENT, STUDENT, TEACHER, or STAFF.' },
      { status: 400 },
    );
  }

  const school = await prisma.school.findFirst({ select: { id: true } });
  if (!school) return NextResponse.json({ error: 'No school configured.' }, { status: 400 });

  // Prevent duplicate pending requests for the same phone.
  const existing = await prisma.registrationRequest.findFirst({
    where: { schoolId: school.id, phone, status: 'PENDING' },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: 'A pending registration request already exists for this phone number.' },
      { status: 409 },
    );
  }

  const gradeId = String(body.gradeId ?? '').trim() || null;
  const sectionId = String(body.sectionId ?? '').trim() || null;

  const request = await prisma.registrationRequest.create({
    data: {
      schoolId: school.id,
      fullName,
      accountType: accountType as 'PARENT' | 'STUDENT' | 'TEACHER' | 'STAFF',
      phone,
      email: String(body.email ?? '').trim().toLowerCase() || null,
      admissionNo: String(body.admissionNo ?? '').trim() || null,
      gradeId,
      sectionId,
      guardianName: String(body.guardianName ?? '').trim() || null,
      guardianPhone: String(body.guardianPhone ?? '').trim() || null,
      notes: String(body.notes ?? '').trim() || null,
      status: 'PENDING',
    },
  });

  return NextResponse.json({
    ok: true,
    requestId: request.id,
    message: 'Registration request submitted. It is pending admin approval.',
  });
}
