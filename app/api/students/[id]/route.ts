import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';

/**
 * PATCH /api/students/[id] — update a student (discharge / reactivate / edit profile).
 * Body: { isActive?, name?, dob?, gender?, bForm?, address?, photoUrl?, gradeId?, sectionId? }
 * Discharging (isActive=false) keeps all historical records; the student simply
 * leaves the active directory. students.manage only.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('students.manage');
  if (auth.error) return auth.error;
  const { id } = await params;

  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
  if (typeof body.address === 'string') data.address = body.address.trim() || null;
  if (typeof body.bForm === 'string') data.bForm = body.bForm.trim() || null;
  if (typeof body.gender === 'string') data.gender = body.gender.trim() || null;
  if (typeof body.photoUrl === 'string') data.photoUrl = body.photoUrl.trim() || null;
  if (typeof body.dob === 'string') {
    const dobRaw = body.dob.trim();
    if (dobRaw) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dobRaw)) {
        return NextResponse.json({ error: 'DOB must be YYYY-MM-DD.' }, { status: 400 });
      }
      const dob = new Date(dobRaw + 'T00:00:00');
      if (Number.isNaN(dob.getTime()) || dob.getTime() > Date.now()) {
        return NextResponse.json({ error: 'DOB must be a valid past date.' }, { status: 400 });
      }
      data.dob = dob;
    } else {
      data.dob = null;
    }
  }
  // Section transfer (must belong to the grade).
  if (typeof body.sectionId === 'string' && body.sectionId.trim()) {
    const sectionId = body.sectionId.trim();
    const gradeId = typeof body.gradeId === 'string' && body.gradeId.trim() ? body.gradeId.trim() : student.gradeId;
    const section = await prisma.section.findFirst({ where: { id: sectionId, gradeId } });
    if (!section) return NextResponse.json({ error: 'Section does not belong to the selected grade.' }, { status: 400 });
    data.sectionId = sectionId;
    data.gradeId = gradeId;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const updated = await prisma.student.update({ where: { id }, data });
  return NextResponse.json({ student: { id: updated.id, isActive: updated.isActive, name: updated.name } });
}
