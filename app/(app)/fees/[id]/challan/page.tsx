import Link from 'next/link';
import { notFound, forbidden } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { childStudentIds } from '@/lib/parents';
import { pkr, pktDate } from '@/lib/format';
import {
  balanceDue, effectiveTotal, monthLabel, paidSum,
} from '@/lib/fees';
import { PageHeader } from '@/components/ui';
import { Icon } from '@/components/icons';
import { ChallanPrinter } from './_components/challan-printer';

/** /fees/[id]/challan — printable/downloadable 3-copy fee challan. finance.view; parents see only own children. */
export default async function ChallanPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  requirePagePermission(user.role, 'finance.view');

  const { id } = await params;
  const v = await prisma.feeVoucher.findUnique({
    where: { id },
    include: {
      student: { include: { grade: true, section: true } },
      lines: { include: { feeHead: true } },
      payments: true,
    },
  });
  if (!v) notFound();

  if (user.role === 'PARENT') {
    const ids = await childStudentIds(user.id);
    if (!ids.includes(v.studentId)) forbidden();
  }

  const school = await prisma.school.findFirst();
  const paid = paidSum(v.payments);
  const payable = effectiveTotal(v);
  const balance = Math.max(0, balanceDue(v, v.payments));

  return (
    <div>
      <div className="mb-4">
        <Link
          href={`/fees/${v.id}`}
          className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
        >
          <Icon name="arrow-left" size={16} /> Back to voucher
        </Link>
      </div>
      <PageHeader title="Fee challan" subtitle={`${v.student.name} · ${monthLabel(v.month, v.year)}`} />
      <ChallanPrinter
        schoolName={school?.name ?? 'Kaizen Model School'}
        schoolAddress={school?.address}
        schoolPhone={school?.phone}
        voucher={{
          challanNo: v.id.slice(-8).toUpperCase(),
          monthLabel: monthLabel(v.month, v.year),
          issueDate: pktDate(v.issuedAt),
          dueDate: pktDate(v.dueDate),
          totalAmount: v.totalAmount,
          discountAmount: v.discountAmount,
          fineAmount: v.fineAmount,
          payable,
          paid,
          balance,
          status: v.status,
          lines: v.lines.map((l) => ({ head: l.feeHead.name, amount: l.amount })),
          student: {
            name: v.student.name,
            admissionNo: v.student.admissionNo,
            classLabel: `${v.student.grade.name} · Section ${v.student.section.name}`,
          },
        }}
      />
      <p className="sr-only">{pkr(payable)}</p>
    </div>
  );
}
