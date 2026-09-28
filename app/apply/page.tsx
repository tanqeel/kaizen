import { prisma } from '@/lib/db';
import { ApplyForm } from './_components/apply-form';

// Public page with direct DB reads and no session — must render per-request,
// never statically prerender at build time (no live DATABASE_URL then).
export const dynamic = 'force-dynamic';

/**
 * Public admission application page — outside the (app) group, no auth,
 * no sidebar. Fetches only school name + grade id/name via Prisma.
 */
export default async function ApplyPage() {
  const school = await prisma.school.findFirst({ select: { id: true, name: true } });
  const grades = school
    ? await prisma.grade.findMany({
        where: { schoolId: school.id },
        select: { id: true, name: true },
        orderBy: { level: 'asc' },
      })
    : [];

  return (
    <main id="main-content" className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-6 text-center">
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{school?.name ?? 'Kaizen'}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Online admission application
        </p>
      </div>
      <ApplyForm schoolName={school?.name ?? ''} grades={grades} />
    </main>
  );
}
