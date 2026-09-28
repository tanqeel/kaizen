'use client';

import { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Table, TBody, TD, TH, THead, TRow } from '@/components/ui';
import { Icon } from '@/components/icons';
import { printFeeChallan, type ChallanVoucher } from '../../_components/challan';

/** Renders a challan preview with a print/download button (opens the 3-copy challan). */
export function ChallanPrinter({
  schoolName, schoolAddress, schoolPhone, voucher,
}: {
  schoolName: string;
  schoolAddress?: string | null;
  schoolPhone?: string | null;
  voucher: ChallanVoucher;
}) {
  const [opened, setOpened] = useState(false);
  const print = () => {
    printFeeChallan({ name: schoolName, address: schoolAddress, phone: schoolPhone }, voucher);
    setOpened(true);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Fee challan — {voucher.monthLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Student</dt><dd className="font-semibold">{voucher.student.name}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Admission No</dt><dd className="font-semibold">{voucher.student.admissionNo}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Class</dt><dd className="font-semibold">{voucher.student.classLabel}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Challan No</dt><dd className="tnum font-semibold">{voucher.challanNo}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Due date</dt><dd className="tnum font-semibold">{voucher.dueDate}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Status</dt><dd className="font-semibold">{voucher.status}</dd></div>
          </dl>
          <div className="mt-4">
            <Table>
              <THead><TRow><TH>Particulars</TH><TH>Amount</TH></TRow></THead>
              <TBody>
                {voucher.lines.map((l, i) => (
                  <TRow key={i}><TD>{l.head}</TD><TD className="tnum">Rs. {l.amount.toLocaleString('en-PK')}</TD></TRow>
                ))}
                {voucher.discountAmount > 0 && (
                  <TRow><TD>Discount</TD><TD className="tnum">− Rs. {voucher.discountAmount.toLocaleString('en-PK')}</TD></TRow>
                )}
                {voucher.fineAmount > 0 && (
                  <TRow><TD>Late fine</TD><TD className="tnum">Rs. {voucher.fineAmount.toLocaleString('en-PK')}</TD></TRow>
                )}
                <TRow><TD className="font-bold">Total payable</TD><TD className="tnum font-bold">Rs. {voucher.payable.toLocaleString('en-PK')}</TD></TRow>
              </TBody>
            </Table>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={print}>
              <Icon name="printer" size={16} /> {opened ? 'Print again' : 'Print challan (Bank / School / Student copies)'}
            </Button>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Opens the printable 3-copy challan in a new window — print it or save as PDF to download.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
