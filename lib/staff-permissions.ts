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

const STAFF_TYPE_PERMISSIONS: Record<StaffType, Permission[]> = {
  // Accountant: fees, payroll viewing, expenses.
  ACCOUNTANT: ['finance.manage', 'finance.view', 'payroll.view', 'dashboard.view'],
  // Office staff: admissions, communications, student records.
  OFFICE: [
    'admissions.view', 'comms.manage', 'students.view', 'students.manage',
    'dashboard.view', 'events.manage',
  ],
  // Security: gate operations and biometric devices only.
  SECURITY: ['attendance.gate', 'biometric.use', 'dashboard.view'],
  // Teaching staff (STAFF role): same as TEACHER for classroom work.
  TEACHING: [
    'students.view', 'attendance.view', 'attendance.period',
    'academics.view', 'academics.manage', 'dashboard.view',
  ],
  // Support staff: only their own attendance and dashboard.
  PEON: ['dashboard.view'],
  SANITARY: ['dashboard.view'],
  OTHER: ['dashboard.view'],
};

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

  const allowed = STAFF_TYPE_PERMISSIONS[staff.staffType] ?? [];
  // 'my.attendance.view' is universal for all staff.
  if (perm === 'my.attendance.view') return true;
  return allowed.includes(perm);
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
