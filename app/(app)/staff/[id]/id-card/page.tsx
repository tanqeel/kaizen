import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { pktDate, todayPKT } from '@/lib/format';
import { PageHeader } from '@/components/ui';
import { Icon } from '@/components/icons';
import { StaffIdCardPrinter } from './_components/staff-id-card-printer';

/** /staff/[id]/id-card — printable teacher/staff ID card (85.6 × 54 mm). staff.manage. */
export default async function StaffIdCardPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  requirePagePermission(user.role, 'staff.manage');
  const { id } = await params;

  const teacher = await prisma.teacher.findFirst({
    where: { id, isActive: true },
    include: { user: { select: { name: true } } },
  });
  const staffMember = teacher
    ? null
    : await prisma.staffMember.findFirst({
        where: { id, isActive: true },
        include: { user: { select: { name: true } } },
      });
  if (!teacher && !staffMember) notFound();

  const record = teacher ?? staffMember!;
  const school = await prisma.school.findFirst();

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/staff"
          className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
        >
          <Icon name="arrow-left" size={16} /> Back to staff
        </Link>
      </div>
      <PageHeader title="Staff ID card" subtitle={`${record.user?.name ?? '—'} · ${record.employeeId}`} />
      <StaffIdCardPrinter
        school={{
          name: school?.name ?? 'Kaizen Model School',
          address: school?.address,
          phone: school?.phone,
          email: school?.email,
          logoUrl: school?.logoUrl,
        }}
        card={{
          name: record.user?.name ?? '—',
          employeeId: record.employeeId,
          designation: teacher ? 'Teacher' : (staffMember!.designation ?? 'Staff'),
          phone: record.phone ?? null,
          photoUrl: null,
          issueDate: pktDate(todayPKT()),
        }}
      />
    </div>
  );
}
