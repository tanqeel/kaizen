import { prisma } from './db';

/**
 * Audit logging for sensitive actions.
 * Never logs passwords, tokens, or secrets — only action metadata.
 */

interface AuditEntry {
  schoolId: string;
  actorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  result?: 'ALLOWED' | 'DENIED';
  detail?: string | null;
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        schoolId: entry.schoolId,
        actorId: entry.actorId ?? null,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        result: entry.result ?? 'ALLOWED',
        detail: entry.detail ?? null,
      },
    });
  } catch {
    // Audit logging must never break the main operation.
  }
}
