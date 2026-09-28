import { getSession, requireUser } from '@/lib/auth';
import { can, NAV_ITEMS } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';

/**
 * Authenticated app shell. Guards every page inside app/(app)/:
 * requireUser() redirects to /login when unauthenticated; each page adds its
 * own requirePagePermission() check on top.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const session = await getSession();

  const [school, academicSession] = await Promise.all([
    prisma.school.findFirst(),
    prisma.academicSession.findFirst({ where: { isCurrent: true } }),
  ]);

  const schoolName = school?.name ?? 'Kaizen Model School';
  const sessionLabel = academicSession
    ? `Academic session ${academicSession.name}${academicSession.term ? ` · ${academicSession.term}` : ''}`
    : 'School portal';

  const nav = NAV_ITEMS.filter((item) => can(user.role, item.perm));

  return (
    <div className="min-h-dvh">
      <Sidebar items={nav} schoolName={schoolName} />
      <div className="lg:pl-64">
        <Header
          user={user}
          isDemo={session?.isDemo ?? false}
          schoolName={schoolName}
          sessionLabel={sessionLabel}
        />
        <main id="main-content" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
