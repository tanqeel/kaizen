import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePrintAccess, getPrintSchool } from '../_lib';
import { TimetableDoc } from './_doc';

export const dynamic = 'force-dynamic';

/** /print/timetable?sectionId= — printable weekly class timetable (common info). */
export default async function TimetablePrintPage({
  searchParams,
}: {
  searchParams: Promise<{ sectionId?: string }>;
}) {
  const user = await requirePrintAccess();
  const { sectionId } = await searchParams;
  if (!sectionId) redirect('/forbidden');

  // Scope: students/parents only their own section; others any.
  if (user.role === 'STUDENT') {
    const st = await prisma.student.findFirst({
      where: { userId: user.id },
      select: { sectionId: true },
    });
    if (!st || st.sectionId !== sectionId) redirect('/forbidden');
  }
  if (user.role === 'PARENT') {
    const link = await prisma.studentParent.findFirst({
      where: { parent: { userId: user.id }, student: { sectionId } },
      select: { studentId: true },
    });
    if (!link) redirect('/forbidden');
  }

  const [school, section, session] = await Promise.all([
    getPrintSchool(),
    prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        grade: { select: { name: true } },
      },
    }),
    prisma.academicSession.findFirst({
      where: { isCurrent: true },
      select: { name: true },
    }),
  ]);
  if (!section) redirect('/forbidden');

  const slots = await prisma.timetableSlot.findMany({
    where: { sectionId },
    include: { subject: { select: { name: true } } },
    orderBy: [{ dayOfWeek: 'asc' }, { periodNo: 'asc' }],
  });

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayIdx = [1, 2, 3, 4, 5, 6]; // Mon–Sat

  // Group by period (startTime–endTime), one row per period.
  const periodMap = new Map<string, { time: string; cells: string[] }>();
  for (const s of slots) {
    const key = `${s.startTime}-${s.endTime}`;
    if (!periodMap.has(key)) {
      periodMap.set(key, { time: `${s.startTime} – ${s.endTime}`, cells: ['', '', '', '', '', ''] });
    }
    const di = dayIdx.indexOf(s.dayOfWeek);
    if (di >= 0) periodMap.get(key)!.cells[di] = s.subject.name;
  }
  // Drop empty Saturday column when unused.
  const rows = [...periodMap.values()];
  const satUsed = rows.some((r) => r.cells[5]);
  const days = satUsed ? DAYS : DAYS.slice(0, 5);
  const finalRows = rows.map((r) => ({ ...r, cells: satUsed ? r.cells : r.cells.slice(0, 5) }));

  return (
    <TimetableDoc
      school={school}
      table={{
        session: session?.name ?? '',
        grade: section.grade.name,
        section: section.name,
        days,
        rows: finalRows,
      }}
    />
  );
}
