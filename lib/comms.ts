import { prisma } from './db';
import type { AnnouncementAudience } from '@prisma/client';

// Client-safe constants/helpers live in ./comms-shared so 'use client'
// components can import them without pulling in prisma.
export {
  ANNOUNCEMENT_AUDIENCES,
  AUDIENCE_LABELS,
  TEMPLATE_VARIABLES,
  renderTemplate,
} from './comms-shared';

export interface Recipient {
  userId: string | null;
  studentId: string | null;
}

/**
 * Resolve an announcement audience to concrete notification recipients.
 * Parents resolve to (parentUserId, studentId) rows; staff/teachers/all to
 * (userId, null) rows.
 */
export async function resolveRecipients(
  audience: AnnouncementAudience,
  gradeId: string | null,
): Promise<Recipient[]> {
  switch (audience) {
    case 'STAFF':
    case 'TEACHERS': {
      const users = await prisma.user.findMany({
        where: { role: audience === 'STAFF' ? 'STAFF' : 'TEACHER', isActive: true },
        select: { id: true },
      });
      return users.map((u) => ({ userId: u.id, studentId: null }));
    }
    case 'ALL': {
      const users = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      return users.map((u) => ({ userId: u.id, studentId: null }));
    }
    case 'PARENTS':
    case 'GRADES': {
      const students = await prisma.student.findMany({
        where: {
          isActive: true,
          ...(audience === 'GRADES' ? { gradeId: gradeId! } : {}),
        },
        select: { id: true },
      });
      const links = await prisma.studentParent.findMany({
        where: { studentId: { in: students.map((s) => s.id) }, student: { isActive: true } },
        include: { parent: { select: { userId: true } } },
      });
      const out: Recipient[] = [];
      for (const l of links) {
        if (l.parent.userId) out.push({ userId: l.parent.userId, studentId: l.studentId });
      }
      return out;
    }
  }
}

/* Client-safe constants/helpers (ANNOUNCEMENT_AUDIENCES, AUDIENCE_LABELS,
   TEMPLATE_VARIABLES, renderTemplate) are re-exported from ./comms-shared. */
