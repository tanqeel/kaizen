import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';
import { hashPassword } from '@/lib/password';
import { generateKaizenId } from '@/lib/kaizen-id';
import { auditLog } from '@/lib/audit';
import { createActivationToken } from '@/lib/activation';

/**
 * POST /api/registrations/[id]/decide — approve or reject a registration request.
 * Body: { decision: 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUIRED' }
 *
 * On approval: creates the User with a unique KAIZEN ID and a one-time
 * activation link. The user sets their OWN password via the link — the admin
 * never sees or sets any password. Principal / Super Admin only.
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

  // APPROVED — create the user account with an unusable password hash.
  // The user sets their real password via the one-time activation link.
  const email = request.email || `${request.phone.replace(/\D/g, '')}@kaizen.local`;
  const emailTaken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (emailTaken) {
    return NextResponse.json({ error: 'An account with this email/phone already exists.' }, { status: 409 });
  }

  const kaizenId = await generateKaizenId(request.accountType);
  // Random 32-byte hash — unusable as a password; replaced on activation.
  const placeholderHash = hashPassword(randomBytes(32).toString('hex'));

  const user = await prisma.user.create({
    data: {
      kaizenId,
      name: request.fullName,
      email,
      passwordHash: placeholderHash,
      role: request.accountType,
      phone: request.phone,
      isActive: true,
      status: 'PENDING', // Becomes ACTIVE when they set their password.
      forcePasswordReset: false,
    },
  });

  const { path: activationPath } = await createActivationToken(user.id, 'ACTIVATION');

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
      detail: `Approved ${request.fullName}; KAIZEN ID ${kaizenId}; activation link issued`,
    });
  }

  // Return the activation link ONCE. The admin shares it with the user;
  // the user sets their own password. No password is ever visible to anyone.
  return NextResponse.json({
    ok: true,
    decision: 'APPROVED',
    kaizenId,
    activationPath,
    message: 'Share the KAIZEN ID and activation link with the user. They will set their own private password.',
  });
}
