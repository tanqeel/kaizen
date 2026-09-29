import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';

/**
 * Shared helpers for print-document routes.
 * All print routes live under /print/* (outside the app sidebar).
 */

export interface PrintSchool {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export async function getPrintSchool(): Promise<PrintSchool> {
  const s = await prisma.school.findFirst({
    select: { name: true, address: true, phone: true, email: true },
  });
  // Never invent school contact details on official documents:
  // missing fields stay null and the document hides that line.
  return {
    name: s?.name ?? 'Kaizen Model School',
    address: s?.address ?? null,
    phone: s?.phone ?? null,
    email: s?.email ?? null,
  };
}

/**
 * Load a student with parent/grade/section, enforcing role scoping:
 * - SUPER_ADMIN / PRINCIPAL / ADMIN / STAFF: any student
 * - TEACHER: only students in their assigned sections
 * - PARENT: only their linked children
 * - STUDENT: only themselves
 * Returns null when not allowed / not found (caller redirects to /forbidden).
 */
export async function getScopedStudent(studentId: string) {
  const user = await requireUser();
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      grade: true,
      section: true,
      session: true,
      user: { select: { kaizenId: true } },
      parents: { include: { parent: true } },
    },
  });
  if (!student) return null;

  const role = user.role;
  if (['SUPER_ADMIN', 'PRINCIPAL', 'ADMIN', 'STAFF'].includes(role)) return student;

  if (role === 'TEACHER') {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!teacher) return null;
    // Teacher: only students in sections they teach — as class teacher,
    // via timetable slots, or via subject allocations for the grade.
    const [asClassTeacher, viaTimetable, viaAllocation] = await Promise.all([
      prisma.section.findMany({
        where: { classTeacherId: teacher.id },
        select: { id: true },
      }),
      prisma.timetableSlot.findMany({
        where: { teacherId: teacher.id },
        select: { sectionId: true },
        distinct: ['sectionId'],
      }),
      prisma.subjectAllocation.findMany({
        where: { teacherId: teacher.id },
        select: { grade: { select: { sections: { select: { id: true } } } } },
      }),
    ]);
    const sectionIds = new Set([
      ...asClassTeacher.map((s) => s.id),
      ...viaTimetable.map((s) => s.sectionId),
      ...viaAllocation.flatMap((a) => a.grade.sections.map((s) => s.id)),
    ]);
    return sectionIds.has(student.sectionId) ? student : null;
  }

  if (role === 'PARENT') {
    const link = await prisma.studentParent.findFirst({
      where: { studentId: student.id, parent: { userId: user.id } },
      select: { studentId: true },
    });
    return link ? student : null;
  }

  if (role === 'STUDENT') {
    return student.userId === user.id ? student : null;
  }

  return null;
}

/** Guard a print route: must be signed in; redirect to /forbidden when scoped load fails. */
export async function requirePrintAccess() {
  const user = await requireUser().catch(() => null);
  if (!user) redirect('/login');
  return user;
}

/** Print button lives in ./_print-button.tsx (client component). */

/** Convert a number to words (PKR amounts on vouchers/slips). Re-exported for server use. */
export { amountInWords } from './_format';
