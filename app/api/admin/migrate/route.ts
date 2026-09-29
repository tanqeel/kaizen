import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';

/**
 * POST /api/admin/migrate — applies schema changes idempotently.
 * SUPER_ADMIN only. One-time use.
 */
export async function POST() {
  try {
    const auth = await apiUser('admin.manage');
    if (auth.error) return auth.error;

    const results: string[] = [];

    const run = async (label: string, sql: string) => {
      try {
        await prisma.$executeRawUnsafe(sql);
        results.push(`OK: ${label}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('already exists') || msg.includes('duplicate')) {
          results.push(`SKIP: ${label} (exists)`);
        } else {
          results.push(`FAIL: ${label} — ${msg.slice(0, 300)}`);
        }
      }
    };

    await run('AccountStatus enum', `CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'VERIFICATION_REQUIRED', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'LOCKED', 'REJECTED', 'DEACTIVATED', 'GRADUATED', 'TRANSFERRED')`);
    await run('StaffType enum', `CREATE TYPE "StaffType" AS ENUM ('TEACHING', 'ACCOUNTANT', 'OFFICE', 'SECURITY', 'PEON', 'SANITARY', 'OTHER')`);
    await run('Role.ADMIN', `ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ADMIN'`);
    await run('User.kaizenId', `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "kaizenId" TEXT`);
    await run('User.status', `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE'`);
    await run('User.forcePasswordReset', `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "forcePasswordReset" BOOLEAN NOT NULL DEFAULT false`);
    await run('StaffMember.staffType', `ALTER TABLE "StaffMember" ADD COLUMN IF NOT EXISTS "staffType" "StaffType" NOT NULL DEFAULT 'OTHER'`);
    await run('AuditLog table', `CREATE TABLE IF NOT EXISTS "AuditLog" ("id" TEXT NOT NULL PRIMARY KEY, "schoolId" TEXT NOT NULL, "actorId" TEXT, "action" TEXT NOT NULL, "targetType" TEXT, "targetId" TEXT, "result" TEXT NOT NULL DEFAULT 'ALLOWED', "detail" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await run('RegistrationRequest table', `CREATE TABLE IF NOT EXISTS "RegistrationRequest" ("id" TEXT NOT NULL PRIMARY KEY, "schoolId" TEXT NOT NULL, "fullName" TEXT NOT NULL, "accountType" TEXT NOT NULL, "phone" TEXT NOT NULL, "email" TEXT, "admissionNo" TEXT, "gradeId" TEXT, "sectionId" TEXT, "guardianName" TEXT, "guardianPhone" TEXT, "notes" TEXT, "status" TEXT NOT NULL DEFAULT 'PENDING', "decidedById" TEXT, "decidedAt" TIMESTAMP(3), "createdUserId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await run('IntelligenceInsight table', `CREATE TABLE IF NOT EXISTS "IntelligenceInsight" ("id" TEXT NOT NULL PRIMARY KEY, "schoolId" TEXT NOT NULL, "category" TEXT NOT NULL, "title" TEXT NOT NULL, "explanation" TEXT NOT NULL, "evidence" TEXT, "period" TEXT, "confidence" TEXT NOT NULL DEFAULT 'MEDIUM', "suggestedAction" TEXT, "status" TEXT NOT NULL DEFAULT 'NEW', "reviewedById" TEXT, "reviewedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);

    return NextResponse.json({ ok: true, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack?.slice(0, 500) : '';
    return NextResponse.json({ ok: false, error: msg, stack }, { status: 500 });
  }
}
