import { prisma } from '@/lib/db';
import { DAY_NAMES } from '@/lib/days';

export interface SlotInput {
  sectionId: string;
  dayOfWeek: number;
  periodNo: number;
  subjectId: string;
  teacherId: string;
  room?: string | null;
  startTime: string;
  endTime: string;
}

export type SlotCheck =
  | { ok: true }
  | { ok: false; status: number; body: { error?: string; warning?: string; existing?: unknown } };

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Validates a timetable slot: FKs exist, ranges sane, the cell is free, and the
 * teacher is not double-booked. Returns { ok:true } or a 4xx response body.
 * A same-teacher/same-day/same-period slot in ANOTHER section is a *warning*
 * (callers pass override=true to force it) — never a silent overwrite.
 */
export async function checkSlot(input: SlotInput, excludeId?: string, override = false): Promise<SlotCheck> {
  const { sectionId, dayOfWeek, periodNo, subjectId, teacherId, startTime, endTime } = input;

  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return { ok: false, status: 400, body: { error: 'dayOfWeek must be 0 (Sun) … 6 (Sat)' } };
  }
  if (!Number.isInteger(periodNo) || periodNo < 1 || periodNo > 12) {
    return { ok: false, status: 400, body: { error: 'periodNo must be between 1 and 12' } };
  }
  if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
    return { ok: false, status: 400, body: { error: 'startTime/endTime must be HH:MM (24h)' } };
  }
  if (startTime >= endTime) {
    return { ok: false, status: 400, body: { error: 'startTime must be before endTime' } };
  }

  const [section, subject, teacher] = await Promise.all([
    prisma.section.findUnique({ where: { id: sectionId }, include: { grade: true } }),
    prisma.subject.findUnique({ where: { id: subjectId } }),
    prisma.teacher.findUnique({ where: { id: teacherId }, include: { user: true } }),
  ]);
  if (!section) return { ok: false, status: 404, body: { error: 'Section not found' } };
  if (!subject) return { ok: false, status: 404, body: { error: 'Subject not found' } };
  if (!teacher) return { ok: false, status: 404, body: { error: 'Teacher not found' } };

  // 1. The cell itself must be free (one slot per section/day/period).
  const cellTaken = await prisma.timetableSlot.findUnique({
    where: { sectionId_dayOfWeek_periodNo: { sectionId, dayOfWeek, periodNo } },
    include: { subject: true },
  });
  if (cellTaken && cellTaken.id !== excludeId) {
    return {
      ok: false,
      status: 409,
      body: {
        error: `Period ${periodNo} on ${DAY_NAMES[dayOfWeek]} in ${section.grade.name}-${section.name} is already timetabled (${cellTaken.subject.name}). Edit or delete it instead.`,
      },
    };
  }

  // 2. Teacher double-booking: same teacher, day and period in another section.
  const clash = await prisma.timetableSlot.findFirst({
    where: {
      teacherId,
      dayOfWeek,
      periodNo,
      sectionId: { not: sectionId },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    include: { section: { include: { grade: true } }, subject: true },
  });
  if (clash && !override) {
    const teacherName = teacher.user?.name ?? 'Teacher';
    return {
      ok: false,
      status: 409,
      body: {
        warning: `${teacherName} is already booked Period ${periodNo} on ${DAY_NAMES[dayOfWeek]} in ${clash.section.grade.name}-${clash.section.name} (${clash.subject.name}).`,
        existing: {
          section: `${clash.section.grade.name}-${clash.section.name}`,
          subject: clash.subject.name,
          day: DAY_NAMES[dayOfWeek],
          periodNo,
        },
      },
    };
  }

  return { ok: true };
}
