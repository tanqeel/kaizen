import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';
import { todayPKT } from '@/lib/format';

export interface StudentRow {
  id: string;
  admissionNo: string;
  name: string;
  grade: string;
  section: string;
  parentPhone: string | null;
  gateToday: 'IN' | 'OUT' | '—';
}

/**
 * GET /api/students?q=&gradeId=&sectionId= — students directory listing.
 * q matches name or admission number. gateToday reflects today's gate
 * check-in / check-out status (never invented).
 */
export async function GET(req: Request) {
  const auth = await apiUser('students.view');
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const gradeId = url.searchParams.get('gradeId')?.trim() ?? '';
  const sectionId = url.searchParams.get('sectionId')?.trim() ?? '';
  const today = todayPKT();

  const students = await prisma.student.findMany({
    where: {
      isActive: true,
      ...(gradeId ? { gradeId } : {}),
      ...(sectionId ? { sectionId } : {}),
      ...(q
        ? { OR: [{ name: { contains: q } }, { admissionNo: { contains: q } }] }
        : {}),
    },
    include: {
      grade: { select: { name: true } },
      section: { select: { name: true } },
      parents: { select: { parent: { select: { phone: true } } } },
    },
    orderBy: [{ grade: { level: 'asc' } }, { section: { name: 'asc' } }, { name: 'asc' }],
    take: 200,
  });

  const ids = students.map((s) => s.id);
  const [ins, outs] = await Promise.all([
    prisma.gateCheckIn.findMany({ where: { date: today, studentId: { in: ids } }, select: { studentId: true } }),
    prisma.gateCheckOut.findMany({ where: { date: today, studentId: { in: ids } }, select: { studentId: true } }),
  ]);
  const inSet = new Set(ins.map((r) => r.studentId));
  const outSet = new Set(outs.map((r) => r.studentId));

  const rows: StudentRow[] = students.map((s) => ({
    id: s.id,
    admissionNo: s.admissionNo,
    name: s.name,
    grade: s.grade.name,
    section: s.section.name,
    parentPhone: s.parents[0]?.parent.phone ?? null,
    gateToday: outSet.has(s.id) ? 'OUT' : inSet.has(s.id) ? 'IN' : '—',
  }));

  return NextResponse.json({ students: rows, total: rows.length, date: today });
}

/**
 * POST /api/students — create a single student (admission).
 * Body: { name, gradeId, sectionId, shiftId, sessionId, dob?, gender?, bForm?, address?,
 *         admissionNo? (auto-generated if omitted), parentName?, parentPhone? }
 * Creates the student + optionally links/creates a parent user.
 * students.manage only.
 */
export async function POST(req: Request) {
  const auth = await apiUser('students.manage');
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const name = String(body.name ?? '').trim();
  const gradeId = String(body.gradeId ?? '').trim();
  const sectionId = String(body.sectionId ?? '').trim();
  const shiftId = String(body.shiftId ?? '').trim();
  const sessionId = String(body.sessionId ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Student name is required.' }, { status: 400 });
  if (!gradeId || !sectionId || !shiftId || !sessionId) {
    return NextResponse.json({ error: 'Grade, section, shift and session are required.' }, { status: 400 });
  }

  // Validate the section belongs to the grade.
  const section = await prisma.section.findFirst({ where: { id: sectionId, gradeId } });
  if (!section) return NextResponse.json({ error: 'Section does not belong to the selected grade.' }, { status: 400 });

  // Admission number: use provided or auto-generate KZN-YY-XXXX.
  let admissionNo = String(body.admissionNo ?? '').trim().toUpperCase();
  if (admissionNo) {
    const exists = await prisma.student.findUnique({ where: { admissionNo } });
    if (exists) return NextResponse.json({ error: `Admission no "${admissionNo}" already exists.` }, { status: 409 });
  } else {
    const year = new Date().getFullYear().toString().slice(2);
    const prefix = `KZN-${year}-`;
    const last = await prisma.student.findFirst({
      where: { admissionNo: { startsWith: prefix } },
      orderBy: { admissionNo: 'desc' },
      select: { admissionNo: true },
    });
    const nextNum = last ? parseInt(last.admissionNo.slice(prefix.length), 10) + 1 : 1;
    admissionNo = `${prefix}${String(nextNum).padStart(4, '0')}`;
  }

  const dobRaw = String(body.dob ?? '').trim();
  let dob: Date | null = null;
  if (dobRaw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dobRaw)) {
      return NextResponse.json({ error: 'DOB must be YYYY-MM-DD.' }, { status: 400 });
    }
    dob = new Date(dobRaw + 'T00:00:00');
    if (Number.isNaN(dob.getTime()) || dob.getTime() > Date.now()) {
      return NextResponse.json({ error: 'DOB must be a valid past date.' }, { status: 400 });
    }
  }

  const gender = String(body.gender ?? '').trim() || null;
  const bForm = String(body.bForm ?? '').trim() || null;
  const address = String(body.address ?? '').trim() || null;
  const photoUrl = String(body.photoUrl ?? '').trim() || null;

  const student = await prisma.student.create({
    data: {
      admissionNo,
      name,
      dob,
      gender,
      bForm,
      gradeId,
      sectionId,
      shiftId,
      sessionId,
      address,
      photoUrl,
      isActive: true,
    },
  });

  // Optional parent linking (phone is the dedupe key; required by schema).
  const parentName = String(body.parentName ?? '').trim();
  const parentPhone = String(body.parentPhone ?? '').trim();
  if (parentPhone) {
    let parent = await prisma.parent.findFirst({ where: { phone: parentPhone } });
    if (!parent) {
      parent = await prisma.parent.create({
        data: { name: parentName || 'Parent', phone: parentPhone },
      });
    }
    await prisma.studentParent.create({
      data: { studentId: student.id, parentId: parent.id },
    });
  }

  return NextResponse.json({ student: { id: student.id, admissionNo: student.admissionNo, name: student.name } }, { status: 201 });
}
