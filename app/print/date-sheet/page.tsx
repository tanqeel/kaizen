import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePrintAccess, getPrintSchool } from '../_lib';
import { DateSheetDoc } from './_doc';

export const dynamic = 'force-dynamic';

/** /print/date-sheet?termId=&gradeId= — printable exam date sheet (common info, all roles).
 *  termId only → one page per grade. */
export default async function DateSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ termId?: string; gradeId?: string }>;
}) {
  const user = await requirePrintAccess();
  const { termId, gradeId } = await searchParams;
  if (!termId) redirect('/forbidden');

  // Scope: students/parents only their own grade; staff/admin any.
  if (user.role === 'STUDENT') {
    const st = await prisma.student.findFirst({
      where: { userId: user.id },
      select: { gradeId: true },
    });
    if (!st || (gradeId && st.gradeId !== gradeId)) redirect('/forbidden');
    // term-only mode narrows to their grade
  }
  if (user.role === 'PARENT') {
    const link = await prisma.studentParent.findFirst({
      where: {
        parent: { userId: user.id },
        ...(gradeId ? { student: { gradeId } } : {}),
      },
      select: { studentId: true },
    });
    if (!link) redirect('/forbidden');
  }

  const school = await getPrintSchool();
  const term = await prisma.examTerm.findUnique({
    where: { id: termId },
    select: { name: true },
  });
  if (!term) redirect('/forbidden');

  // Determine grades to render.
  let gradeIds: string[];
  if (gradeId) {
    gradeIds = [gradeId];
  } else if (user.role === 'STUDENT') {
    const st = await prisma.student.findFirst({
      where: { userId: user.id },
      select: { gradeId: true },
    });
    gradeIds = st ? [st.gradeId] : [];
  } else if (user.role === 'PARENT') {
    const links = await prisma.studentParent.findMany({
      where: { parent: { userId: user.id } },
      select: { student: { select: { gradeId: true } } },
    });
    gradeIds = [...new Set(links.map((l) => l.student.gradeId))];
  } else {
    const grades = await prisma.grade.findMany({
      select: { id: true },
      orderBy: { level: 'asc' },
    });
    gradeIds = grades.map((g) => g.id);
  }

  const grades = await prisma.grade.findMany({
    where: { id: { in: gradeIds } },
    select: { id: true, name: true },
    orderBy: { level: 'asc' },
  });
  if (grades.length === 0) redirect('/forbidden');

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const sheets = await Promise.all(
    grades.map(async (grade) => {
      const schedules = await prisma.examSchedule.findMany({
        where: { examTermId: termId, gradeId: grade.id },
        include: { subject: { select: { name: true } } },
        orderBy: { date: 'asc' },
      });
      return {
        termName: term.name,
        grade: grade.name,
        papers: schedules.map((s) => ({
          subject: s.subject.name,
          date: s.date.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }),
          day: DAYS[s.date.getDay()],
          time: s.startTime,
        })),
      };
    }),
  );

  return (
    <>
      {sheets.map((sheet, i) => (
        <div key={i} className={i > 0 ? 'kdoc-page-break' : undefined}>
          <DateSheetDoc school={school} sheet={sheet} />
        </div>
      ))}
    </>
  );
}
