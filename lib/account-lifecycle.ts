import type { AccountStatus } from '@prisma/client';

/**
 * Centralized account lifecycle state machine.
 *
 * Every status transition must go through `canTransition` — no API should
 * set User.status directly. This guarantees:
 * - PENDING accounts can't log in (must activate via link first)
 * - SUSPENDED/LOCKED/DEACTIVATED accounts are blocked everywhere
 * - Transitions are auditable and intentional
 */

type Transition = { from: AccountStatus[]; reason: string };

/**
 * Allowed transitions. `from` lists the statuses this transition can start from.
 * Any transition not listed here is rejected.
 */
const TRANSITIONS: Record<AccountStatus, Transition> = {
  PENDING: { from: [], reason: 'Initial state for new accounts awaiting activation' },
  VERIFICATION_REQUIRED: { from: ['PENDING'], reason: 'Pending documents/verification' },
  APPROVED: { from: ['PENDING', 'VERIFICATION_REQUIRED'], reason: 'Approved, awaiting activation' },
  ACTIVE: { from: ['PENDING', 'APPROVED', 'VERIFICATION_REQUIRED', 'SUSPENDED', 'LOCKED'], reason: 'Activated or reinstated' },
  SUSPENDED: { from: ['ACTIVE'], reason: 'Temporarily suspended by admin' },
  LOCKED: { from: ['ACTIVE', 'SUSPENDED'], reason: 'Locked for security' },
  REJECTED: { from: ['PENDING', 'VERIFICATION_REQUIRED'], reason: 'Registration rejected' },
  DEACTIVATED: { from: ['ACTIVE', 'SUSPENDED', 'LOCKED'], reason: 'Permanently deactivated' },
  GRADUATED: { from: ['ACTIVE'], reason: 'Student graduated' },
  TRANSFERRED: { from: ['ACTIVE'], reason: 'Student transferred out' },
};

/**
 * Returns true if transitioning from `from` to `to` is allowed.
 */
export function canTransition(from: AccountStatus, to: AccountStatus): boolean {
  if (from === to) return true; // No-op is always fine.
  return TRANSITIONS[to]?.from.includes(from) ?? false;
}

/**
 * Statuses that are allowed to sign in.
 * PENDING must activate first; SUSPENDED/LOCKED/DEACTIVATED/REJECTED are blocked.
 */
const LOGIN_ALLOWED: AccountStatus[] = ['ACTIVE', 'APPROVED', 'VERIFICATION_REQUIRED'];

/**
 * Returns true if a user with this status may start a session.
 */
export function canLogin(status: AccountStatus): boolean {
  return LOGIN_ALLOWED.includes(status);
}

/**
 * Human-readable explanation for a blocked login.
 */
export function loginBlockedReason(status: AccountStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Your account is pending activation. Please use the activation link sent to you.';
    case 'SUSPENDED':
      return 'Your account has been suspended. Please contact the school office.';
    case 'LOCKED':
      return 'Your account has been locked for security. Please contact the school office.';
    case 'REJECTED':
      return 'Your registration was not approved. Please contact the school office.';
    case 'DEACTIVATED':
      return 'This account has been deactivated.';
    case 'GRADUATED':
      return 'This student account has been graduated.';
    case 'TRANSFERRED':
      return 'This student has been transferred.';
    default:
      return 'Your account cannot sign in right now.';
  }
}

/**
 * Validates a status change. Throws an Error if the transition is not allowed.
 * Call this before any prisma.user.update involving `status`.
 */
export function assertTransition(from: AccountStatus, to: AccountStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid account status transition: ${from} → ${to}`);
  }
}
