'use client';

import { DocumentShell, DocSection } from '@/components/print/DocumentShell';
import { PrintButton } from '../_print-button';

interface Props {
  school: { name: string; address: string | null; phone: string | null; email: string | null };
  formNo: string;
  session: string;
  prefill?: {
    name: string;
    fatherName: string | null;
    grade: string;
  } | null;
}

function Blank({ width = 220 }: { width?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        minWidth: width,
        borderBottom: '1px solid #94a3b8',
        height: '1.1em',
      }}
    />
  );
}

export function AdmissionFormDoc({ school, formNo, session, prefill }: Props) {
  const v = (val: string | null | undefined, w?: number) =>
    val ? <strong>{val}</strong> : <Blank width={w} />;

  return (
    <>
      <PrintButton />
      <DocumentShell
        title="Admission Form"
        formNo={formNo}
        session={session}
        schoolName={school.name}
        schoolAddress={school.address ?? undefined}
        schoolPhone={school.phone ?? undefined}
        schoolEmail={school.email ?? undefined}
      >
        <DocSection num="1" title="Student Information" />
        <div className="kdoc-row">
          <span className="kdoc-label">Full Name:</span>
          <span className="kdoc-value">{v(prefill?.name, 300)}</span>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          <div className="kdoc-row" style={{ flex: 1 }}>
            <span className="kdoc-label">Date of Birth:</span>
            <span className="kdoc-value">
              <Blank width={40} /> / <Blank width={40} /> / <Blank width={60} />
            </span>
          </div>
          <div className="kdoc-row" style={{ flex: 1 }}>
            <span className="kdoc-label">Gender:</span>
            <span className="kdoc-value">☐ Male&emsp;☐ Female</span>
          </div>
        </div>
        <div className="kdoc-row">
          <span className="kdoc-label">Father's Name:</span>
          <span className="kdoc-value">{v(prefill?.fatherName, 300)}</span>
        </div>
        <div className="kdoc-row">
          <span className="kdoc-label">Mother's Name:</span>
          <span className="kdoc-value">
            <Blank width={300} />
          </span>
        </div>
        <div className="kdoc-row">
          <span className="kdoc-label">Previous School:</span>
          <span className="kdoc-value">
            <Blank width={300} />
          </span>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          <div className="kdoc-row" style={{ flex: 1 }}>
            <span className="kdoc-label">Class Applying For:</span>
            <span className="kdoc-value">{v(prefill?.grade, 120)}</span>
          </div>
          <div className="kdoc-row" style={{ flex: 1 }}>
            <span className="kdoc-label">Section:</span>
            <span className="kdoc-value">
              <Blank width={120} />
            </span>
          </div>
        </div>

        <DocSection num="2" title="Contact Information" />
        <div className="kdoc-row">
          <span className="kdoc-label">Address:</span>
          <span className="kdoc-value">
            <Blank width={380} />
          </span>
        </div>
        <div className="kdoc-row">
          <span className="kdoc-label">City:</span>
          <span className="kdoc-value">
            <Blank width={380} />
          </span>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          <div className="kdoc-row" style={{ flex: 1 }}>
            <span className="kdoc-label">Phone (Father):</span>
            <span className="kdoc-value">
              <Blank width={140} />
            </span>
          </div>
          <div className="kdoc-row" style={{ flex: 1 }}>
            <span className="kdoc-label">Phone (Mother):</span>
            <span className="kdoc-value">
              <Blank width={140} />
            </span>
          </div>
        </div>
        <div className="kdoc-row">
          <span className="kdoc-label">Email:</span>
          <span className="kdoc-value">
            <Blank width={300} />
          </span>
        </div>

        <DocSection num="3" title="Documents Checklist" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', fontSize: '10pt' }}>
          {[
            'Birth Certificate',
            'Previous School Result',
            'CNIC (Father/Guardian)',
            'Passport Size Photos',
            'B-Form (if applicable)',
            'Any Other:',
          ].map((d) => (
            <div key={d}>
              ☐ {d} {d === 'Any Other:' && <Blank width={120} />}
            </div>
          ))}
        </div>

        <p style={{ fontSize: '9.5pt', marginTop: 16 }}>
          I hereby confirm that the information provided is correct.
        </p>
        <div className="kdoc-sign">
          <div>
            <div className="line">Parent/Guardian Signature</div>
          </div>
          <div>
            <div className="line">Date: ____ / ____ / ________</div>
          </div>
        </div>
      </DocumentShell>
    </>
  );
}
