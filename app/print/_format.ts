/** PKR amount in words (Pakistani numbering: lakh/crore). Pure — safe for client. */
export function amountInWords(n: number): string {
  if (!Number.isFinite(n)) return '';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function under1000(x: number): string {
    let s = '';
    if (x >= 100) { s += ones[Math.floor(x / 100)] + ' Hundred '; x %= 100; }
    if (x >= 20) { s += tens[Math.floor(x / 10)] + ' '; x %= 10; }
    if (x > 0) s += ones[x] + ' ';
    return s.trim();
  }
  if (n === 0) return 'Zero Rupees Only';
  let out = '';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = Math.floor(n % 1000);
  if (crore) out += under1000(crore) + ' Crore ';
  if (lakh) out += under1000(lakh) + ' Lakh ';
  if (thousand) out += under1000(thousand) + ' Thousand ';
  if (rest) out += under1000(rest) + ' ';
  return out.trim() + ' Rupees Only';
}
