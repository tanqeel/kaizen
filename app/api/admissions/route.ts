import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser, schoolIdOr400 } from '@/lib/api-auth';
import type { ApplicationStatus } from '@prisma/client';

const VALID_STATUSES: ApplicationStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

/**
 * GET /api/admissions?status=PENDING|APPROVED|REJECTED — list admission
 * applications (default PENDING), newest first, capped at 200.
 */
export async function GET(req: Request) {
  const auth = await apiUser('admissions.view');
  if (auth.error) return auth.error;
  const school = await schoolIdOr400();
  if ('error' in school) return school.error;

  const url = new URL(req.url);
  const rawStatus = (url.searchParams.get('status') ?? 'PENDING').toUpperCase();
  const status: ApplicationStatus = VALID_STATUSES.includes(rawStatus as ApplicationStatus)
    ? (rawStatus as ApplicationStatus)
    : 'PENDING';

  const applications = await prisma.admissionApplication.findMany({
    where: { schoolId: school.schoolId, status },
    include: {
      grade: { select: { name: true } },
      decidedBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return NextResponse.json({
    status,
    applications: applications.map((a) => ({
      id: a.id,
      name: a.name,
      dob: a.dob,
      gender: a.gender,
      grade: a.grade.name,
      parentName: a.parentName,
      parentPhone: a.parentPhone,
      address: a.address,
      status: a.status,
      decidedBy: a.decidedBy?.name ?? null,
      decidedAt: a.decidedAt,
      createdAt: a.createdAt,
    })),
  });
}
