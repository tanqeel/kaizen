'use client';

import { DocumentShell } from '@/components/print/DocumentShell';
import { PrintButton } from '../_print-button';

interface Props {
  school: { name: string; address: string | null; phone: string | null; email: string | null };
  sheet: {
    termName: string;
    grade: string;
    papers: Array<{ subject: string; date: string; day: string; time: string }>;
  };
}

export function DateSheetDoc({ school, sheet }: Props) {
  return (
    <>
      <PrintButton />
      <DocumentShell
        title="Date Sheet"
        subtitle={sheet.termName}
        schoolName={school.name}
        schoolAddress={school.address ?? undefined}
        schoolPhone={school.phone ?? undefined}
        schoolEmail={school.email ?? undefined}
      >
        <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '12pt', color: '#1b2a5e' }}>
          Class: {sheet.grade}
        </p>

        <table className="kdoc-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Day</th>
              <th>Subject</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {sheet.papers.map((p, i) => (
              <tr key={i}>
                <td>{p.date}</td>
                <td>{p.day}</td>
                <td>{p.subject}</td>
                <td>{p.time}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="kdoc-note">
          <strong>Important Instructions:</strong>
          <br />
          1. Reach the examination center 15 minutes before time.
          <br />
          2. Follow the school examination policy.
          <br />
          3. Any change will be communicated through the school portal.
        </div>

        <div className="kdoc-sign">
          <div>
            <div className="line">Class Teacher</div>
          </div>
          <div>
            <div className="line">Controller of Examinations</div>
          </div>
        </div>
      </DocumentShell>
    </>
  );
}
