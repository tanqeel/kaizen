import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser, schoolIdOr400 } from '@/lib/api-auth';
import { Prisma } from '@prisma/client';

const MAX_NO_ATTEMPTS = 5;

/**
 * POST /api/admissions/[id] — decide an application (admissions.manage).
 * Body: { action: 'approve' | 'reject' }.
 *
 * Approve enrols the applicant: find-or-create Parent by phone, create the
 * Student (admission number KZN-<yyyy>-<seq>), link them, and mark the
 * application APPROVED. No User login is created. Reject marks REJECTED.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('admissions.manage');
  if (auth.error) return auth.error;
  const { user } = auth;
  const school = await schoolIdOr400();
  if ('error' in school) return school.error;

  const { id } = await params;
  const application = await prisma.admissionApplication.findFirst({
    where: { id, schoolId: school.schoolId },
  });
  if (!application) {
    return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
  }
  if (application.status !== 'PENDING') {
    return NextResponse.json({ error: 'Application has already been decided.' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const action = body.action;
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'Action must be approve or reject.' }, { status: 400 });
  }

  if (action === 'reject') {
    await prisma.admissionApplication.update({
      where: { id },
      data: { status: 'REJECTED', decidedById: user.id, decidedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  // approve — validate enrolment prerequisites before the transaction
  const [section, shift, session] = await Promise.all([
    prisma.section.findFirst({
      where: { gradeId: application.gradeId },
      select: { id: true },
      orderBy: { name: 'asc' },
    }),
    prisma.shift.findFirst({
      where: { schoolId: school.schoolId },
      select: { id: true },
      orderBy: { name: 'asc' },
    }),
    prisma.academicSession.findFirst({
      where: { schoolId: school.schoolId, isCurrent: true },
      select: { id: true },
    }),
  ]);
  if (!section) {
    return NextResponse.json({ error: 'The selected grade has no sections. Add a section first.' }, { status: 400 });
  }
  if (!shift) {
    return NextResponse.json({ error: 'No shift configured. Add a shift first.' }, { status: 400 });
  }
  if (!session) {
    return NextResponse.json({ error: 'No current academic session. Set one first.' }, { status: 400 });
  }

  const year = new Date().getFullYear();

  for (let attempt = 0; attempt < MAX_NO_ATTEMPTS; attempt++) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const seq = (await tx.student.count()) + 1;
        const admissionNo = `KZN-${year}-${String(seq).padStart(4, '0')}`;

        let parent = await tx.parent.findFirst({
          where: { phone: application.parentPhone },
          select: { id: true },
        });
        if (!parent) {
          parent = await tx.parent.create({
            data: {
              name: application.parentName,
              phone: application.parentPhone,
              address: application.address,
            },
            select: { id: true },
          });
        }

        const student = await tx.student.create({
          data: {
            admissionNo,
            name: application.name,
            dob: application.dob,
            gender: application.gender,
            gradeId: application.gradeId,
            sectionId: section.id,
            shiftId: shift.id,
            sessionId: session.id,
            address: application.address,
            isActive: true,
          },
          select: { id: true },
        });

        await tx.studentParent.create({
          data: { studentId: student.id, parentId: parent.id },
        });

        await tx.admissionApplication.update({
          where: { id },
          data: { status: 'APPROVED', decidedById: user.id, decidedAt: new Date() },
        });

        return admissionNo;
      });

      return NextResponse.json({ ok: true, admissionNo: result });
    } catch (err) {
      // Admission-number race: another enrolment claimed the same number.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        attempt < MAX_NO_ATTEMPTS - 1
      ) {
        continue;
      }
      throw err;
    }
  }

  return NextResponse.json(
    { error: 'Could not generate a unique admission number. Please try again.' },
    { status: 500 },
  );
}
