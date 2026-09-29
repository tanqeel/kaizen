'use client';

import { DocumentShell } from '@/components/print/DocumentShell';
import { PrintButton } from '../_print-button';

interface Props {
  school: { name: string; address: string | null; phone: string | null; email: string | null };
  table: {
    session: string;
    grade: string;
    section: string;
    days: string[];
    rows: Array<{ time: string; cells: string[] }>;
  };
}

export function TimetableDoc({ school, table }: Props) {
  return (
    <>
      <PrintButton />
      <DocumentShell
        title="Class Time Table"
        schoolName={school.name}
        schoolAddress={school.address ?? undefined}
        schoolPhone={school.phone ?? undefined}
        schoolEmail={school.email ?? undefined}
      >
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <p style={{ fontWeight: 700, fontSize: '11pt', color: '#1b2a5e', margin: '4px 0' }}>
            Session: {table.session}
          </p>
          <p style={{ fontWeight: 700, fontSize: '11pt', margin: '4px 0' }}>
            Class: {table.grade} &emsp; Section: {table.section}
          </p>
        </div>

        <table className="kdoc-table" style={{ fontSize: '8.5pt' }}>
          <thead>
            <tr>
              <th style={{ width: 110 }}>Time</th>
              {table.days.map((d) => (
                <th key={d} style={{ textAlign: 'center' }}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{r.time}</td>
                {r.cells.map((c, j) => (
                  <td key={j} style={{ textAlign: 'center' }}>{c || '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="kdoc-note">
          <strong>Notes:</strong>
          <br />
          1. Timetable is subject to change.
          <br />
          2. Students must follow the latest schedule on the portal.
          <br />
          3. Be punctual for all classes.
        </div>

        <div className="kdoc-sign">
          <div>
            <div className="line">Class Teacher</div>
          </div>
          <div>
            <div className="line">Principal</div>
          </div>
        </div>
      </DocumentShell>
    </>
  );
}
