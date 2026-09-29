import { prisma } from './db';
import type { Role } from '@prisma/client';

/**
 * Resource-level authorization helpers.
 *
 * These enforce the core privacy rule at the data layer:
 * "Every user can only see and interact with data that belongs to them,
 *  is directly related to them, or is intentionally published as common
 *  school information."
 *
 * UI hiding is NOT security — every API must call these before returning data.
 */

export interface AuthContext {
  id: string;
  role: Role;
}

/** Management roles that can see all data within their school. */
export function isManager(role: Role): boolean {
  return role === 'SUPER_ADMIN' || role === 'PRINCIPAL' || role === 'ADMIN';
}

/**
 * Returns the section IDs a teacher is assigned to (class teacher,
 * timetable slots, subject allocations). Returns null for managers
 * (meaning: no restriction).
 */
export async function teacherSectionIds(userId: string): Promise<string[] | null> {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    include: {
      classSections: { select: { id: true } },
      timetableSlots: { select: { sectionId: true } },
      allocations: { select: { gradeId: true } },
    },
  });
  if (!teacher) return [];
  const ids = new Set<string>();
  teacher.classSections.forEach((s) => ids.add(s.id));
  teacher.timetableSlots.forEach((s) => {
    if (s.sectionId) ids.add(s.sectionId);
  });
  // Subject allocations are grade-level: include all sections of those grades.
  if (teacher.allocations.length > 0) {
    const gradeIds = teacher.allocations.map((a) => a.gradeId);
    const sections = await prisma.section.findMany({
      where: { gradeId: { in: gradeIds } },
      select: { id: true },
    });
    sections.forEach((s) => ids.add(s.id));
  }
  return [...ids];
}

/**
 * Can this user view this student's record?
 * - Managers: yes
 * - Teacher: only if the student is in one of their assigned sections
 * - Parent: only if linked to the student
 * - Student: only their own record
 * - Staff: yes for operational purposes (scoped by permission, not identity)
 */
export async function canViewStudent(
  auth: AuthContext,
  studentId: string,
): Promise<boolean> {
  if (isManager(auth.role)) return true;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      userId: true,
      sectionId: true,
      parents: { select: { parent: { select: { userId: true } } } },
    },
  });
  if (!student) return false;

  if (auth.role === 'TEACHER') {
    const sections = await teacherSectionIds(auth.id);
    return sections !== null && student.sectionId !== null && sections.includes(student.sectionId);
  }
  if (auth.role === 'PARENT') {
    return student.parents.some((p) => p.parent.userId === auth.id);
  }
  if (auth.role === 'STUDENT') {
    return student.userId === auth.id;
  }
  // STAFF: operational access governed by route-level permissions.
  return auth.role === 'STAFF';
}

/**
 * Returns a Prisma where-clause fragment restricting students to what
 * the user may see. Returns {} for managers (no restriction).
 */
export async function studentScopeWhere(
  auth: AuthContext,
): Promise<Record<string, unknown>> {
  if (isManager(auth.role) || auth.role === 'STAFF') return {};

  if (auth.role === 'TEACHER') {
    const sections = await teacherSectionIds(auth.id);
    return { sectionId: { in: sections ?? [] } };
  }
  if (auth.role === 'PARENT') {
    const parent = await prisma.parent.findUnique({
      where: { userId: auth.id },
      select: { id: true },
    });
    if (!parent) return { id: '__none__' };
    return { parents: { some: { parentId: parent.id } } };
  }
  if (auth.role === 'STUDENT') {
    return { userId: auth.id };
  }
  return { id: '__none__' };
}

/**
 * Can this user view this user's record?
 * - Managers: yes
 * - Everyone: only their own record
 */
export function canViewUser(auth: AuthContext, targetUserId: string): boolean {
  return isManager(auth.role) || auth.id === targetUserId;
}
