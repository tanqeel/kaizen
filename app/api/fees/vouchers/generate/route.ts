import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser, schoolIdOr400 } from '@/lib/api-auth';
import { headsForStudent } from '@/lib/fees';

/**
 * POST /api/fees/vouchers/generate { gradeId?, sectionId?, month, year }
 * Generates monthly fee vouchers. For each active target student in the
 * current session:
 * - skips when a voucher already exists for (studentId, month, year)
 * - total = grade-specific fee heads (prefer head whose gradeId matches the
 *   student's grade, else the global head of the same name)
 * - dueDate = the 10th of the billing month (PKT)
 * Returns { created, skipped }.
 */
export async function POST(req: Request) {
  const auth = await apiUser('finance.manage');
  if (auth.error) return auth.error;

  let body: { gradeId?: string; sectionId?: string; month?: number; year?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const month = Number(body.month);
  const year = Number(body.year);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'month must be 1–12' }, { status: 400 });
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'year must be 2000–2100' }, { status: 400 });
  }

  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;
  const session = await prisma.academicSession.findFirst({ where: { isCurrent: true } });
  if (!session) return NextResponse.json({ error: 'No current academic session' }, { status: 400 });

  const students = await prisma.student.findMany({
    where: {
      isActive: true,
      sessionId: session.id,
      ...(body.sectionId ? { sectionId: body.sectionId } : body.gradeId ? { gradeId: body.gradeId } : {}),
    },
    select: { id: true, gradeId: true },
  });

  const heads = await prisma.feeHead.findMany({ where: { schoolId: sres.schoolId } });
  const dueDate = new Date(`${year}-${String(month).padStart(2, '0')}-10T00:00:00+05:00`);

  let created = 0;
  let skipped = 0;

  for (const st of students) {
    const existing = await prisma.feeVoucher.findUnique({
      where: { studentId_month_year: { studentId: st.id, month, year } },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }
    const applicable = headsForStudent(heads, st.gradeId);
    const total = applicable.reduce((s, h) => s + h.defaultAmount, 0);
    await prisma.feeVoucher.create({
      data: {
        studentId: st.id,
        sessionId: session.id,
        month, year,
        dueDate,
        totalAmount: total,
        lines: { create: applicable.map((h) => ({ feeHeadId: h.id, amount: h.defaultAmount })) },
      },
    });
    created++;
  }

  return NextResponse.json({ ok: true, created, skipped, month, year });
}
