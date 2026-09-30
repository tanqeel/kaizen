import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUserStrict as apiUser, schoolIdOr400 } from '@/lib/api-auth';
import { can } from '@/lib/rbac';
import { createManyCompat } from '@/lib/prisma-batch';

export interface PayslipRow {
  id: string;
  month: number;
  year: number;
  baseSalary: number;
  allowances: number;
  deductions: number;
  netPay: number;
  status: 'DRAFT' | 'GENERATED' | 'PAID';
  paidAt: string | null;
  createdAt: string;
  person: { name: string; role: 'Teacher' | 'Staff'; employeeId: string | null };
}

function parseIntParam(v: string | null, min: number, max: number): number | null {
  if (v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

function toRow(p: {
  id: string;
  month: number;
  year: number;
  baseSalary: number;
  allowances: number;
  deductions: number;
  netPay: number;
  status: 'DRAFT' | 'GENERATED' | 'PAID';
  paidAt: Date | null;
  createdAt: Date;
  teacher: { employeeId: string; user: { name: string } | null } | null;
  staffMember: { employeeId: string; designation: string; user: { name: string } | null } | null;
}): PayslipRow {
  const isTeacher = !!p.teacher;
  const person = isTeacher ? p.teacher! : p.staffMember!;
  return {
    id: p.id,
    month: p.month,
    year: p.year,
    baseSalary: p.baseSalary,
    allowances: p.allowances,
    deductions: p.deductions,
    netPay: p.netPay,
    status: p.status,
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    person: {
      name: person.user?.name ?? person.employeeId,
      role: isTeacher ? 'Teacher' : 'Staff',
      employeeId: person.employeeId,
    },
  };
}

/**
 * GET /api/payroll?month=&year=
 * Lists payslips. payroll.manage sees all; everyone else (teachers/staff)
 * sees only their own payslip.
 */
export async function GET(req: Request) {
  const auth = await apiUser('payroll.view');
  if (auth.error) return auth.error;
  const { user } = auth;

  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;
  const { schoolId } = sres;

  const url = new URL(req.url);
  const monthRaw = url.searchParams.get('month');
  const yearRaw = url.searchParams.get('year');
  if (monthRaw && parseIntParam(monthRaw, 1, 12) === null) {
    return NextResponse.json({ error: 'month must be an integer 1–12' }, { status: 400 });
  }
  if (yearRaw && parseIntParam(yearRaw, 2000, 2100) === null) {
    return NextResponse.json({ error: 'year must be an integer 2000–2100' }, { status: 400 });
  }
  const month = parseIntParam(monthRaw, 1, 12);
  const year = parseIntParam(yearRaw, 2000, 2100);

  const where: {
    schoolId: string;
    month?: number;
    year?: number;
    teacherId?: string;
    staffMemberId?: string;
  } = { schoolId };
  if (month) where.month = month;
  if (year) where.year = year;

  if (!can(user.role, 'payroll.manage')) {
    // Teachers/staff see only their own payslip.
    const [teacher, staffMember] = await Promise.all([
      prisma.teacher.findUnique({ where: { userId: user.id }, select: { id: true } }),
      prisma.staffMember.findUnique({ where: { userId: user.id }, select: { id: true } }),
    ]);
    if (teacher) where.teacherId = teacher.id;
    else if (staffMember) where.staffMemberId = staffMember.id;
    else return NextResponse.json({ payslips: [] as PayslipRow[] });
  }

  const payslips = await prisma.payslip.findMany({
    where,
    include: {
      teacher: { select: { employeeId: true, user: { select: { name: true } } } },
      staffMember: { select: { employeeId: true, designation: true, user: { select: { name: true } } } },
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
    take: 500,
  });

  return NextResponse.json({ payslips: payslips.map(toRow) });
}

/**
 * POST /api/payroll { month, year }
 * Generates payslips for all active teachers + staff members missing one
 * for that month/year. payroll.manage only. Idempotent per person+period.
 */
export async function POST(req: Request) {
  const auth = await apiUser('payroll.manage');
  if (auth.error) return auth.error;
  const { user } = auth;

  let body: { month?: unknown; year?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const month = parseIntParam(String(body.month ?? ''), 1, 12);
  const year = parseIntParam(String(body.year ?? ''), 2000, 2100);
  if (month === null) return NextResponse.json({ error: 'month must be an integer 1–12' }, { status: 400 });
  if (year === null) return NextResponse.json({ error: 'year must be an integer 2000–2100' }, { status: 400 });

  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;
  const { schoolId } = sres;

  const [teachers, staffMembers] = await Promise.all([
    prisma.teacher.findMany({ where: { isActive: true }, select: { id: true, salaryMonthly: true } }),
    prisma.staffMember.findMany({ where: { isActive: true }, select: { id: true, salaryMonthly: true } }),
  ]);

  // Find existing payslips for this period first — nullable teacherId/staffMemberId
  // weaken unique indexes, so duplicate protection is enforced here in code.
  const existing = await prisma.payslip.findMany({
    where: { schoolId, month, year },
    select: { teacherId: true, staffMemberId: true },
  });
  const hasTeacher = new Set(existing.map((e) => e.teacherId).filter((x): x is string => !!x));
  const hasStaff = new Set(existing.map((e) => e.staffMemberId).filter((x): x is string => !!x));

  const missingTeachers = teachers.filter((t) => !hasTeacher.has(t.id));
  const missingStaff = staffMembers.filter((s) => !hasStaff.has(s.id));

  const rows = [
    ...missingTeachers.map((t) => ({
      schoolId,
      teacherId: t.id,
      month,
      year,
      baseSalary: t.salaryMonthly ?? 0,
      allowances: 0,
      deductions: 0,
      netPay: t.salaryMonthly ?? 0,
      status: 'GENERATED' as const,
      generatedById: user.id,
    })),
    ...missingStaff.map((s) => ({
      schoolId,
      staffMemberId: s.id,
      month,
      year,
      baseSalary: s.salaryMonthly ?? 0,
      allowances: 0,
      deductions: 0,
      netPay: s.salaryMonthly ?? 0,
      status: 'GENERATED' as const,
      generatedById: user.id,
    })),
  ];
  if (rows.length > 0) {
    // NOTE: prisma.createMany throws "Transactions are not supported in HTTP
    // mode" on the Neon HTTP driver — insert individually in chunks instead.
    await createManyCompat((data) => prisma.payslip.create({ data }), rows);
  }

  const skipped = hasTeacher.size + hasStaff.size;
  return NextResponse.json({ created: rows.length, skipped });
}
