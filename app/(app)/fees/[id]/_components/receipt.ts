'use client';

/**
 * Opens a standalone, print-ready payment receipt in a new window.
 * The window auto-triggers the browser print dialog; no app chrome leaks in.
 */

export interface ReceiptPayment {
  amount: number;
  method: string;
  reference: string | null;
  paidAt: string;
  receivedBy: string;
  receiptNo: string;
}

export interface ReceiptVoucher {
  monthLabel: string;
  dueDate: string;
  payable: number;
  paid: number;
  balance: number;
  status: string;
  lines: Array<{ head: string; amount: number }>;
  student: { name: string; admissionNo: string; classLabel: string };
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank Transfer',
  KUICKPAY_1LINK: 'Kuickpay / 1Link',
  JAZZCASH: 'JazzCash',
  EASYPAISA: 'Easypaisa',
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function printPaymentReceipt(schoolName: string, payment: ReceiptPayment, voucher: ReceiptVoucher): void {
  const pkr = (n: number) => `Rs. ${n.toLocaleString('en-PK')}`;
  const when = new Date(payment.paidAt);
  const whenLabel = new Intl.DateTimeFormat('en-PK', {
    timeZone: 'Asia/Karachi', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(when);

  const lineRows = voucher.lines
    .map((l) => `<tr><td>${esc(l.head)}</td><td class="num">${pkr(l.amount)}</td></tr>`)
    .join('');

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Receipt ${esc(payment.receiptNo)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; margin: 0; padding: 32px; }
  .sheet { max-width: 640px; margin: 0 auto; border: 2px solid #111; padding: 28px 32px; }
  h1 { font-size: 22px; margin: 0; } .school { font-size: 14px; color: #444; margin-top: 4px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
  .rno { text-align: right; font-size: 13px; } .rno b { font-size: 16px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; font-size: 14px; margin-bottom: 16px; }
  .meta dt { color: #555; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
  .meta dd { margin: 0 0 8px; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; margin: 8px 0 16px; }
  th, td { text-align: left; padding: 8px 4px; border-bottom: 1px solid #ccc; }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #555; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .total td { font-weight: bold; border-bottom: none; font-size: 16px; }
  .foot { font-size: 12px; color: #555; margin-top: 20px; border-top: 1px dashed #999; padding-top: 10px; }
  @media print { body { padding: 0; } .sheet { border: none; } }
</style></head><body>
<div class="sheet">
  <div class="head">
    <div><h1>Fee Payment Receipt</h1><div class="school">${esc(schoolName)}</div></div>
    <div class="rno"><div>Receipt No</div><b>${esc(payment.receiptNo)}</b><div>${esc(whenLabel)}</div></div>
  </div>
  <dl class="meta">
    <div><dt>Student</dt><dd>${esc(voucher.student.name)}</dd></div>
    <div><dt>Admission No</dt><dd>${esc(voucher.student.admissionNo)}</dd></div>
    <div><dt>Class</dt><dd>${esc(voucher.student.classLabel)}</dd></div>
    <div><dt>Fee Month</dt><dd>${esc(voucher.monthLabel)}</dd></div>
    <div><dt>Payment Method</dt><dd>${esc(METHOD_LABELS[payment.method] ?? payment.method)}</dd></div>
    <div><dt>Reference</dt><dd>${esc(payment.reference ?? '—')}</dd></div>
  </dl>
  <table><thead><tr><th>Fee head</th><th class="num">Amount</th></tr></thead><tbody>
    ${lineRows}
    <tr class="total"><td>Total payable</td><td class="num">${pkr(voucher.payable)}</td></tr>
    <tr><td>Paid (incl. this receipt)</td><td class="num">${pkr(voucher.paid)}</td></tr>
    <tr><td><b>Balance remaining</b></td><td class="num"><b>${pkr(voucher.balance)}</b></td></tr>
  </tbody></table>
  <p><b>Amount received: ${pkr(payment.amount)}</b> — received by ${esc(payment.receivedBy)}.</p>
  <div class="foot">This is a computer-generated receipt. For queries, contact the school office.</div>
</div>
<script>window.onload = () => window.print();</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=720,height=800');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
