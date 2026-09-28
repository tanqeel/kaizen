import { AnnouncementAudience, type Role } from '@prisma/client';
import { prisma } from './db';
import { childStudentIds } from './parents';

export interface PortalEventItem {
  id: string;
  title: string;
  description: string | null;
  date: Date;
  endDate: Date | null;
  audience: AnnouncementAudience;
  venue: string | null;
  gradeName: string | null;
}

/**
 * The next `take` upcoming audience-relevant school events for a portal viewer.
 * Mirrors the audience logic of GET /api/events:
 * - PARENT → ALL + PARENTS events, plus GRADES events matching any of their
 *   children's grades (via childStudentIds).
 * - STUDENT → ALL events, plus GRADES events matching their own grade.
 * - Everyone else (teachers, staff, principals, super-admins) → all upcoming events.
 * Returns [] when the school is not configured or nothing matches.
 */
export async function getUpcomingEvents(
  userId: string,
  role: Role,
  take = 3,
): Promise<PortalEventItem[]> {
  let clause: Record<string, unknown> = {};

  if (role === 'PARENT') {
    const kids = await childStudentIds(userId);
    const ors: Record<string, unknown>[] = [
      { audience: { in: [AnnouncementAudience.ALL, AnnouncementAudience.PARENTS] } },
    ];
    if (kids.length > 0) {
      const students = await prisma.student.findMany({
        where: { id: { in: kids } },
        select: { gradeId: true },
      });
      const gradeIds = [...new Set(students.map((s) => s.gradeId))];
      if (gradeIds.length > 0) {
        ors.push({ audience: AnnouncementAudience.GRADES, gradeId: { in: gradeIds } });
      }
    }
    clause = { OR: ors };
  } else if (role === 'STUDENT') {
    const student = await prisma.student.findUnique({
      where: { userId },
      select: { gradeId: true },
    });
    const ors: Record<string, unknown>[] = [{ audience: AnnouncementAudience.ALL }];
    if (student) ors.push({ audience: AnnouncementAudience.GRADES, gradeId: student.gradeId });
    clause = { OR: ors };
  }

  const school = await prisma.school.findFirst({ select: { id: true } });
  if (!school) return [];

  const events = await prisma.schoolEvent.findMany({
    where: {
      schoolId: school.id,
      date: { gte: new Date() },
      ...clause,
    },
    include: { grade: { select: { name: true } } },
    orderBy: { date: 'asc' },
    take,
  });

  return events.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    date: e.date,
    endDate: e.endDate,
    audience: e.audience,
    venue: e.venue,
    gradeName: e.grade?.name ?? null,
  }));
}
