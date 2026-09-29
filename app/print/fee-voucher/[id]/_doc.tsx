'use client';

import { DocumentShell, DocRow } from '@/components/print/DocumentShell';
import { PrintButton } from '../../_print-button';
import { amountInWords } from '../../_format';

interface Props {
  school: { name: string; address: string | null; phone: string | null; email: string | null };
  voucher: {
    voucherNo: string;
    date: string;
    dueDate: string;
    status: string;
    studentName: string;
    fatherName: string | null;
    grade: string;
    section: string;
    studentId: string;
    session: string;
    lines: Array<{ description: string; amount: number }>;
    discount: number;
    fine: number;
    total: number;
  };
}

export function FeeVoucherDoc({ school, voucher }: Props) {
  return (
    <>
      <PrintButton />
      <DocumentShell
        title="Fee Voucher"
        subtitle="Fee Slip"
        schoolName={school.name}
        schoolAddress={school.address ?? undefined}
        schoolPhone={school.phone ?? undefined}
        schoolEmail={school.email ?? undefined}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '9pt', color: '#475569' }}>
          <div style={{ textAlign: 'right' }}>
            <div>Voucher No: <strong>{voucher.voucherNo}</strong></div>
            <div>Date: {voucher.date}</div>
            <div>Due Date: {voucher.dueDate}</div>
            <div>Status: <strong>{voucher.status}</strong></div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px', marginTop: 8 }}>
          <DocRow label="Student Name" value={voucher.studentName} />
          <DocRow label="Father's Name" value={voucher.fatherName ?? '—'} />
          <DocRow label="Class" value={voucher.grade} />
          <DocRow label="Section" value={voucher.section} />
          <DocRow label="Student ID" value={voucher.studentId} />
          <DocRow label="Session" value={voucher.session} />
        </div>

        <table className="kdoc-table">
          <thead>
            <tr>
              <th style={{ width: 50 }}>S.No</th>
              <th>Description</th>
              <th style={{ width: 140, textAlign: 'right' }}>Amount (PKR)</th>
            </tr>
          </thead>
          <tbody>
            {voucher.lines.map((l, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{l.description}</td>
                <td style={{ textAlign: 'right' }}>{l.amount.toLocaleString('en-PK')}</td>
              </tr>
            ))}
            {voucher.discount > 0 && (
              <tr>
                <td>{voucher.lines.length + 1}</td>
                <td>Discount / Scholarship</td>
                <td style={{ textAlign: 'right' }}>(–{voucher.discount.toLocaleString('en-PK')})</td>
              </tr>
            )}
            {voucher.fine > 0 && (
              <tr>
                <td>{voucher.lines.length + (voucher.discount > 0 ? 2 : 1)}</td>
                <td>Late Fine</td>
                <td style={{ textAlign: 'right' }}>{voucher.fine.toLocaleString('en-PK')}</td>
              </tr>
            )}
            <tr className="total-row">
              <td colSpan={2}>Total Amount</td>
              <td style={{ textAlign: 'right' }}>{voucher.total.toLocaleString('en-PK')}</td>
            </tr>
          </tbody>
        </table>

        <div className="kdoc-row">
          <span className="kdoc-label">Amount in Words:</span>
          <span className="kdoc-value">
            <strong>{amountInWords(voucher.total)}</strong>
          </span>
        </div>

        <div className="kdoc-row" style={{ marginTop: 10 }}>
          <span className="kdoc-label">Payment Method:</span>
          <span className="kdoc-value">☐ Cash&emsp;☐ Bank Transfer&emsp;☐ Online</span>
        </div>
        <div className="kdoc-row">
          <span className="kdoc-label">Received By:</span>
          <span className="kdoc-value">&nbsp;</span>
        </div>

        <div className="kdoc-note">
          <strong>NOTES:</strong>
          <br />
          1. Keep this voucher for future reference.
          <br />
          2. Fees once paid are non-refundable (as per policy).
        </div>

        <div className="kdoc-sign">
          <div>
            <div className="line">Received By</div>
          </div>
          <div>
            <div className="line">Accounts Officer</div>
          </div>
        </div>
      </DocumentShell>
    </>
  );
}
