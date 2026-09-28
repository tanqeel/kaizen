import { prisma } from './db';

/** Active student ids linked to a parent's user id. */
export async function childStudentIds(userId: string): Promise<string[]> {
  const parent = await prisma.parent.findUnique({
    where: { userId },
    include: { children: { include: { student: { select: { id: true, isActive: true } } } } },
  });
  if (!parent) return [];
  return parent.children.filter((c) => c.student.isActive).map((c) => c.student.id);
}

/** Distinct active user ids of parents linked to the given students. */
export async function parentUserIds(studentIds: string[]): Promise<string[]> {
  if (studentIds.length === 0) return [];
  const links = await prisma.studentParent.findMany({
    where: { studentId: { in: studentIds }, student: { isActive: true } },
    include: { parent: { select: { userId: true } } },
  });
  const ids = new Set<string>();
  for (const l of links) {
    if (l.parent.userId) ids.add(l.parent.userId);
  }
  return [...ids];
}
