'use client';

/**
 * Opens a standalone, print-ready payslip in a new window.
 * The window auto-triggers the browser print dialog; the user can print
 * or save as PDF. No app chrome leaks in. Same pattern as printFeeChallan.
 */

export interface PayslipPrintData {
  slipNo: string;
  monthLabel: string;
  person: { name: string; role: string; employeeId: string };
  baseSalary: number;
  allowances: number;
  deductions: number;
  netPay: number;
  status: string;
  generatedAt: string;
  paidAt: string | null;
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

export function printPayslip(
  school: { name: string; address?: string | null; phone?: string | null },
  v: PayslipPrintData,
): void {
  const pkr = (n: number) => `Rs. ${n.toLocaleString('en-PK')}`;
  const copies = ['Employee Copy', 'Office Copy'];

  const copy = (label: string) => `
  <div class="copy">
    <div class="chead">
      <div>
        <h2>${esc(school.name)}</h2>
        <div class="smeta">${esc(school.address ?? '')}${school.phone ? ' · ' + esc(school.phone) : ''}</div>
      </div>
      <div class="clabel">${label}</div>
    </div>
    <h3 class="doctitle">Salary Payslip</h3>
    <div class="cmeta">
      <div><span>Payslip No</span><b>${esc(v.slipNo)}</b></div>
      <div><span>Salary Month</span><b>${esc(v.monthLabel)}</b></div>
      <div><span>Status</span><b>${esc(v.status)}</b></div>
    </div>
    <div class="cmeta">
      <div><span>Employee</span><b>${esc(v.person.name)}</b></div>
      <div><span>Role</span><b>${esc(v.person.role)}</b></div>
      <div><span>Employee ID</span><b>${esc(v.person.employeeId)}</b></div>
    </div>
    <table>
      <thead><tr><th>Particulars</th><th class="num">Amount</th></tr></thead>
      <tbody>
        <tr><td>Basic salary</td><td class="num">${pkr(v.baseSalary)}</td></tr>
        ${v.allowances > 0 ? `<tr><td>Allowances</td><td class="num">${pkr(v.allowances)}</td></tr>` : ''}
        <tr><td><b>Gross earnings</b></td><td class="num"><b>${pkr(v.baseSalary + v.allowances)}</b></td></tr>
        ${v.deductions > 0 ? `<tr><td>Deductions</td><td class="num">&minus; ${pkr(v.deductions)}</td></tr>` : ''}
      </tbody>
      <tfoot>
        <tr class="total"><td>Net pay</td><td class="num">${pkr(v.netPay)}</td></tr>
      </tfoot>
    </table>
    <div class="words">Rupees ${esc(amountInWords(v.netPay))} Only</div>
    <div class="cmeta">
      <div><span>Generated</span><b>${esc(v.generatedAt)}</b></div>
      <div><span>Paid</span><b>${esc(v.paidAt ?? '—')}</b></div>
      <div></div>
    </div>
    <div class="stamps">
      <div class="stamp">Prepared by (accounts)</div>
      <div class="stamp">Received by (employee)</div>
    </div>
  </div>`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Payslip ${esc(v.slipNo)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 16px; }
  .copy { border: 2px solid #111; padding: 18px 22px; margin-bottom: 18px; page-break-inside: avoid; }
  .chead { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 12px; }
  h2 { font-size: 20px; margin: 0; }
  .smeta { font-size: 12px; color: #444; margin-top: 2px; }
  .clabel { font-size: 13px; font-weight: bold; text-transform: uppercase; border: 2px solid #111; padding: 4px 10px; white-space: nowrap; }
  .doctitle { font-size: 15px; text-transform: uppercase; letter-spacing: .08em; text-align: center; margin: 4px 0 12px; }
  .cmeta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px 16px; font-size: 13px; margin-bottom: 10px; }
  .cmeta span { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #555; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 6px 0 10px; }
  th, td { text-align: left; padding: 6px 4px; border-bottom: 1px solid #bbb; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #444; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tfoot .total td { font-weight: bold; font-size: 15px; border-bottom: none; border-top: 2px solid #111; }
  .words { font-size: 13px; font-weight: bold; border: 1px dashed #888; padding: 6px 10px; margin-bottom: 12px; }
  .stamps { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 18px 0 8px; }
  .stamp { border-top: 1px solid #111; padding-top: 4px; font-size: 11px; color: #444; height: 44px; }
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
