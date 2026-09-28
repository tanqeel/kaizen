import type { AnnouncementAudience } from '@prisma/client';

/**
 * Client-safe communication helpers (no prisma imports — safe to import
 * from 'use client' components). Server-only recipient resolution lives in
 * ./comms, which re-exports everything here.
 */

export const ANNOUNCEMENT_AUDIENCES: AnnouncementAudience[] = ['ALL', 'PARENTS', 'STAFF', 'TEACHERS', 'GRADES'];

export const AUDIENCE_LABELS: Record<AnnouncementAudience, string> = {
  ALL: 'all active users',
  PARENTS: 'parents of active students',
  STAFF: 'staff members',
  TEACHERS: 'teachers',
  GRADES: 'parents of students in the selected grade',
};

/** Substitute {{variable}} placeholders in an SMS template body. */
export function renderTemplate(body: string, vars: Record<string, string | number>): string {
  return body.replace(/{{\s*([\w]+)\s*}}/g, (_m, key: string) =>
    key in vars ? String(vars[key]) : `{{${key}}}`,
  );
}

/** Variables supported by SMS templates. */
export const TEMPLATE_VARIABLES: Array<{ key: string; description: string }> = [
  { key: 'student_name', description: "The student's full name" },
  { key: 'amount', description: 'An amount in PKR, e.g. Rs. 4,800' },
  { key: 'date', description: "Today's date, e.g. 28 Sep 2026" },
];
