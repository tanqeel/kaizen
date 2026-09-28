'use client';

import { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Icon } from '@/components/icons';
import { printStudentIdCard, type PrintSchool, type StudentIdCardData } from '@/lib/print-docs';

function Row({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="flex gap-1.5 text-[7.5pt] leading-snug">
      <span className="w-[15mm] shrink-0 text-slate-500">{k}</span>
      <span className="min-w-0 font-bold break-words text-slate-900">{v ?? '—'}</span>
    </div>
  );
}

/** Renders a print preview of the student ID card with a print button (opens the printable card). */
export function IdCardPrinter({ school, card }: { school: PrintSchool; card: StudentIdCardData }) {
  const [opened, setOpened] = useState(false);
  const print = () => {
    printStudentIdCard(school, card);
    setOpened(true);
  };

  const parent = [card.parentName, card.parentPhone].filter(Boolean).join(' · ');

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Student ID card</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center overflow-x-auto py-2">
            <div
              className="flex shrink-0 flex-col overflow-hidden rounded-md border-[1.5px] border-slate-900 bg-white"
              style={{ width: '85.6mm', height: '54mm', maxWidth: '100%' }}
            >
              <div className="flex items-center gap-2.5 bg-emerald-950 px-3 py-[1.6mm] text-white">
                {school.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={school.logoUrl} alt="School logo" className="h-8 w-8 shrink-0 rounded-sm bg-white object-contain" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-[10.5pt] leading-tight font-bold">{school.name}</p>
                  {[school.address, school.phone].filter(Boolean).length > 0 && (
                    <p className="truncate text-[6.5pt] opacity-85">
                      {[school.address, school.phone].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-1 gap-3 px-3 py-[2.4mm]">
                <div className="flex h-[24mm] w-[20mm] shrink-0 items-center justify-center rounded-sm border border-dashed border-slate-400 bg-slate-100 text-[7pt] tracking-widest text-slate-500 uppercase">
                  Photo
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                  <p className="text-[10.5pt] leading-tight font-bold break-words text-slate-900">{card.name}</p>
                  <Row k="Adm No" v={card.admissionNo} />
                  <Row k="Class" v={card.classLabel} />
                  <Row k="DOB" v={card.dob} />
                  <Row k="Parent" v={parent || null} />
                </div>
              </div>
              <div className="flex items-end justify-between border-t border-slate-900 px-3 py-[1.6mm] text-[7pt] text-slate-700">
                <span>Issued: {card.issueDate}</span>
                <span className="text-center">
                  <span className="mb-0.5 block h-5 w-[30mm] border-t border-slate-900" />
                  Authorised signature
                </span>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={print}>
              <Icon name="printer" size={16} /> {opened ? 'Print again' : 'Print ID card'}
            </Button>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Opens the printable ID card (85.6 × 54&nbsp;mm) in a new window — print it or save as PDF to download.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
