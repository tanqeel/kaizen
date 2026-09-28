'use client';

/**
 * Standalone print-document builders for ID cards and certificates.
 * Same pattern as app/(app)/fees/[id]/_components/challan.ts: each builder
 * opens a print-ready document in a new window (no app chrome leaks in) and
 * auto-triggers the browser print dialog — the user can print or save as PDF.
 *
 * NEVER invent data here: every value comes from the caller (live DB rows).
 * Fields with no source data render as blank manual-fill lines.
 */

export interface PrintSchool {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
}

export interface StudentIdCardData {
  name: string;
  admissionNo: string;
  classLabel: string;
  dob: string | null;
  parentName: string | null;
  parentPhone: string | null;
  issueDate: string;
}

export interface StaffIdCardData {
  name: string;
  employeeId: string;
  designation: string;
  phone: string | null;
  issueDate: string;
}

export interface LeavingCertificateData {
  certNo: string;
  name: string;
  admissionNo: string;
  dob: string | null;
  parentName: string | null;
  parentRelation: string | null;
  classLabel: string;
  sessionLabel: string | null;
  sessionStart: string | null;
  issueDate: string;
}

export interface CharacterCertificateData {
  certNo: string;
  name: string;
  admissionNo: string;
  parentName: string | null;
  classLabel: string;
  sessionLabel: string | null;
  issueDate: string;
  pronoun: string; // 'his' | 'her' | 'his/her'
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function openPrintWindow(title: string, css: string, body: string): void {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>` +
      `<style>${css}</style></head><body>${body}` +
      `<script>window.onload = () => window.print();</script></body></html>`,
  );
  w.document.close();
}

const BASE_CSS = `
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 16px; }
`;

/* ── ID cards (CR80: 85.6 × 54 mm) ───────────────────────────────────────── */

const ID_CARD_CSS =
  BASE_CSS +
  `
  .card {
    width: 85.6mm; height: 54mm; max-width: 100%;
    border: 1.5px solid #111; border-radius: 2mm; overflow: hidden;
    display: flex; flex-direction: column; page-break-inside: avoid;
  }
  .chead { background: #0f3d2e; color: #fff; padding: 1.6mm 3mm; display: flex; align-items: center; gap: 2.5mm; }
  .chead img { width: 8mm; height: 8mm; object-fit: contain; background: #fff; border-radius: 1mm; flex-shrink: 0; }
  .chead h2 { font-size: 10.5pt; margin: 0; line-height: 1.15; }
  .chead .smeta { font-size: 6.5pt; opacity: .85; margin-top: .4mm; line-height: 1.25; }
  .cbody { flex: 1; display: flex; gap: 3mm; padding: 2.4mm 3mm; min-height: 0; }
  .photo {
    width: 20mm; height: 24mm; flex-shrink: 0;
    border: 1px dashed #777; border-radius: 1mm;
    display: flex; align-items: center; justify-content: center;
    font-size: 7pt; color: #777; text-transform: uppercase; letter-spacing: .08em;
    background: #f4f4f4;
  }
  .cinfo { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 1mm; }
  .cinfo .pname { font-size: 10.5pt; font-weight: bold; margin: 0 0 .6mm; line-height: 1.2; word-break: break-word; }
  .crow { display: flex; font-size: 7.5pt; line-height: 1.35; gap: 1.5mm; }
  .crow .k { color: #555; flex-shrink: 0; min-width: 15mm; }
  .crow .v { font-weight: bold; word-break: break-word; }
  .cfoot {
    border-top: 1px solid #111; padding: 1.6mm 3mm;
    display: flex; justify-content: space-between; align-items: flex-end;
    font-size: 7pt;
  }
  .sig { text-align: center; }
  .sig .line { width: 30mm; border-top: 1px solid #111; margin-bottom: .6mm; height: 5mm; }
  @media print {
    body { padding: 0; }
    @page { margin: 8mm; }
  }
`;

function idCardShell(
  school: PrintSchool,
  photoBox: string,
  infoRows: string,
  footLeft: string,
  sigLabel: string,
): string {
  const logo = school.logoUrl ? `<img src="${esc(school.logoUrl)}" alt="School logo">` : '';
  const smeta = [school.address, school.phone].filter((s): s is string => !!s).map(esc).join(' · ');
  return `
  <div class="card">
    <div class="chead">
      ${logo}
      <div>
        <h2>${esc(school.name)}</h2>
        ${smeta ? `<div class="smeta">${smeta}</div>` : ''}
      </div>
    </div>
    <div class="cbody">
      <div class="photo">${photoBox}</div>
      <div class="cinfo">${infoRows}</div>
    </div>
    <div class="cfoot">
      <div>${footLeft}</div>
      <div class="sig"><div class="line"></div>${esc(sigLabel)}</div>
    </div>
  </div>`;
}

function idRow(label: string, value: string | null): string {
  return `<div class="crow"><span class="k">${esc(label)}</span><span class="v">${value ? esc(value) : '—'}</span></div>`;
}

export function printStudentIdCard(school: PrintSchool, c: StudentIdCardData): void {
  const parent = [c.parentName, c.parentPhone].filter(Boolean).join(' · ');
  const body = idCardShell(
    school,
    'Photo',
    `<p class="pname">${esc(c.name)}</p>` +
      idRow('Adm No', c.admissionNo) +
      idRow('Class', c.classLabel) +
      idRow('DOB', c.dob) +
      idRow('Parent', parent || null),
    `Issued: ${esc(c.issueDate)}`,
    'Authorised signature',
  );
  openPrintWindow(`Student ID Card — ${c.name}`, ID_CARD_CSS, body);
}

export function printStaffIdCard(school: PrintSchool, c: StaffIdCardData): void {
  const body = idCardShell(
    school,
    'Photo',
    `<p class="pname">${esc(c.name)}</p>` +
      idRow('Employee ID', c.employeeId) +
      idRow('Designation', c.designation) +
      idRow('Phone', c.phone),
    `Issued: ${esc(c.issueDate)}`,
    'Authorised signature',
  );
  openPrintWindow(`Staff ID Card — ${c.name}`, ID_CARD_CSS, body);
}

/* ── Certificates (A4 letterhead) ────────────────────────────────────────── */

const CERT_CSS =
  BASE_CSS +
  `
  .cert { max-width: 100%; page-break-inside: avoid; }
  .lhead { text-align: center; border-bottom: 3px double #111; padding-bottom: 10px; margin-bottom: 8px; }
  .lhead img { width: 56px; height: 56px; object-fit: contain; margin-bottom: 4px; }
  .lhead h1 { font-family: Georgia, 'Times New Roman', serif; font-size: 26px; margin: 0; letter-spacing: .02em; }
  .lhead .smeta { font-size: 12px; color: #444; margin-top: 4px; }
  .ctitle {
    text-align: center; font-family: Georgia, 'Times New Roman', serif;
    font-size: 20px; letter-spacing: .18em; text-transform: uppercase;
    margin: 26px 0 6px;
  }
  .csub { text-align: center; font-size: 12px; color: #555; margin-bottom: 20px; }
  .meta { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 18px; }
  .cbody { font-size: 14px; line-height: 2.1; text-align: justify; }
  .cbody b { font-weight: bold; }
  .fill { display: inline-block; min-width: 55mm; border-bottom: 1px solid #111; }
  .fill.long { min-width: 100%; }
  .sigs { display: flex; justify-content: space-between; gap: 32px; margin-top: 64px; }
  .sig { text-align: center; font-size: 12px; color: #333; flex: 1; }
  .sig .line { border-top: 1px solid #111; height: 56px; margin-bottom: 6px; }
  .note { margin-top: 28px; font-size: 11px; color: #555; border-top: 1px dashed #999; padding-top: 8px; }
  @media print {
    body { padding: 0; }
    @page { size: A4; margin: 16mm; }
  }
`;

function certLetterhead(school: PrintSchool): string {
  const logo = school.logoUrl ? `<img src="${esc(school.logoUrl)}" alt="School logo"><br>` : '';
  const smeta = [school.address, school.phone, school.email].filter((s): s is string => !!s).map(esc).join(' · ');
  return `
  <div class="lhead">
    ${logo}
    <h1>${esc(school.name)}</h1>
    ${smeta ? `<div class="smeta">${smeta}</div>` : ''}
  </div>`;
}

export function printLeavingCertificate(school: PrintSchool, c: LeavingCertificateData): void {
  const guardian = c.parentName
    ? `son/daughter of <b>${esc(c.parentName)}</b>${c.parentRelation ? ` (${esc(c.parentRelation)})` : ''}`
    : `son/daughter of <b><span class="fill"></span></b>`;
  const studiedFrom = c.sessionLabel
    ? `the academic session <b>${esc(c.sessionLabel)}</b>${c.sessionStart ? ` (${esc(c.sessionStart)})` : ''}`
    : `<b><span class="fill"></span></b>`;
  const body = `
  <div class="cert">
    ${certLetterhead(school)}
    <div class="ctitle">School Leaving Certificate</div>
    <div class="csub">This is to certify the following</div>
    <div class="meta">
      <div>Certificate No: <b>${esc(c.certNo)}</b></div>
      <div>Date of Issue: <b>${esc(c.issueDate)}</b></div>
    </div>
    <div class="cbody">
      <p>
        This is to certify that <b>${esc(c.name)}</b>, ${guardian},
        Admission No <b>${esc(c.admissionNo)}</b>${c.dob ? `, born on <b>${esc(c.dob)}</b>` : ''},
        was a bonafide student of this school and studied in Class <b>${esc(c.classLabel)}</b>
        from ${studiedFrom} to <b>${esc(c.issueDate)}</b>.
      </p>
      <p>
        Conduct during the stay at this institution: <span class="fill long"></span>
      </p>
      <p>
        Reason for leaving: <span class="fill long"></span>
      </p>
      <p>
        We wish ${esc(c.name)} success in future endeavours.
      </p>
    </div>
    <div class="sigs">
      <div class="sig"><div class="line"></div>Class Teacher</div>
      <div class="sig"><div class="line"></div>Principal</div>
    </div>
    <div class="note">
      Note: Conduct and reason-for-leaving fields are left blank for completion by the school office.
      Nothing is pre-filled beyond the student's official record.
    </div>
  </div>`;
  openPrintWindow(`Leaving Certificate — ${c.name}`, CERT_CSS, body);
}

export function printCharacterCertificate(school: PrintSchool, c: CharacterCertificateData): void {
  const body = `
  <div class="cert">
    ${certLetterhead(school)}
    <div class="ctitle">Character Certificate</div>
    <div class="csub">This is to certify the following</div>
    <div class="meta">
      <div>Certificate No: <b>${esc(c.certNo)}</b></div>
      <div>Date of Issue: <b>${esc(c.issueDate)}</b></div>
    </div>
    <div class="cbody">
      <p>
        This is to certify that <b>${esc(c.name)}</b>,
        ${c.parentName ? `son/daughter of <b>${esc(c.parentName)}</b>,` : `son/daughter of <b><span class="fill"></span></b>,`}
        Admission No <b>${esc(c.admissionNo)}</b>,
        was a bonafide student of this school in Class <b>${esc(c.classLabel)}</b>
        ${c.sessionLabel ? `during the academic session <b>${esc(c.sessionLabel)}</b>` : ''}.
      </p>
      <p>
        To the best of our knowledge, ${esc(c.pronoun)} moral character and conduct during
        ${esc(c.pronoun)} stay at this institution were:
        <span class="fill long"></span>
      </p>
      <p>
        Remarks (if any): <span class="fill long"></span>
      </p>
    </div>
    <div class="sigs">
      <div class="sig"><div class="line"></div>Class Teacher</div>
      <div class="sig"><div class="line"></div>Principal</div>
    </div>
    <div class="note">
      Note: Character, conduct and remarks fields are left blank for completion by the school office.
      Nothing is pre-filled beyond the student's official record.
    </div>
  </div>`;
  openPrintWindow(`Character Certificate — ${c.name}`, CERT_CSS, body);
}
