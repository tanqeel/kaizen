'use client';

import { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Table, TBody, TD, TH, THead, TRow } from '@/components/ui';
import { Icon } from '@/components/icons';
import { printPayslip, type PayslipPrintData } from '../../_components/payslip';

/** Payslip preview card with a print/download button (opens the 2-copy slip). */
export function PayslipPrinter({
  schoolName,
  schoolAddress,
  schoolPhone,
  slip,
}: {
  schoolName: string;
  schoolAddress?: string | null;
  schoolPhone?: string | null;
  slip: PayslipPrintData;
}) {
  const [opened, setOpened] = useState(false);
  const print = () => {
    printPayslip({ name: schoolName, address: schoolAddress, phone: schoolPhone }, slip);
    setOpened(true);
  };

  const pkr = (n: number) => `Rs. ${n.toLocaleString('en-PK')}`;

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Salary payslip — {slip.monthLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Employee</dt><dd className="font-semibold">{slip.person.name}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Role</dt><dd className="font-semibold">{slip.person.role}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Employee ID</dt><dd className="font-semibold">{slip.person.employeeId}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Payslip No</dt><dd className="tnum font-semibold">{slip.slipNo}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Generated</dt><dd className="tnum font-semibold">{slip.generatedAt}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Status</dt><dd className="font-semibold">{slip.status}</dd></div>
          </dl>
          <div className="mt-4">
            <Table>
              <THead><TRow><TH>Particulars</TH><TH>Amount</TH></TRow></THead>
              <TBody>
                <TRow><TD>Basic salary</TD><TD className="tnum">{pkr(slip.baseSalary)}</TD></TRow>
                {slip.allowances > 0 && (
                  <TRow><TD>Allowances</TD><TD className="tnum">{pkr(slip.allowances)}</TD></TRow>
                )}
                <TRow><TD className="font-semibold">Gross earnings</TD><TD className="tnum font-semibold">{pkr(slip.baseSalary + slip.allowances)}</TD></TRow>
                {slip.deductions > 0 && (
                  <TRow><TD>Deductions</TD><TD className="tnum">− {pkr(slip.deductions)}</TD></TRow>
                )}
                <TRow><TD className="font-bold">Net pay</TD><TD className="tnum font-bold">{pkr(slip.netPay)}</TD></TRow>
              </TBody>
            </Table>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={print} className="min-h-[44px]">
              <Icon name="printer" size={16} /> {opened ? 'Print again' : 'Print payslip (Employee / Office copies)'}
            </Button>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Opens the printable 2-copy payslip in a new window — print it or save as PDF to download.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
