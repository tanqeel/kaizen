import type { Role } from '@prisma/client';
import { forbidden } from 'next/navigation';

export type Permission =
  | 'dashboard.view'
  | 'students.manage'
  | 'students.view'
  | 'attendance.view'
  | 'attendance.gate'
  | 'attendance.period'
  | 'attendance.conflicts'
  | 'academics.manage'
  | 'academics.view'
  | 'exams.manage'
  | 'exams.view'
  | 'finance.manage'
  | 'finance.view'
  | 'comms.manage'
  | 'staff.manage'
  | 'users.manage'
  | 'biometric.manage'
  | 'biometric.use'
  | 'ai.use'
  | 'admin.manage'
  | 'portal.view'
  | 'diary.view'
  | 'diary.manage'
  | 'notices.view'
  | 'materials.view'
  | 'materials.manage'
  | 'notifications.view'
  | 'admissions.view'
  | 'admissions.manage'
  | 'leave.view'
  | 'leave.manage'
  | 'staff.attendance.view'
  | 'staff.attendance.manage'
  | 'my.attendance.view'
  | 'events.view'
  | 'events.manage'
  | 'liveclasses.view'
  | 'liveclasses.manage'
  | 'payroll.view'
  | 'payroll.manage'
  | 'expenses.request'
  | 'expenses.approve';

const ALL: Role[] = ['SUPER_ADMIN', 'PRINCIPAL', 'ADMIN', 'TEACHER', 'STAFF', 'PARENT', 'STUDENT'];

// ADMIN = operational manager: all principal permissions except super-admin-only actions.
const ADMIN_OPS: Role[] = ['SUPER_ADMIN', 'PRINCIPAL', 'ADMIN'];

const MATRIX: Record<Permission, Role[]> = {
  'dashboard.view': ALL,
  'students.manage': ADMIN_OPS,
  'students.view': ['SUPER_ADMIN', 'PRINCIPAL', 'ADMIN', 'TEACHER', 'STAFF'],
  'attendance.view': ['SUPER_ADMIN', 'PRINCIPAL', 'ADMIN', 'TEACHER', 'STAFF'],
  'attendance.gate': ['SUPER_ADMIN', 'PRINCIPAL', 'ADMIN', 'STAFF'],
  'attendance.period': ['SUPER_ADMIN', 'PRINCIPAL', 'ADMIN', 'TEACHER'],
  'attendance.conflicts': ADMIN_OPS,
  'academics.manage': ADMIN_OPS,
  'academics.view': ALL,
  'exams.manage': ['SUPER_ADMIN', 'PRINCIPAL', 'ADMIN', 'TEACHER'],
  'exams.view': ['SUPER_ADMIN', 'PRINCIPAL', 'ADMIN', 'TEACHER', 'PARENT', 'STUDENT'],
  'finance.manage': ADMIN_OPS,
  'finance.view': ['SUPER_ADMIN', 'PRINCIPAL', 'ADMIN', 'STAFF', 'PARENT'],
  'comms.manage': ['SUPER_ADMIN', 'PRINCIPAL', 'ADMIN', 'STAFF'],
  'staff.manage': ADMIN_OPS,
  'users.manage': ADMIN_OPS,
  'biometric.manage': ADMIN_OPS,
  'biometric.use': ['SUPER_ADMIN', 'PRINCIPAL', 'ADMIN', 'STAFF'],
  'ai.use': ALL,
  'admin.manage': ['SUPER_ADMIN'],
  'portal.view': ['PARENT'],
  'diary.view': ALL,
  'diary.manage': ['SUPER_ADMIN', 'PRINCIPAL', 'ADMIN', 'TEACHER'],
  'notices.view': ALL,
  'materials.view': ALL,
  'materials.manage': ['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER'],
  'notifications.view': ALL,
  'admissions.view': ['SUPER_ADMIN', 'PRINCIPAL', 'STAFF'],
  'admissions.manage': ['SUPER_ADMIN', 'PRINCIPAL'],
  'leave.view': ALL,
  'leave.manage': ['SUPER_ADMIN', 'PRINCIPAL'],
  'staff.attendance.view': ['SUPER_ADMIN', 'PRINCIPAL', 'STAFF'],
  'staff.attendance.manage': ['SUPER_ADMIN', 'PRINCIPAL', 'STAFF'],
  'my.attendance.view': ['TEACHER', 'STAFF'],
  'events.view': ALL,
  'events.manage': ['SUPER_ADMIN', 'PRINCIPAL', 'STAFF'],
  'liveclasses.view': ALL,
  'liveclasses.manage': ['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER'],
  'payroll.view': ['SUPER_ADMIN', 'PRINCIPAL', 'STAFF', 'TEACHER'],
  'payroll.manage': ADMIN_OPS,
  'expenses.request': ['SUPER_ADMIN', 'PRINCIPAL', 'STAFF', 'TEACHER'],
  'expenses.approve': ['SUPER_ADMIN', 'PRINCIPAL'],
};

