import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';
import { hashPassword } from '@/lib/password';

/**
 * POST /api/staff — create a teacher or staff member with login account.
 * Body: { kind: 'TEACHER'|'STAFF', name, email, password, phone, cnic?, hireDate?,
 *         salaryMonthly, designation? (for STAFF) }
 * Creates the User + Teacher/StaffMember records. staff.manage only.
 */
export async function POST(req: Request) {
  const auth = await apiUser('staff.manage');
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const kind = String(body.kind ?? '').toUpperCase();
  if (kind !== 'TEACHER' && kind !== 'STAFF') {
    return NextResponse.json({ error: 'kind must be TEACHER or STAFF.' }, { status: 400 });
  }

  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const phone = String(body.phone ?? '').trim();
  const salaryMonthly = Number(body.salaryMonthly ?? 0);

  if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }
  if (!phone) return NextResponse.json({ error: 'Phone is required.' }, { status: 400 });
  if (!Number.isFinite(salaryMonthly) || salaryMonthly < 0) {
    return NextResponse.json({ error: 'Monthly salary must be a non-negative number.' }, { status: 400 });
  }
  const designation = String(body.designation ?? '').trim();
  if (kind === 'STAFF' && !designation) {
    return NextResponse.json({ error: 'Designation is required for staff.' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 });

  const hireDateRaw = String(body.hireDate ?? '').trim();
  let hireDate = new Date();
  if (hireDateRaw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(hireDateRaw)) {
      return NextResponse.json({ error: 'Hire date must be YYYY-MM-DD.' }, { status: 400 });
    }
    hireDate = new Date(hireDateRaw + 'T00:00:00');
    if (Number.isNaN(hireDate.getTime())) {
      return NextResponse.json({ error: 'Hire date is invalid.' }, { status: 400 });
    }
  }

  // Employee ID: EMP-XXX sequence.
  const lastEmp = await prisma.$queryRaw<Array<{ employeeId: string }>>`
    SELECT "employeeId" FROM (
      SELECT "employeeId" FROM "Teacher" UNION ALL SELECT "employeeId" FROM "StaffMember"
    ) t ORDER BY "employeeId" DESC LIMIT 1
  `;
  const lastNum = lastEmp[0] ? parseInt(lastEmp[0].employeeId.replace(/\D/g, ''), 10) || 0 : 0;
  const employeeId = `EMP-${String(lastNum + 1).padStart(3, '0')}`;

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: hashPassword(password),
      role: kind,
      phone,
      cnic: String(body.cnic ?? '').trim() || null,
      isActive: true,
    },
  });

  if (kind === 'TEACHER') {
    await prisma.teacher.create({
      data: {
        userId: user.id,
        employeeId,
        phone,
        cnic: String(body.cnic ?? '').trim() || null,
        hireDate,
        salaryMonthly: Math.round(salaryMonthly),
        isActive: true,
      },
    });
  } else {
    await prisma.staffMember.create({
      data: {
        userId: user.id,
        employeeId,
        designation,
        phone,
        cnic: String(body.cnic ?? '').trim() || null,
        hireDate,
        salaryMonthly: Math.round(salaryMonthly),
        isActive: true,
      },
    });
  }

  return NextResponse.json({ ok: true, employeeId, email }, { status: 201 });
}
