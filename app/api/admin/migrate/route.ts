import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser } from '@/lib/api-auth';

/**
 * POST /api/admin/migrate — applies the identity/privacy/intelligence schema
 * changes. SUPER_ADMIN only. Idempotent (IF NOT EXISTS everywhere).
 * One-time use: run once after deploy, then this route can be removed.
 */
export async function POST() {
  const auth = await apiUser('admin.manage');
  if (auth.error) return auth.error;

  const statements = [
    `CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'VERIFICATION_REQUIRED', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'LOCKED', 'REJECTED', 'DEACTIVATED', 'GRADUATED', 'TRANSFERRED')`,
    `CREATE TYPE "StaffType" AS ENUM ('TEACHING', 'ACCOUNTANT', 'OFFICE', 'SECURITY', 'PEON', 'SANITARY', 'OTHER')`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "kaizenId" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE'`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "forcePasswordReset" BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "StaffMember" ADD COLUMN IF NOT EXISTS "staffType" "StaffType" NOT NULL DEFAULT 'OTHER'`,
    `CREATE TABLE IF NOT EXISTS "AuditLog" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "schoolId" TEXT NOT NULL,
      "actorId" TEXT,
      "action" TEXT NOT NULL,
      "targetType" TEXT,
      "targetId" TEXT,
      "result" TEXT NOT NULL DEFAULT 'ALLOWED',
      "detail" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "RegistrationRequest" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "schoolId" TEXT NOT NULL,
      "fullName" TEXT NOT NULL,
      "accountType" TEXT NOT NULL,
      "phone" TEXT NOT NULL,
      "email" TEXT,
      "admissionNo" TEXT,
      "gradeId" TEXT,
      "sectionId" TEXT,
      "guardianName" TEXT,
      "guardianPhone" TEXT,
      "notes" TEXT,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "decidedById" TEXT,
      "decidedAt" TIMESTAMP(3),
      "createdUserId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "IntelligenceInsight" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "schoolId" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "explanation" TEXT NOT NULL,
      "evidence" TEXT,
      "period" TEXT,
      "confidence" TEXT NOT NULL DEFAULT 'MEDIUM',
      "suggestedAction" TEXT,
      "status" TEXT NOT NULL DEFAULT 'NEW',
      "reviewedById" TEXT,
      "reviewedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ];

  const results: string[] = [];
  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
      results.push('OK: ' + sql.slice(0, 60));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // "already exists" is fine (idempotent).
      if (msg.includes('already exists')) {
        results.push('SKIP (exists): ' + sql.slice(0, 60));
      } else {
        results.push('ERROR: ' + msg.slice(0, 200));
      }
    }
  }

  // Add ADMIN to Role enum (cannot run in transaction; separate statement).
  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ADMIN'`);
    results.push('OK: Role.ADMIN added');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push(msg.includes('already exists') ? 'SKIP: Role.ADMIN exists' : 'ERROR: ' + msg.slice(0, 200));
  }

  // Unique constraint on kaizenId.
  try {
    await prisma.$executeRawUnsafe(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_kaizenId_key') THEN ALTER TABLE "User" ADD CONSTRAINT "User_kaizenId_key" UNIQUE ("kaizenId"); END IF; END $$`
    );
    results.push('OK: kaizenId unique constraint');
  } catch (e) {
    results.push('ERROR: ' + (e instanceof Error ? e.message.slice(0, 200) : String(e)));
  }

  return NextResponse.json({ ok: true, results });
}
