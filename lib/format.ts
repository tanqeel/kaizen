const PKT = 'Asia/Karachi';

/** Rs. 12,500 */
export function pkr(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-PK')}`;
}

/** YYYY-MM-DD in Asia/Karachi */
export function todayPKT(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PKT, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

/** "28 Sep 2026, 6:05 PM" in Asia/Karachi */
export function pktDateTime(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('en-PK', {
    timeZone: PKT, day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(dt);
}

/** "6:05 PM" in Asia/Karachi */
export function pktTime(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('en-PK', {
    timeZone: PKT, hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(dt);
}

/** "28 Sep 2026" in Asia/Karachi */
export function pktDate(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('en-PK', {
    timeZone: PKT, day: 'numeric', month: 'short', year: 'numeric',
  }).format(dt);
}
