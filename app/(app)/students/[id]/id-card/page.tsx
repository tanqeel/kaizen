import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { pktDate, todayPKT } from '@/lib/format';
import { PageHeader } from '@/components/ui';
import { Icon } from '@/components/icons';
import { IdCardPrinter } from './_components/id-card-printer';

/** /students/[id]/id-card — printable student ID card (85.6 × 54 mm). students.view. */
export default async function StudentIdCardPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  requirePagePermission(user.role, 'students.view');
  const { id } = await params;

  const student = await prisma.student.findFirst({
    where: { id, isActive: true },
    include: {
      grade: { select: { name: true } },
      section: { select: { name: true } },
      parents: {
        include: { parent: { select: { name: true, phone: true } } },
        take: 1,
      },
    },
  });
  if (!student) notFound();

  const school = await prisma.school.findFirst();
  const guardian = student.parents[0]?.parent ?? null;

  return (
    <div>
      <div className="mb-4">
        <Link
          href={`/students/${student.id}`}
          className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
        >
          <Icon name="arrow-left" size={16} /> Back to profile
        </Link>
      </div>
      <PageHeader title="Student ID card" subtitle={`${student.name} · ${student.admissionNo}`} />
      <IdCardPrinter
        school={{
          name: school?.name ?? 'Kaizen Model School',
          address: school?.address,
          phone: school?.phone,
          email: school?.email,
          logoUrl: school?.logoUrl,
        }}
        card={{
          name: student.name,
          admissionNo: student.admissionNo,
          classLabel: `${student.grade.name} · Section ${student.section.name}`,
          dob: student.dob ? pktDate(student.dob) : null,
          parentName: guardian?.name ?? null,
          parentPhone: guardian?.phone ?? null,
          photoUrl: student.photoUrl,
          issueDate: pktDate(todayPKT()),
        }}
      />
    </div>
  );
}
