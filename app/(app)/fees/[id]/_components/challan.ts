'use client';

/**
 * Opens a standalone, print-ready 3-copy fee challan (Bank / School / Student)
 * in a new window. The window auto-triggers the browser print dialog; the user
 * can print or save as PDF. No app chrome leaks in.
 */

export interface ChallanLine {
  head: string;
  amount: number;
}

export interface ChallanVoucher {
  challanNo: string;
  monthLabel: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  discountAmount: number;
  fineAmount: number;
  payable: number;
  paid: number;
  balance: number;
  status: string;
  lines: ChallanLine[];
  student: { name: string; admissionNo: string; classLabel: string };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Pakistani numbering: thousand, lakh, crore.
function amountInWords(n: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x: number): string => (x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : ''));
  const three = (x: number): string => {
    const h = Math.floor(x / 100);
    const r = x % 100;
    return (h ? ones[h] + ' Hundred' + (r ? ' ' : '') : '') + (r ? two(r) : '');
  };
  if (n === 0) return 'Zero';
  let out = '';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thou = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (crore) out += three(crore) + ' Crore ';
  if (lakh) out += two(lakh) + ' Lakh ';
  if (thou) out += two(thou) + ' Thousand ';
  if (rest) out += three(rest);
  return out.trim();
}

export function printFeeChallan(
  school: { name: string; address?: string | null; phone?: string | null },
  v: ChallanVoucher,
): void {
  const pkr = (n: number) => `Rs. ${n.toLocaleString('en-PK')}`;
  const copies = ['Bank Copy', 'School Copy', 'Student Copy'];

  const lineRows = v.lines
    .map((l) => `<tr><td>${esc(l.head)}</td><td class="num">${pkr(l.amount)}</td></tr>`)
    .join('');

  const copy = (label: string) => `
  <div class="copy">
    <div class="chead">
      <div>
        <h2>${esc(school.name)}</h2>
        <div class="smeta">${esc(school.address ?? '')}${school.phone ? ' · ' + esc(school.phone) : ''}</div>
      </div>
      <div class="clabel">${label}</div>
    </div>
    <div class="cbody">
    <div class="cmeta">
      <div><span>Challan No</span><b>${esc(v.challanNo)}</b></div>
      <div><span>Fee Month</span><b>${esc(v.monthLabel)}</b></div>
      <div><span>Due Date</span><b>${esc(v.dueDate)}</b></div>
    </div>
    <div class="cmeta">
      <div><span>Student</span><b>${esc(v.student.name)}</b></div>
      <div><span>Admission No</span><b>${esc(v.student.admissionNo)}</b></div>
      <div><span>Class</span><b>${esc(v.student.classLabel)}</b></div>
    </div>
    <table>
      <thead><tr><th>Particulars</th><th class="num">Amount</th></tr></thead>
      <tbody>${lineRows}</tbody>
      <tfoot>
        ${v.discountAmount > 0 ? `<tr><td>Discount</td><td class="num">− ${pkr(v.discountAmount)}</td></tr>` : ''}
        ${v.fineAmount > 0 ? `<tr><td>Late fine</td><td class="num">${pkr(v.fineAmount)}</td></tr>` : ''}
        <tr class="total"><td>Total payable</td><td class="num">${pkr(v.payable)}</td></tr>
      </tfoot>
    </table>
    <div class="words">Rupees ${esc(amountInWords(v.payable))} Only</div>
    <div class="stamps">
      <div class="stamp">Bank stamp &amp; signature</div>
      <div class="stamp">Received by (school office)</div>
    </div>
    <div class="foot">Payable at the school office or designated bank before the due date. Please keep the student copy as proof of payment.</div>
    </div>
  </div>`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Fee Challan ${esc(v.challanNo)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 16px; }
  .copy { border: 2px solid #1b2a4a; padding: 0; margin-bottom: 18px; page-break-inside: avoid; overflow: hidden; }
  .chead { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #1b2a4a 0%, #243b63 100%); color: #fff; padding: 12px 22px; border-bottom: 3px solid #d4a017; }
  h2 { font-size: 20px; margin: 0; letter-spacing: .02em; }
  .smeta { font-size: 12px; color: rgba(255,255,255,.8); margin-top: 2px; }
  .clabel { font-size: 13px; font-weight: bold; text-transform: uppercase; background: #d4a017; color: #1b2a4a; padding: 6px 12px; white-space: nowrap; border-radius: 4px; }
  .cbody { padding: 18px 22px; }
  .cmeta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px 16px; font-size: 13px; margin-bottom: 10px; }
  .cmeta span { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #555; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 6px 0 10px; }
  th, td { text-align: left; padding: 6px 4px; border-bottom: 1px solid #bbb; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #1b2a4a; background: #f8f6f0; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tfoot .total td { font-weight: bold; font-size: 15px; border-bottom: none; border-top: 2px solid #1b2a4a; }
  .words { font-size: 13px; font-weight: bold; border: 1px dashed #888; padding: 6px 10px; margin-bottom: 12px; }
  .stamps { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 18px 0 8px; }
  .stamp { border-top: 1px solid #111; padding-top: 4px; font-size: 11px; color: #444; height: 44px; }
  .foot { font-size: 10px; color: #555; border-top: 1px dashed #999; padding-top: 6px; }
  @media print { body { padding: 0; } }
</style></head><body>
${copies.map(copy).join('')}
<script>window.onload = () => window.print();</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
