import { prisma } from '@/lib/db';
import { RegisterForm } from './_components/register-form';

// Public page with direct DB reads and no session — must render per-request,
// never statically prerender at build time (no live DATABASE_URL then).
export const dynamic = 'force-dynamic';

/**
 * Public self-registration page — outside the (app)/(auth) groups, no auth,
 * no sidebar. Creates a PENDING RegistrationRequest for admin/principal approval.
 */
export default async function RegisterPage() {
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
        <p className="text-2xl font-bold text-slate-900 dark:text-white">
          {school?.name ?? 'Kaizen'}
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Create your account request
        </p>
        <p className="mx-auto mt-3 max-w-xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Fill in your details below. Your request will be sent to the school administration
          for approval — you will receive access once it is approved.
        </p>
      </div>
      <RegisterForm schoolName={school?.name ?? ''} grades={grades} />
    </main>
  );
}
