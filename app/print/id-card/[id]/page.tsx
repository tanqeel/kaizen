import { redirect } from 'next/navigation';
import { getPrintSchool, getScopedStudent } from '../../_lib';
import { IdCardDoc } from './_doc';

export const dynamic = 'force-dynamic';

/** /print/id-card/[id] — printable student ID card (role-scoped). */
export default async function IdCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [school, student] = await Promise.all([getPrintSchool(), getScopedStudent(id)]);
  if (!student) redirect('/forbidden');

  return (
    <IdCardDoc
      school={school}
      student={{
        name: student.name,
        admissionNo: student.admissionNo,
        grade: student.grade.name,
        section: student.section.name,
        session: student.session.name,
        kaizenId: student.user?.kaizenId ?? null,
        photoUrl: student.photoUrl,
        fatherName: student.parents[0]?.parent.name ?? null,
      }}
    />
  );
}
