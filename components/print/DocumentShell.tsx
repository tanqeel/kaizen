import type { ReactNode } from 'react';

/**
 * Shared KAIZEN print-document shell — navy + gold design system.
 * Used by all 8 official documents: ID card, admission form, fee voucher,
 * exam admit card, date sheet, result card, class timetable, salary slip.
 *
 * Print via window.print() — the shell hides app chrome and forces
 * exact colors. Keep content inside <DocumentShell> print-safe
 * (no interactive elements).
 */

export const KAIZEN_NAVY = '#1b2a5e';
export const KAIZEN_GOLD = '#c9a227';
export const KAIZEN_GOLD_LIGHT = '#e8d189';

export function KaizenShield({ size = 44 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M24 2 42 9v13c0 11.5-7.6 19.6-18 24C13.6 41.6 6 33.5 6 22V9l18-7z"
        fill={KAIZEN_NAVY}
        stroke={KAIZEN_GOLD}
        strokeWidth="2.5"
      />
      <path
        d="M24 6.5 37.5 11.5V22c0 9.3-6 15.9-13.5 19.7C16.5 37.9 10.5 31.3 10.5 22V11.5L24 6.5z"
        fill="none"
        stroke={KAIZEN_GOLD}
        strokeWidth="1"
        opacity="0.6"
      />
      {/* open book */}
      <path
        d="M14 19c3-1.5 6.5-1.5 10 0 3.5-1.5 7-1.5 10 0v11c-3-1.5-6.5-1.5-10 0-3.5-1.5-7-1.5-10 0V19z"
        fill={KAIZEN_GOLD}
        opacity="0.95"
      />
      <path d="M24 17.5V30.5" stroke={KAIZEN_NAVY} strokeWidth="1.4" />
      <path
        d="M16 21.5c2-.8 4-.8 6 0M16 24.5c2-.8 4-.8 6 0M26 21.5c2-.8 4-.8 6 0M26 24.5c2-.8 4-.8 6 0"
        stroke={KAIZEN_NAVY}
        strokeWidth="1"
        opacity="0.7"
      />
    </svg>
  );
}

interface DocumentShellProps {
  title: string;
  subtitle?: string;
  formNo?: string;
  session?: string;
  schoolName?: string;
  schoolAddress?: string;
  schoolPhone?: string;
  schoolEmail?: string;
  children: ReactNode;
  footerLeft?: string;
  footerCenter?: string;
  footerRight?: string;
}

/**
 * Full-page document shell: navy/gold header band, watermark, content, footer.
 */
