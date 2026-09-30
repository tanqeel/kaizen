import { redirect } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import { getSession } from '@/lib/auth';
import { can, NAV_ITEMS } from '@/lib/rbac';
import { staffTypeAllows } from '@/lib/staff-permissions';
import { prisma } from '@/lib/db';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';

/**
 * School header info (name + current academic session label). Changes
 * extremely rarely, so it's cached for 5 minutes instead of querying
 * the database on every single page navigation.
 */
const getSchoolHeader = unstable_cache(
  async () => {
    const [school, academicSession] = await Promise.all([
      prisma.school.findFirst(),
      prisma.academicSession.findFirst({ where: { isCurrent: true } }),
    ]);
    return {
      schoolName: school?.name ?? 'Kaizen Model School',
      sessionLabel: academicSession
        ? `Academic session ${academicSession.name}${academicSession.term ? ` · ${academicSession.term}` : ''}`
        : 'School portal',
    };
  },
  ['school-header'],
  { revalidate: 300 },
);

/**
 * Authenticated app shell. Guards every page inside app/(app)/:
 * getSession() redirects to /login when unauthenticated; each page adds its
 * own requirePagePermission() check on top.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Single memoized session lookup per request (shared with pages via React cache()).
  const session = await getSession();
  if (!session) redirect('/login');
  const user = session.user;

  const { schoolName, sessionLabel } = await getSchoolHeader();

  // Staff-type-aware nav: a gatekeeper or peon must not see Fees /
  // Academics / Students / Admissions links their job role cannot use.
  // One staffMember lookup per request; the per-item check is pure.
  let staffType: import('@prisma/client').StaffType | null = null;
  if (user.role === 'STAFF') {
    const rec = await prisma.staffMember.findUnique({
      where: { userId: user.id },
      select: { staffType: true },
    });
    staffType = rec?.staffType ?? null;
  }
  const nav = NAV_ITEMS.filter((item) => {
    if (item.hideFor?.includes(user.role)) return false;
    if (user.role === 'STAFF') {
      // Staff without a staff record (e.g. newly created): fall back to
      // role-level permissions so the sidebar is never blank.
      if (staffType === null) return can(user.role, item.perm);
      return staffTypeAllows(staffType, user.role, item.perm);
    }
    return can(user.role, item.perm);
  });

  return (
    <div className="min-h-dvh">
      <Sidebar items={nav} schoolName={schoolName} />
      <div className="lg:pl-64">
        <Header
          user={user}
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
