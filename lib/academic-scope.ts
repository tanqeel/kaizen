import { prisma } from './db';
import { childStudentIds } from './parents';
import type { Role } from '@prisma/client';

export interface AcademicScope {
  gradeIds: string[];
  sectionIds: string[];
}

/**
 * The grades/sections a viewer is allowed to see on academic pages.
 * - STUDENT: only their own grade + section.
 * - PARENT: only their children's grades + sections.
 * - Everyone else: null (unrestricted — managers, teachers, admins see all).
 */
export async function academicScope(userId: string, role: Role): Promise<AcademicScope | null> {
  if (role === 'STUDENT') {
    const s = await prisma.student.findUnique({
      where: { userId },
      select: { gradeId: true, sectionId: true },
    });
    return s ? { gradeIds: [s.gradeId], sectionIds: [s.sectionId] } : { gradeIds: [], sectionIds: [] };
  }
  if (role === 'PARENT') {
    const kids = await childStudentIds(userId);
    const studs = await prisma.student.findMany({
      where: { id: { in: kids } },
      select: { gradeId: true, sectionId: true },
    });
    return {
      gradeIds: [...new Set(studs.map((s) => s.gradeId))],
      sectionIds: [...new Set(studs.map((s) => s.sectionId))],
    };
  }
  return null;
}
