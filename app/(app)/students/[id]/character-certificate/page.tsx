import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { pktDate, todayPKT } from '@/lib/format';
import { PageHeader } from '@/components/ui';
import { Icon } from '@/components/icons';
import { CharacterCertPrinter } from './_components/character-cert-printer';

/**
 * /students/[id]/character-certificate — printable character certificate.
 * students.view. Character/conduct sections are left blank for manual
 * completion; nothing about conduct is ever invented.
 */
export default async function CharacterCertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  requirePagePermission(user.role, 'students.view');
  const { id } = await params;

  const student = await prisma.student.findFirst({
    where: { id, isActive: true },
    include: {
      grade: { select: { name: true } },
      section: { select: { name: true } },
      session: { select: { name: true } },
      parents: {
        include: { parent: { select: { name: true } } },
        take: 1,
      },
    },
  });
  if (!student) notFound();

  const school = await prisma.school.findFirst();

  // Pronoun for the certificate body; falls back to his/her when gender is unknown.
  const g = (student.gender ?? '').trim().toLowerCase();
  const pronoun = g === 'female' || g === 'f' ? 'her' : g === 'male' || g === 'm' ? 'his' : 'his/her';

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
      <PageHeader title="Character certificate" subtitle={`${student.name} · ${student.admissionNo}`} />
      <CharacterCertPrinter
        school={{
          name: school?.name ?? 'Kaizen Model School',
          address: school?.address,
          phone: school?.phone,
          email: school?.email,
          logoUrl: school?.logoUrl,
        }}
        cert={{
          certNo: `CC-${id.slice(-8).toUpperCase()}`,
          name: student.name,
          admissionNo: student.admissionNo,
          parentName: student.parents[0]?.parent.name ?? null,
          classLabel: `${student.grade.name} · Section ${student.section.name}`,
          sessionLabel: student.session?.name ?? null,
          issueDate: pktDate(todayPKT()),
          pronoun,
        }}
      />
    </div>
  );
}
