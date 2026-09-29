import { prisma } from '@/lib/db';
import { requirePrintAccess, getPrintSchool, getScopedStudent } from '../_lib';
import { AdmissionFormDoc } from './_doc';

export const dynamic = 'force-dynamic';

/**
 * /print/admission-form — blank printable admission form.
 * Optional ?studentId= pre-fills name/father/class.
 */
export default async function AdmissionFormPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  await requirePrintAccess();
  const { studentId } = await searchParams;
  const [school, session] = await Promise.all([
    getPrintSchool(),
    prisma.academicSession.findFirst({
      where: { isCurrent: true },
      select: { name: true },
    }),
  ]);

  let prefill: { name: string; fatherName: string | null; grade: string } | null = null;
  if (studentId) {
    const s = await getScopedStudent(studentId);
    if (s) {
      prefill = {
        name: s.name,
        fatherName: s.parents[0]?.parent.name ?? null,
        grade: s.grade.name,
      };
    }
  }

  const year = new Date().getFullYear();
  return (
    <AdmissionFormDoc
      school={school}
      formNo={`KZN-AF-${year}-001`}
      session={session?.name ?? String(year)}
      prefill={prefill}
    />
  );
}
