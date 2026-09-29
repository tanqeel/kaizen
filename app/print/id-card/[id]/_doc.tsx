'use client';

import { DocumentShell, DocRow } from '@/components/print/DocumentShell';
import { PrintButton } from '../../_print-button';

interface Props {
  school: { name: string; address: string | null; phone: string | null; email: string | null };
  student: {
    name: string;
    admissionNo: string;
    grade: string;
    section: string;
    session: string;
    kaizenId: string | null;
    photoUrl: string | null;
    fatherName: string | null;
  };
}

export function IdCardDoc({ school, student }: Props) {
  return (
    <>
      <PrintButton />
      <DocumentShell
        title="Student ID Card"
        schoolName={school.name}
        schoolAddress={school.address ?? undefined}
        schoolPhone={school.phone ?? undefined}
        schoolEmail={school.email ?? undefined}
        footerLeft="Discipline"
        footerCenter="Knowledge"
        footerRight="Growth"
      >
        <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <DocRow label="Name" value={student.name} />
            <DocRow label="Father's Name" value={student.fatherName ?? '—'} />
            <DocRow label="Class" value={student.grade} />
            <DocRow label="Section" value={student.section} />
            <DocRow label="Roll No" value={student.admissionNo} />
            <DocRow label="Student ID" value={student.kaizenId ?? student.admissionNo} />
            <DocRow label="Session" value={student.session} />
          </div>
          <div style={{ textAlign: 'center' }}>
            {student.photoUrl ? (
              <img src={student.photoUrl} alt={student.name} className="kdoc-photo" />
            ) : (
              <div className="kdoc-photo-placeholder">Photo</div>
            )}
            {/* QR placeholder: encodes the KAIZEN ID */}
            <div style={{ marginTop: 10, fontSize: 8, color: '#64748b' }}>
              ID: {student.kaizenId ?? student.admissionNo}
            </div>
          </div>
        </div>
        <div className="kdoc-sign">
          <div>
            <div className="line">Principal</div>
          </div>
          <div>
            <div className="line">Date of Issue</div>
          </div>
        </div>
        <div className="kdoc-note">
          This card is the property of {school.name}. If found, please return it to the school
          office. Valid for the session printed above.
        </div>
      </DocumentShell>
    </>
  );
}
