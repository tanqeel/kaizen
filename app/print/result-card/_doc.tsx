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
    studentId: string;
    session: string;
    photoUrl: string | null;
    subjects: Array<{ name: string; total: number; obtained: number; grade: string }>;
    totalMarks: number;
    obtainedMarks: number;
    percentage: string;
    overallGrade: string;
    position: string;
    remarks: string;
  };
}

export function ResultCardDoc({ school, card }: Props) {
  return (
    <>
      <PrintButton />
      <DocumentShell
        title="Result Card"
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
            <DocRow label="Student ID" value={card.studentId} />
            <DocRow label="Session" value={card.session} />
          </div>
          <div>
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
              <th style={{ width: 50 }}>S.No</th>
              <th>Subject</th>
              <th style={{ textAlign: 'right' }}>Total Marks</th>
              <th style={{ textAlign: 'right' }}>Obtained Marks</th>
              <th style={{ width: 70, textAlign: 'center' }}>Grade</th>
            </tr>
          </thead>
          <tbody>
            {card.subjects.map((s, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{s.name}</td>
                <td style={{ textAlign: 'right' }}>{s.total}</td>
                <td style={{ textAlign: 'right' }}>{s.obtained}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.grade}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td colSpan={2}>Total</td>
              <td style={{ textAlign: 'right' }}>{card.totalMarks}</td>
              <td style={{ textAlign: 'right' }}>{card.obtainedMarks}</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div
          style={{
            display: 'flex',
            gap: 12,
            marginTop: 12,
          }}
        >
          {[
            { label: 'Percentage', value: card.percentage },
            { label: 'Grade', value: card.overallGrade },
            { label: 'Position', value: card.position },
          ].map((b) => (
            <div
              key={b.label}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '8px',
                background: '#f1f5f9',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 600 }}>{b.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#1b2a5e' }}>{b.value}</div>
            </div>
          ))}
        </div>

        <div className="kdoc-row" style={{ marginTop: 12 }}>
          <span className="kdoc-label">Remarks:</span>
          <span className="kdoc-value">{card.remarks}</span>
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
