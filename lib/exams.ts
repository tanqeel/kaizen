import { prisma } from './db';

/** Grading bands per build brief §5.6: A+ ≥90, A ≥80, B ≥70, C ≥60, D ≥50, F <50. */
export function gradeBand(pct: number): string {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}

/** Percentage rounded to one decimal. */
export function pctOf(obtained: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((obtained / total) * 1000) / 10;
}

/**
 * Teacher remark matched to the percentage so report cards never praise a
 * failing mark or scold a top one. Kept neutral and professional.
 */
export function remarkFor(pct: number): string {
  if (pct >= 90) return 'Outstanding work';
  if (pct >= 80) return 'Excellent work';
  if (pct >= 70) return 'Good effort';
  if (pct >= 60) return 'Satisfactory — keep improving';
  if (pct >= 50) return 'Needs more practice';
  return 'Needs significant improvement';
}

/**
 * Grades a teacher "owns" for scoping: grades where they have a subject
 * allocation OR are class teacher of a section. Returns grade ids.
 */
export async function teacherGradeIds(teacherUserId: string): Promise<string[]> {
  const teacher = await prisma.teacher.findFirst({ where: { userId: teacherUserId } });
  if (!teacher) return [];
  const [allocs, sections] = await Promise.all([
    prisma.subjectAllocation.findMany({ where: { teacherId: teacher.id }, select: { gradeId: true } }),
    prisma.section.findMany({ where: { classTeacherId: teacher.id }, select: { gradeId: true } }),
  ]);
  return [...new Set([...allocs.map((a) => a.gradeId), ...sections.map((s) => s.gradeId)])];
}

/** Child student ids visible to a parent user. */
export async function parentChildIds(parentUserId: string): Promise<string[]> {
  const parent = await prisma.parent.findFirst({
    where: { userId: parentUserId },
    include: { children: true },
  });
  return parent?.children.map((c) => c.studentId) ?? [];
}

/** Student id of the signed-in STUDENT user (their own record), if any. */
export async function ownStudentId(studentUserId: string): Promise<string | null> {
  const s = await prisma.student.findFirst({ where: { userId: studentUserId }, select: { id: true } });
  return s?.id ?? null;
}
