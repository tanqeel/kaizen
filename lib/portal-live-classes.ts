import type { Role } from '@prisma/client';
import { prisma } from './db';
import { childStudentIds } from './parents';

export interface PortalLiveClass {
  id: string;
  title: string;
  meetingUrl: string;
  startsAt: Date;
  endsAt: Date;
  subject: string | null;
  sectionLabel: string;
  teacher: string;
}

/**
 * Next few live classes for a portal viewer (parent → children's sections,
 * student → own section, teacher → own sections and own hosted classes).
 * Window: started no earlier than 30 minutes ago, starting within the next
 * 48 hours. Staff/managers have no section scope here — returns [].
 */
export async function getUpcomingLiveClasses(
  userId: string,
  role: Role,
  take = 3,
): Promise<PortalLiveClass[]> {
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 60 * 1000);
  const to = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const timeWhere = { startsAt: { gte: from, lte: to } };

  let audienceWhere: Record<string, unknown> | null = null;
  if (role === 'PARENT') {
    const kids = await childStudentIds(userId);
    if (kids.length === 0) return [];
    const students = await prisma.student.findMany({
      where: { id: { in: kids }, isActive: true },
      select: { sectionId: true },
    });
    const sectionIds = [...new Set(students.map((s) => s.sectionId))];
    if (sectionIds.length === 0) return [];
    audienceWhere = { sectionId: { in: sectionIds } };
  } else if (role === 'STUDENT') {
    const student = await prisma.student.findUnique({
      where: { userId },
      select: { sectionId: true, isActive: true },
    });
    if (!student?.isActive) return [];
    audienceWhere = { sectionId: student.sectionId };
  } else if (role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({
      where: { userId },
      select: {
        id: true,
        timetableSlots: { select: { sectionId: true } },
        classSections: { select: { id: true } },
      },
    });
    if (!teacher) return [];
    const sectionIds = [
      ...new Set([
        ...teacher.timetableSlots.map((s) => s.sectionId),
        ...teacher.classSections.map((s) => s.id),
      ]),
    ];
    audienceWhere = {
      OR: [
        { teacherId: teacher.id },
        ...(sectionIds.length > 0 ? [{ sectionId: { in: sectionIds } }] : []),
      ],
    };
  } else {
    return [];
  }

  const classes = await prisma.liveClass.findMany({
    where: { ...timeWhere, ...audienceWhere },
    include: {
      subject: { select: { name: true } },
      section: { select: { name: true, grade: { select: { name: true } } } },
      teacher: { include: { user: { select: { name: true } } } },
    },
    orderBy: { startsAt: 'asc' },
    take,
  });

  return classes.map((c) => ({
    id: c.id,
    title: c.title,
    meetingUrl: c.meetingUrl,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    subject: c.subject?.name ?? null,
    sectionLabel: `${c.section.grade.name} · Section ${c.section.name}`,
    teacher: c.teacher.user?.name ?? 'Teacher',
  }));
}
