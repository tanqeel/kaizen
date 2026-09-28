'use client';

import { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Icon } from '@/components/icons';
import { printLeavingCertificate, type PrintSchool, type LeavingCertificateData } from '@/lib/print-docs';

/** Renders a preview of the school leaving certificate with a print button (opens the printable A4 certificate). */
export function LeavingCertPrinter({ school, cert }: { school: PrintSchool; cert: LeavingCertificateData }) {
  const [opened, setOpened] = useState(false);
  const print = () => {
    printLeavingCertificate(school, cert);
    setOpened(true);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>School leaving certificate</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Student</dt><dd className="font-semibold">{cert.name}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Admission No</dt><dd className="font-semibold">{cert.admissionNo}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Class</dt><dd className="font-semibold">{cert.classLabel}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Certificate No</dt><dd className="tnum font-semibold">{cert.certNo}</dd></div>
          </dl>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            The printed certificate certifies enrollment from the academic session{' '}
            <strong>{cert.sessionLabel ?? '—'}</strong> to today. Conduct and reason-for-leaving
            fields are left blank on the printout for the school office to complete by hand — nothing is invented.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={print}>
              <Icon name="printer" size={16} /> {opened ? 'Print again' : 'Print certificate'}
            </Button>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Opens the printable A4 certificate in a new window — print it or save as PDF to download.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
