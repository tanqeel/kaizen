'use client';

import { DocumentShell, DocRow } from '@/components/print/DocumentShell';
import { PrintButton } from '../_print-button';

interface Props {
  school: { name: string; address: string | null; phone: string | null; email: string | null };
  card: {
    termName: string;
    studentName: string;
    fatherName: string | null;
    grade: string;
    section: string;
    rollNo: string;
    studentId: string;
    photoUrl: string | null;
    papers: Array<{ subject: string; date: string; time: string; room: string }>;
  };
}

export function AdmitCardDoc({ school, card }: Props) {
  return (
    <>
      <PrintButton />
      <DocumentShell
        title="Examination Admit Card"
        subtitle={card.termName}
        schoolName={school.name}
        schoolAddress={school.address ?? undefined}
        schoolPhone={school.phone ?? undefined}
        schoolEmail={school.email ?? undefined}
      >
        <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <DocRow label="Student Name" value={card.studentName} />
            <DocRow label="Father's Name" value={card.fatherName ?? '—'} />
            <DocRow label="Class" value={card.grade} />
            <DocRow label="Section" value={card.section} />
            <DocRow label="Roll No" value={card.rollNo} />
            <DocRow label="Student ID" value={card.studentId} />
          </div>
          <div style={{ textAlign: 'center' }}>
            {card.photoUrl ? (
              <img src={card.photoUrl} alt={card.studentName} className="kdoc-photo" />
            ) : (
              <div className="kdoc-photo-placeholder">Photo</div>
            )}
          </div>
        </div>

        <table className="kdoc-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Date</th>
              <th>Time</th>
              <th>Room No.</th>
            </tr>
          </thead>
          <tbody>
            {card.papers.map((p, i) => (
              <tr key={i}>
                <td>{p.subject}</td>
                <td>{p.date}</td>
                <td>{p.time}</td>
                <td>{p.room}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="kdoc-note">
          <strong>Important Instructions:</strong>
          <br />
          1. Bring this Admit Card to the examination hall.
          <br />
          2. Carry stationery (pen, pencil, ruler, etc).
          <br />
          3. Mobile phones are strictly not allowed.
          <br />
          4. Follow all examination rules and instructions.
        </div>

        <div className="kdoc-sign">
          <div>
            <div className="line">Student Signature</div>
          </div>
          <div>
            <div className="line">Controller of Examinations</div>
          </div>
        </div>
      </DocumentShell>
    </>
  );
}
