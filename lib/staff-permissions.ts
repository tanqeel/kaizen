import { prisma } from './db';
import { can, type Permission } from './rbac';
import type { Role, StaffType } from '@prisma/client';

/**
 * Staff-type-aware permission checking.
 *
 * The STAFF role covers many job types. A security guard must not have
 * accountant permissions just because both are "staff". This enforces
 * job-specific access at the API layer.
 */

/**
 * Permissions every staff member holds regardless of job type: their own
 * dashboard, inbox, notices, leave, events, the AI assistant, and their own
 * payslip (the payroll API scopes non-managers to their own record).
 */
const STAFF_COMMON: Permission[] = [
  'dashboard.view',
  'notices.view',
  'notifications.view',
  'leave.view',
  'events.view',
  'ai.use',
  'payroll.view',
];

const STAFF_TYPE_PERMISSIONS: Record<StaffType, Permission[]> = {
  // Accountant: fees, payroll, expenses — no student/academic records.
  ACCOUNTANT: ['finance.manage', 'finance.view', ...STAFF_COMMON],
  // Office staff: admissions, communications, student records.
  OFFICE: [
    'admissions.view', 'comms.manage', 'students.view',
    'events.manage',
    ...STAFF_COMMON,
  ],
  // Security / gatekeeper: gate operations and biometric devices only.
  SECURITY: ['attendance.view', 'attendance.gate', 'biometric.use', ...STAFF_COMMON],
  // Teaching staff (STAFF role): classroom work — students, attendance,
  // academics, diary, study material, live classes.
  TEACHING: [
    'students.view', 'attendance.view', 'attendance.period',
    'academics.view', 'diary.view', 'materials.view', 'liveclasses.view',
    ...STAFF_COMMON,
  ],
  // Support staff (peon, sanitary, other): personal essentials only —
  // no fees, academics, students, or admissions.
  PEON: [...STAFF_COMMON],
  SANITARY: [...STAFF_COMMON],
  OTHER: [...STAFF_COMMON],
};

/**
 * Pure job-type check (no DB): the role must hold the permission AND the
 * job type must list it. 'my.attendance.view' is universal for all staff.
 */
export function staffTypeAllows(staffType: StaffType, role: Role, perm: Permission): boolean {
  if (!can(role, perm)) return false;
  // 'my.attendance.view' is universal for all staff.
  if (perm === 'my.attendance.view') return true;
  const allowed = STAFF_TYPE_PERMISSIONS[staffType] ?? [];
  return allowed.includes(perm);
}

/**
 * Checks if a user has a permission, accounting for staff job type.
 * For non-STAFF roles, delegates to the standard role check.
 * For STAFF, intersects role permissions with job-type permissions.
 */
export async function canStaff(
  userId: string,
  role: Role,
  perm: Permission,
): Promise<boolean> {
  // Non-staff: standard role check.
  if (role !== 'STAFF') {
    return can(role, perm);
  }

  // Staff: must satisfy BOTH role-level and job-type-level.
  if (!can(role, perm)) return false;

  const staff = await prisma.staffMember.findUnique({
    where: { userId },
    select: { staffType: true },
  });
  if (!staff) return false;

  return staffTypeAllows(staff.staffType, role, perm);
}

/**
 * API guard: returns an error response if the user lacks the permission
 * (accounting for staff job type). Returns null if allowed.
 */
export async function requireStaffPerm(
  userId: string,
  role: Role,
  perm: Permission,
): Promise<{ error: Response } | null> {
  const allowed = await canStaff(userId, role, perm);
  if (!allowed) {
    const { NextResponse } = await import('next/server');
    return {
      error: NextResponse.json(
        { error: 'Access denied: your job role does not include this permission.' },
        { status: 403 },
      ),
    };
  }
  return null;
}
