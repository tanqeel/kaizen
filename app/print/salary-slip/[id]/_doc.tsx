'use client';

import { DocumentShell, DocRow } from '@/components/print/DocumentShell';
import { PrintButton } from '../../_print-button';
import { amountInWords } from '../../_format';

interface Props {
  school: { name: string; address: string | null; phone: string | null; email: string | null };
  slip: {
    monthLabel: string;
    employeeName: string;
    employeeId: string;
    designation: string;
    department: string;
    doj: string;
    bankAccount: string;
    earnings: Array<{ label: string; amount: number }>;
    totalEarnings: number;
    deductions: Array<{ label: string; amount: number }>;
    totalDeductions: number;
    netPay: number;
    status: string;
  };
}

export function SalarySlipDoc({ school, slip }: Props) {
  return (
    <>
      <PrintButton />
      <DocumentShell
        title="Salary Slip"
        subtitle={`Month: ${slip.monthLabel}`}
        schoolName={school.name}
        schoolAddress={school.address ?? undefined}
        schoolPhone={school.phone ?? undefined}
        schoolEmail={school.email ?? undefined}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px', marginTop: 8 }}>
          <DocRow label="Employee Name" value={slip.employeeName} />
          <DocRow label="Employee ID" value={slip.employeeId} />
          <DocRow label="Designation" value={slip.designation} />
          <DocRow label="Department" value={slip.department} />
          <DocRow label="DOJ" value={slip.doj} />
          <DocRow label="Bank Account" value={slip.bankAccount} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
          <table className="kdoc-table">
            <thead>
              <tr>
                <th colSpan={2}>Earnings (PKR)</th>
              </tr>
            </thead>
            <tbody>
              {slip.earnings.map((e, i) => (
                <tr key={i}>
                  <td>{e.label}</td>
                  <td style={{ textAlign: 'right' }}>{e.amount.toLocaleString('en-PK')}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td>Total Earnings</td>
                <td style={{ textAlign: 'right' }}>{slip.totalEarnings.toLocaleString('en-PK')}</td>
              </tr>
            </tbody>
          </table>
          <table className="kdoc-table">
            <thead>
              <tr>
                <th colSpan={2}>Deductions (PKR)</th>
              </tr>
            </thead>
            <tbody>
              {slip.deductions.map((d, i) => (
                <tr key={i}>
                  <td>{d.label}</td>
                  <td style={{ textAlign: 'right' }}>{d.amount.toLocaleString('en-PK')}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td>Total Deductions</td>
                <td style={{ textAlign: 'right' }}>{slip.totalDeductions.toLocaleString('en-PK')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          style={{
            marginTop: 12,
            padding: '10px 16px',
            background: '#1b2a5e',
            borderRadius: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#fff',
          }}
        >
          <span style={{ fontWeight: 700 }}>Net Salary (PKR)</span>
          <span style={{ fontWeight: 800, fontSize: '15pt', color: '#e8d189' }}>
            {slip.netPay.toLocaleString('en-PK')}
          </span>
        </div>

        <div className="kdoc-row" style={{ marginTop: 10 }}>
          <span className="kdoc-label">Amount in Words:</span>
          <span className="kdoc-value">
            <strong>{amountInWords(slip.netPay)}</strong>
          </span>
        </div>
        <div className="kdoc-row">
          <span className="kdoc-label">Status:</span>
          <span className="kdoc-value">{slip.status}</span>
        </div>

        <div className="kdoc-sign">
          <div>
            <div className="line">Employee Signature</div>
          </div>
          <div>
            <div className="line">Accounts Officer</div>
          </div>
        </div>
      </DocumentShell>
    </>
  );
}
