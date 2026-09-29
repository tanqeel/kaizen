'use client';

import { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Icon } from '@/components/icons';
import { printStudentIdCard, type PrintSchool, type StudentIdCardData } from '@/lib/print-docs';

function Row({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="flex gap-1.5 text-[7.5pt] leading-snug">
      <span className="w-[15mm] shrink-0 font-semibold text-amber-300">{k}</span>
      <span className="min-w-0 font-bold break-words text-white">{v ?? '—'}</span>
    </div>
  );
}

/** Renders a print preview of the student ID card with print/download buttons. */
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
              className="relative flex shrink-0 flex-col overflow-hidden rounded-[2.5mm] text-white"
              style={{
                width: '85.6mm',
                height: '54mm',
                maxWidth: '100%',
                background: 'linear-gradient(135deg, #1b2a4a 0%, #243b63 100%)',
                boxShadow: '0 2px 8px rgba(0,0,0,.15)',
              }}
            >
              {/* gold bottom bar */}
              <div
                className="absolute right-0 bottom-0 left-0"
                style={{ height: '2.5mm', background: 'linear-gradient(90deg, #d4a017, #f0c420, #d4a017)' }}
              />
              <div className="flex items-center gap-2.5 px-3 pt-[2mm] pb-[1.5mm]">
                {school.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={school.logoUrl} alt="School logo" className="h-9 w-9 shrink-0 rounded-[1.5mm] bg-white object-contain p-0.5" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-[11pt] leading-tight font-bold tracking-wide">{school.name}</p>
                  {[school.address, school.phone].filter(Boolean).length > 0 && (
                    <p className="truncate text-[6.5pt] opacity-80">
                      {[school.address, school.phone].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <p className="mt-0.5 text-[6pt] tracking-[0.14em] text-amber-300 uppercase">Student Identity Card</p>
                </div>
              </div>
              <div className="flex flex-1 gap-3 px-3 pt-[1.5mm] pb-[2.5mm]">
                <div className="flex h-[24mm] w-[20mm] shrink-0 items-center justify-center overflow-hidden rounded-[1.5mm] border-[1.5px] border-amber-300 bg-white/10 text-[7pt] tracking-widest text-white/60 uppercase">
                  {card.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.photoUrl} alt={`${card.name} photo`} className="h-full w-full object-cover" />
                  ) : (
                    'Photo'
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                  <p className="text-[11pt] leading-tight font-bold break-words text-white">{card.name}</p>
                  <Row k="Adm No" v={card.admissionNo} />
                  <Row k="Class" v={card.classLabel} />
                  <Row k="DOB" v={card.dob} />
                  <Row k="Parent" v={parent || null} />
                </div>
              </div>
              <div className="flex items-end justify-between px-3 pb-[3.5mm] text-[6.5pt] text-white/75">
                <span>Issued: {card.issueDate}</span>
                <span className="text-center">
                  <span className="mb-0.5 block h-4 w-[28mm] border-t border-white/60" />
                  Authorised signature
                </span>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={print}>
              <Icon name="printer" size={16} /> {opened ? 'Print again' : 'Print ID card'}
            </Button>
            <Button variant="secondary" onClick={print}>
              <Icon name="download" size={16} /> Download / Save as PDF
            </Button>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Opens the printable ID card (85.6 × 54&nbsp;mm) in a new window — use your browser&apos;s print
            dialog to print it or choose “Save as PDF” to download.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