export function DocumentShell({
  title,
  subtitle,
  formNo,
  session,
  schoolName = 'Kaizen Model School',
  schoolAddress = 'Rohillanwali, District Muzaffargarh, Punjab',
  schoolPhone = '+92 300 1234567',
  schoolEmail = 'info@kaizen.edu.pk',
  children,
  footerLeft = 'Discipline',
  footerCenter = 'Knowledge',
  footerRight = 'Growth',
}: DocumentShellProps) {
  return (
    <div className="kaizen-doc">
      {/* Header band */}
      <div className="kaizen-doc-header">
        <div className="kaizen-doc-header-inner">
          <KaizenShield size={52} />
          <div className="kaizen-doc-brand">
            <p className="kaizen-doc-brand-name">KAIZEN</p>
            <p className="kaizen-doc-brand-sub">School Management System</p>
            <p className="kaizen-doc-tagline">Empowering Education | Building Brighter Futures</p>
          </div>
          <div className="kaizen-doc-school">
            <p>{schoolAddress}</p>
            <p>{schoolPhone}</p>
            <p>{schoolEmail}</p>
            <p>www.kaizen.edu.pk</p>
          </div>
        </div>
        <div className="kaizen-doc-gold-bar" />
      </div>

      {/* Title block */}
      <div className="kaizen-doc-titleblock">
        <h1 className="kaizen-doc-title">{title}</h1>
        {subtitle && <p className="kaizen-doc-subtitle">{subtitle}</p>}
        {(formNo || session) && (
          <div className="kaizen-doc-meta">
            {formNo && <span>Form No: {formNo}</span>}
            {session && <span>Session: {session}</span>}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="kaizen-doc-body">{children}</div>

      {/* Footer */}
      <div className="kaizen-doc-footer">
        <span>{footerLeft}</span>
        <span className="kaizen-doc-footer-dot">|</span>
        <span>{footerCenter}</span>
        <span className="kaizen-doc-footer-dot">|</span>
        <span>{footerRight}</span>
      </div>

      <style>{`
        .kaizen-doc {
          position: relative;
          width: 210mm;
          min-height: 290mm;
          margin: 0 auto;
          background: #fff;
          color: #1e293b;
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
          font-size: 11pt;
          line-height: 1.45;
          overflow: hidden;
        }
        .kaizen-doc::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 50% 30%, rgba(27,42,94,0.05) 0%, transparent 60%);
          pointer-events: none;
        }
        .kaizen-doc-header {
          background: linear-gradient(135deg, ${KAIZEN_NAVY} 0%, #243a7d 60%, #2d4a99 100%);
          color: #fff;
          position: relative;
          overflow: hidden;
        }
        .kaizen-doc-header::after {
          content: '';
          position: absolute;
          right: -40px;
          top: -40px;
          width: 220px;
          height: 220px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(201,162,39,0.25) 0%, transparent 70%);
        }
        .kaizen-doc-header-inner {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 18px 28px 14px;
          position: relative;
          z-index: 1;
        }
        .kaizen-doc-brand { flex: 1; }
        .kaizen-doc-brand-name {
          font-size: 22pt;
          font-weight: 800;
          letter-spacing: 2px;
          margin: 0;
          color: #fff;
        }
        .kaizen-doc-brand-sub {
          font-size: 10pt;
          font-weight: 600;
          margin: 0;
          color: ${KAIZEN_GOLD_LIGHT};
        }
        .kaizen-doc-tagline {
          font-size: 8pt;
          font-style: italic;
          margin: 2px 0 0;
          color: rgba(255,255,255,0.75);
        }
        .kaizen-doc-school {
          text-align: right;
          font-size: 7.5pt;
          line-height: 1.5;
          color: rgba(255,255,255,0.85);
        }
        .kaizen-doc-school p { margin: 0; }
        .kaizen-doc-gold-bar {
          height: 6px;
          background: linear-gradient(90deg, ${KAIZEN_GOLD} 0%, ${KAIZEN_GOLD_LIGHT} 50%, ${KAIZEN_GOLD} 100%);
        }
        .kaizen-doc-titleblock {
          text-align: center;
          padding: 16px 28px 8px;
        }
        .kaizen-doc-title {
          display: inline-block;
          font-size: 16pt;
          font-weight: 800;
          color: ${KAIZEN_NAVY};
          margin: 0;
          padding: 6px 32px;
          border-bottom: 3px solid ${KAIZEN_GOLD};
        }
        .kaizen-doc-subtitle {
          display: inline-block;
          margin: 6px 0 0;
          padding: 3px 18px;
          font-size: 10pt;
          font-weight: 700;
          color: #fff;
          background: ${KAIZEN_NAVY};
          border-radius: 999px;
        }
        .kaizen-doc-meta {
          display: flex;
          justify-content: space-between;
          margin-top: 10px;
          font-size: 9pt;
          color: #475569;
        }
        .kaizen-doc-body {
          padding: 12px 28px 20px;
          position: relative;
          z-index: 1;
        }
        .kaizen-doc-footer {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          padding: 10px;
          background: ${KAIZEN_NAVY};
          color: ${KAIZEN_GOLD_LIGHT};
          font-size: 9pt;
          font-weight: 600;
          letter-spacing: 1px;
        }
        .kaizen-doc-footer-dot { color: ${KAIZEN_GOLD}; }
        /* Field rows */
        .kdoc-row { display: flex; gap: 8px; margin: 5px 0; font-size: 10pt; }
        .kdoc-label { min-width: 130px; font-weight: 600; color: #334155; }
        .kdoc-value { flex: 1; border-bottom: 1px dotted #94a3b8; padding-bottom: 1px; }
        .kdoc-section {
          margin: 14px 0 8px;
          padding: 5px 12px;
          background: ${KAIZEN_NAVY};
          color: #fff;
          font-size: 10pt;
          font-weight: 700;
          border-radius: 4px;
        }
        .kdoc-section span {
          display: inline-block;
          background: ${KAIZEN_GOLD};
          color: ${KAIZEN_NAVY};
          border-radius: 4px;
          padding: 0 8px;
          margin-right: 8px;
          font-size: 9pt;
        }
        .kdoc-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9.5pt; }
        .kdoc-table th {
          background: ${KAIZEN_NAVY};
          color: #fff;
          padding: 7px 10px;
          text-align: left;
          font-weight: 700;
        }
        .kdoc-table th:first-child { border-radius: 6px 0 0 0; }
        .kdoc-table th:last-child { border-radius: 0 6px 0 0; }
        .kdoc-table td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
        .kdoc-table tr:nth-child(even) td { background: #f8fafc; }
        .kdoc-table tr.total-row td {
          background: #fef9e7;
          font-weight: 800;
          border-top: 2px solid ${KAIZEN_GOLD};
          border-bottom: none;
        }
        .kdoc-sign {
          display: flex;
          justify-content: space-between;
          margin-top: 36px;
          font-size: 9pt;
          color: #475569;
        }
        .kdoc-sign div { text-align: center; min-width: 160px; }
        .kdoc-sign .line {
          border-top: 1px solid #334155;
          padding-top: 4px;
          margin-top: 28px;
          font-weight: 600;
        }
        .kdoc-note {
          margin-top: 12px;
          padding: 10px 14px;
          background: #f8fafc;
          border-left: 3px solid ${KAIZEN_GOLD};
          font-size: 9pt;
          color: #475569;
        }
        .kdoc-photo {
          width: 110px;
          height: 130px;
          object-fit: cover;
          border: 2px solid ${KAIZEN_GOLD};
          border-radius: 6px;
          background: #f1f5f9;
        }
        .kdoc-photo-placeholder {
          width: 110px;
          height: 130px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px dashed #94a3b8;
          border-radius: 6px;
          background: #f8fafc;
          color: #94a3b8;
          font-size: 8pt;
          text-align: center;
        }
        @media print {
          @page { size: A4; margin: 0; }
          body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .kaizen-doc { width: 100%; min-height: auto; margin: 0; }
          .no-print { display: none !important; }
          .kdoc-page-break { margin-top: 0; page-break-before: always; }
        }
        .kdoc-page-break { margin-top: 32px; }
      `}</style>
    </div>
  );
}

/** Small helper: label/value row used across documents. */
export function DocRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="kdoc-row">
      <span className="kdoc-label">{label}</span>
      <span className="kdoc-value">{value ?? '—'}</span>
    </div>
  );
}

/** Section heading bar used across documents. */
export function DocSection({ num, title }: { num: string; title: string }) {
  return (
    <div className="kdoc-section">
      <span>{num}</span>
      {title}
    </div>
  );
}
