import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getPrintSchool, getScopedStudent } from '../../_lib';
import { FeeVoucherDoc } from './_doc';

export const dynamic = 'force-dynamic';

/** /print/fee-voucher/[id] — printable bank-style fee voucher (role-scoped via student). */
export default async function FeeVoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const school = await getPrintSchool();

  const voucher = await prisma.feeVoucher.findUnique({
    where: { id },
    include: {
      lines: { include: { feeHead: true } },
      session: true,
    },
  });
  if (!voucher) redirect('/forbidden');

  // Role scoping goes through the student.
  const student = await getScopedStudent(voucher.studentId);
  if (!student) redirect('/forbidden');

  const total = voucher.totalAmount - voucher.discountAmount + voucher.fineAmount;
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <FeeVoucherDoc
      school={school}
      voucher={{
        voucherNo: `KZN-FV-${voucher.year}-${voucher.id.slice(-4).toUpperCase()}`,
        date: fmt(voucher.issuedAt),
        dueDate: fmt(voucher.dueDate),
        status: voucher.status,
        studentName: student.name,
        fatherName: student.parents[0]?.parent.name ?? null,
        grade: student.grade.name,
        section: student.section.name,
        studentId: student.user?.kaizenId ?? student.admissionNo,
        session: voucher.session.name,
        lines: voucher.lines.map((l) => ({ description: l.feeHead.name, amount: l.amount })),
        discount: voucher.discountAmount,
        fine: voucher.fineAmount,
        total,
      }}
    />
  );
}
