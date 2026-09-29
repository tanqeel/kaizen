import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';
import { hashPassword } from '@/lib/password';
import { generateKaizenId } from '@/lib/kaizen-id';
import { auditLog } from '@/lib/audit';

/**
 * POST /api/registrations/[id]/decide — approve or reject a registration request.
 * Body: { decision: 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUIRED', tempPassword? }
 * On approval: creates the User with a unique KAIZEN ID (status ACTIVE).
 * The temp password is hashed immediately and never stored or returned in plaintext
 * beyond this single response — the admin must share it securely out-of-band.
 * Principal / Super Admin only.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('users.manage');
  if (auth.error) return auth.error;

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const decision = String(body.decision ?? '').toUpperCase();
  if (!['APPROVED', 'REJECTED', 'CORRECTION_REQUIRED'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision.' }, { status: 400 });
  }

  const request = await prisma.registrationRequest.findUnique({ where: { id } });
  if (!request) return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
  if (request.status !== 'PENDING' && request.status !== 'CORRECTION_REQUIRED') {
    return NextResponse.json({ error: 'Request has already been decided.' }, { status: 409 });
  }

  const school = await prisma.school.findFirst({ select: { id: true } });

  if (decision !== 'APPROVED') {
    await prisma.registrationRequest.update({
      where: { id },
      data: { status: decision, decidedById: auth.user.id, decidedAt: new Date() },
    });
    if (school) {
      await auditLog({
        schoolId: school.id,
        actorId: auth.user.id,
        action: 'REGISTRATION_DECIDED',
        targetType: 'RegistrationRequest',
        targetId: id,
        detail: `Registration ${decision.toLowerCase()}: ${request.fullName}`,
      });
    }
    return NextResponse.json({ ok: true, decision });
  }

  // APPROVED — create the user account.
  const tempPassword = String(body.tempPassword ?? '').trim();
  if (tempPassword.length < 8) {
    return NextResponse.json(
      { error: 'A temporary password of at least 8 characters is required to approve.' },
      { status: 400 },
    );
  }
  const email = request.email || `${request.phone.replace(/\D/g, '')}@kaizen.local`;
  const emailTaken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (emailTaken) {
    return NextResponse.json({ error: 'An account with this email/phone already exists.' }, { status: 409 });
  }

  const kaizenId = await generateKaizenId(request.accountType);
  const user = await prisma.user.create({
    data: {
      kaizenId,
      name: request.fullName,
      email,
      passwordHash: hashPassword(tempPassword),
      role: request.accountType,
      phone: request.phone,
      isActive: true,
      status: 'ACTIVE',
      forcePasswordReset: true, // Must set their own password on first login.
    },
  });

  await prisma.registrationRequest.update({
    where: { id },
    data: {
      status: 'APPROVED',
      decidedById: auth.user.id,
      decidedAt: new Date(),
      createdUserId: user.id,
    },
  });

  if (school) {
    await auditLog({
      schoolId: school.id,
      actorId: auth.user.id,
      action: 'REGISTRATION_APPROVED',
      targetType: 'User',
      targetId: user.id,
      detail: `Approved ${request.fullName}; KAIZEN ID ${kaizenId}`,
    });
  }

  // The temp password is returned ONCE so the admin can share it securely.
  // It is never stored in plaintext anywhere.
  return NextResponse.json({
    ok: true,
    decision: 'APPROVED',
    kaizenId,
    tempPassword,
    message: 'Share the KAIZEN ID and temporary password with the user securely. They must change it on first login.',
  });
}
