import Link from 'next/link';
import { notFound, forbidden } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { can, requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { childStudentIds } from '@/lib/parents';
import { pkr, pktDate } from '@/lib/format';
import {
  balanceDueWithPolicy, displayStatus, effectiveTotalWithPolicy, monthLabel, paidSum, statusBadgeVariant,
  type FinePolicy,
} from '@/lib/fees';
import {
  Badge, Card, CardContent, CardHeader, CardTitle, EmptyState,
  PageHeader, Stat, Table, TBody, TD, TH, THead, TRow,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { RecordPayment } from './_components/record-payment';
import { PrintReceiptButton } from './_components/print-receipt-button';

function statusLabel(s: string): string {
  return s === 'PAID' ? 'Paid' : s === 'PARTIAL' ? 'Partial' : s === 'OVERDUE' ? 'Overdue' : 'Unpaid';
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank Transfer',
  KUICKPAY_1LINK: 'Kuickpay / 1Link',
  JAZZCASH: 'JazzCash',
  EASYPAISA: 'Easypaisa',
};

/** /fees/[id] — voucher detail: lines, payment history, balance, record payment. */
export default async function VoucherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  requirePagePermission(user.role, 'finance.view');
  const canManage = can(user.role, 'finance.manage');

  const { id } = await params;
  const v = await prisma.feeVoucher.findUnique({
    where: { id },
    include: {
      student: { include: { grade: true, section: true } },
      lines: { include: { feeHead: true } },
      payments: { include: { receivedBy: { select: { name: true } } }, orderBy: { paidAt: 'desc' } },
    },
  });
  if (!v) notFound();

  // Parents may only open their own children's vouchers — never leak existence.
  if (user.role === 'PARENT') {
    const ids = await childStudentIds(user.id);
    if (!ids.includes(v.studentId)) forbidden();
  }

  const school = await prisma.school.findFirst({ select: { name: true, id: true } });
  // Policy-accrued fine: vouchers generated before their due date still accrue correctly once overdue.
  const feePolicy: FinePolicy | null = school
    ? await prisma.feePolicy.findFirst({
        where: { schoolId: school.id },
        select: { finePerDay: true, fineGraceDays: true },
      })
    : null;
  const paid = paidSum(v.payments);
  const payable = effectiveTotalWithPolicy(v, feePolicy);
  const balance = Math.max(0, balanceDueWithPolicy(v, v.payments, feePolicy));
  const ds = displayStatus(v);
  const classLabel = `${v.student.grade.name} · Section ${v.student.section.name}`;

  const receiptVoucher = {
    monthLabel: monthLabel(v.month, v.year),
    dueDate: v.dueDate.toISOString(),
    payable, paid, balance,
    status: ds,
    lines: v.lines.map((l) => ({ head: l.feeHead.name, amount: l.amount })),
    student: { name: v.student.name, admissionNo: v.student.admissionNo, classLabel },
  };

  return (
    <div>
      <Link
        href="/fees"
        className="mb-4 inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
      >
        <Icon name="arrow-left" size={18} /> Back to vouchers
      </Link>

      <PageHeader
        title={`${v.student.name} — ${monthLabel(v.month, v.year)}`}
        subtitle={`${v.student.admissionNo} · ${classLabel} · Due ${pktDate(v.dueDate)}`}
        actions={
          <>
            <Badge variant={statusBadgeVariant(ds)}>{statusLabel(ds)}</Badge>
            <Link
              href={`/fees/${v.id}/challan`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <Icon name="download" size={16} /> Challan
            </Link>
            {canManage && balance > 0 && <RecordPayment voucherId={v.id} balance={balance} />}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total payable" value={pkr(payable)} icon="wallet" tone="neutral" />
        <Stat label="Paid" value={pkr(paid)} icon="check" tone="present" />
        <Stat label="Balance due" value={pkr(balance)} icon="alert-triangle" tone={balance > 0 ? 'overdue' : 'present'} />
        <Stat label="Due date" value={pktDate(v.dueDate)} icon="calendar-days" tone="info" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Fee breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TRow>
                  <TH>Fee head</TH>
                  <TH className="text-right">Amount</TH>
                </TRow>
              </THead>
              <TBody>
                {v.lines.map((l) => (
                  <TRow key={l.id}>
                    <TD>{l.feeHead.name}</TD>
                    <TD className="tnum text-right">{pkr(l.amount)}</TD>
                  </TRow>
                ))}
                <TRow>
                  <TD className="font-semibold text-slate-900 dark:text-white">Total</TD>
                  <TD className="tnum text-right font-semibold text-slate-900 dark:text-white">{pkr(v.totalAmount)}</TD>
                </TRow>
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment history</CardTitle>
          </CardHeader>
          <CardContent>
            {v.payments.length === 0 ? (
              <EmptyState
                icon="wallet"
                title="No payments yet"
                guidance={canManage ? 'Record the first payment against this voucher.' : 'No payments have been recorded for this voucher.'}
              />
            ) : (
              <Table>
                <THead>
                  <TRow>
                    <TH>Receipt</TH>
                    <TH>Paid at</TH>
                    <TH>Method</TH>
                    <TH className="text-right">Amount</TH>
                    <TH><span className="sr-only">Print</span></TH>
                  </TRow>
                </THead>
                <TBody>
                  {v.payments.map((p) => {
                    const payment = {
                      amount: p.amount,
                      method: p.method,
                      reference: p.reference,
                      paidAt: p.paidAt.toISOString(),
                      receivedBy: p.receivedBy?.name ?? '—',
                      receiptNo: `RCP-${p.id.slice(-6).toUpperCase()}`,
                    };
                    return (
                      <TRow key={p.id}>
                        <TD className="tnum font-medium">{payment.receiptNo}</TD>
                        <TD className="tnum whitespace-nowrap">{pktDate(p.paidAt)}</TD>
                        <TD className="whitespace-nowrap">
                          {METHOD_LABELS[p.method] ?? p.method}
                          {p.reference && <div className="tnum text-xs text-slate-500">{p.reference}</div>}
                        </TD>
                        <TD className="tnum text-right font-semibold text-emerald-700 dark:text-emerald-300">
                          {pkr(p.amount)}
                        </TD>
                        <TD>
                          <PrintReceiptButton
                            schoolName={school?.name ?? 'Kaizen Model School'}
                            payment={payment}
                            voucher={receiptVoucher}
                          />
                        </TD>
                      </TRow>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