export function can(role: Role, perm: Permission): boolean {
  return MATRIX[perm].includes(role);
}

/** Throws a 403-tagged error when the role lacks the permission. */
export function requirePermission(role: Role, perm: Permission): void {
  if (!can(role, perm)) {
    const err = new Error(`Forbidden: ${role} lacks ${perm}`) as Error & { status?: number };
    err.status = 403;
    throw err;
  }
}

/**
 * Page-level guard: renders the app's 403 page (app/forbidden.tsx) when the
 * role lacks the permission. Call after requireUser() in server components.
 */
export function requirePagePermission(role: Role, perm: Permission): void {
  if (!can(role, perm)) forbidden();
}

export type NavItem = { href: string; label: string; perm: Permission; hideFor?: Role[] };

/** Sidebar navigation. Items are filtered by role at render time. */
export const NAV_ITEMS: NavItem[] = [
  // Parents live in "My Children" — the generic Dashboard duplicates it, so hide it for them.
  { href: '/', label: 'Dashboard', perm: 'dashboard.view', hideFor: ['PARENT'] },
  { href: '/portal', label: 'My Children', perm: 'portal.view' },
  { href: '/students', label: 'Students', perm: 'students.view' },
  { href: '/attendance', label: 'Attendance', perm: 'attendance.view' },
  { href: '/academics', label: 'Academics', perm: 'academics.view' },
  { href: '/diary', label: 'Class Diary', perm: 'diary.view' },
  { href: '/notices', label: 'Notices', perm: 'notices.view' },
  { href: '/materials', label: 'Study Material', perm: 'materials.view' },
  { href: '/timetable', label: 'Timetable', perm: 'academics.view' },
  { href: '/notifications', label: 'Notifications', perm: 'notifications.view' },
  { href: '/admissions', label: 'Admissions', perm: 'admissions.view' },
  { href: '/leave', label: 'Leave', perm: 'leave.view' },
  { href: '/staff/attendance', label: 'Staff Attendance', perm: 'staff.attendance.view' },
  { href: '/my-attendance', label: 'My Attendance', perm: 'my.attendance.view', hideFor: ['SUPER_ADMIN', 'PRINCIPAL', 'ADMIN'] },
  { href: '/intelligence', label: 'Intelligence', perm: 'users.manage' },
  { href: '/audit-log', label: 'Audit Log', perm: 'users.manage' },
  { href: '/registrations', label: 'Registrations', perm: 'users.manage' },
  { href: '/users', label: 'Users', perm: 'users.manage' },
  { href: '/security', label: 'Security', perm: 'dashboard.view' },
  { href: '/events', label: 'Events', perm: 'events.view' },
  { href: '/live-classes', label: 'Live Classes', perm: 'liveclasses.view' },
  { href: '/payroll', label: 'Payroll', perm: 'payroll.view' },
  { href: '/expenses', label: 'Expenses', perm: 'finance.manage' },
  { href: '/exams', label: 'Exams & Results', perm: 'exams.view' },
  { href: '/fees', label: 'Fees', perm: 'finance.view' },
  { href: '/comms', label: 'Notices & SMS', perm: 'comms.manage' },
  { href: '/biometric', label: 'Biometric', perm: 'biometric.use' },
  { href: '/ai', label: 'Kaizen AI', perm: 'ai.use' },
  { href: '/staff', label: 'Staff', perm: 'staff.manage' },
  { href: '/admin', label: 'Admin', perm: 'admin.manage' },
];
