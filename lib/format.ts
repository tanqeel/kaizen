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

/** Demo password shown on the login screen. */
export const DEMO_PASSWORD_HINT = 'demo1234';

/** Demo login emails per role. */
export const DEMO_LOGINS: Array<{ role: string; email: string; label: string }> = [
  { role: 'SUPER_ADMIN', email: 'superadmin@kaizen.pk', label: 'Super Admin' },
  { role: 'PRINCIPAL', email: 'principal@kaizen.pk', label: 'Principal' },
  { role: 'TEACHER', email: 'teacher1@kaizen.pk', label: 'Teacher' },
  { role: 'STAFF', email: 'staff1@kaizen.pk', label: 'Staff' },
  { role: 'PARENT', email: 'parent1@kaizen.pk', label: 'Parent' },
  { role: 'STUDENT', email: 'student1@kaizen.pk', label: 'Student' },
];
