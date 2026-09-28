import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { pktDate, todayPKT } from '@/lib/format';
import { PageHeader } from '@/components/ui';
import { Icon } from '@/components/icons';
import { LeavingCertPrinter } from './_components/leaving-cert-printer';

/**
 * /students/[id]/leaving-certificate — printable school leaving certificate.
 * students.view. Conduct and reason-for-leaving are left blank for manual
 * completion; nothing about conduct is ever invented.
 */
export default async function LeavingCertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  requirePagePermission(user.role, 'students.view');
  const { id } = await params;

  const student = await prisma.student.findFirst({
    where: { id, isActive: true },
    include: {
      grade: { select: { name: true } },
      section: { select: { name: true } },
      session: { select: { name: true, startDate: true } },
      parents: {
        include: { parent: { select: { name: true } } },
        take: 1,
      },
    },
  });
  if (!student) notFound();

  const school = await prisma.school.findFirst();
  const link = student.parents[0];
  const today = pktDate(todayPKT());

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
      <PageHeader title="School leaving certificate" subtitle={`${student.name} · ${student.admissionNo}`} />
      <LeavingCertPrinter
        school={{
          name: school?.name ?? 'Kaizen Model School',
          address: school?.address,
          phone: school?.phone,
          email: school?.email,
          logoUrl: school?.logoUrl,
        }}
        cert={{
          certNo: `LC-${id.slice(-8).toUpperCase()}`,
          name: student.name,
          admissionNo: student.admissionNo,
          dob: student.dob ? pktDate(student.dob) : null,
          parentName: link?.parent.name ?? null,
          parentRelation: link?.relation ?? null,
          classLabel: `${student.grade.name} · Section ${student.section.name}`,
          sessionLabel: student.session?.name ?? null,
          sessionStart: student.session ? pktDate(student.session.startDate) : null,
          issueDate: today,
        }}
      />
    </div>
  );
}
