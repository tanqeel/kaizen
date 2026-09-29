-- Identity, Privacy, Role-Based Access & Self-Improving Intelligence
-- NON-DESTRUCTIVE: only adds columns (nullable or with defaults), new tables,
-- and new enum values. No data is dropped, altered, or reset.

-- ── New enums ──────────────────────────────────────────────────────────────
CREATE TYPE "AccountStatus" AS ENUM (
  'PENDING', 'VERIFICATION_REQUIRED', 'APPROVED', 'ACTIVE',
  'SUSPENDED', 'LOCKED', 'REJECTED', 'DEACTIVATED',
  'GRADUATED', 'TRANSFERRED'
);

CREATE TYPE "StaffType" AS ENUM (
  'TEACHING', 'ACCOUNTANT', 'OFFICE', 'SECURITY',
  'PEON', 'SANITARY', 'OTHER'
);

-- ── Role enum: add ADMIN ───────────────────────────────────────────────────
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
-- If applying via a migration runner that wraps in a transaction, run this
-- statement separately first, then the rest.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ADMIN';

-- ── User: identity columns ─────────────────────────────────────────────────
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "kaizenId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "forcePasswordReset" BOOLEAN NOT NULL DEFAULT false;

-- Unique constraint on kaizenId (nullable-safe: multiple NULLs allowed in PG)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_kaizenId_key'
  ) THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_kaizenId_key" UNIQUE ("kaizenId");
  END IF;
END $$;

-- ── StaffMember: job type ──────────────────────────────────────────────────
ALTER TABLE "StaffMember" ADD COLUMN IF NOT EXISTS "staffType" "StaffType" NOT NULL DEFAULT 'OTHER';

-- ── AuditLog ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "schoolId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "result" TEXT NOT NULL DEFAULT 'ALLOWED',
  "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AuditLog_schoolId_createdAt_idx" ON "AuditLog"("schoolId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- ── RegistrationRequest ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "RegistrationRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "schoolId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "accountType" "Role" NOT NULL,
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegistrationRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RegistrationRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "RegistrationRequest_createdUserId_fkey" FOREIGN KEY ("createdUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "RegistrationRequest_schoolId_status_idx" ON "RegistrationRequest"("schoolId", "status");

-- ── IntelligenceInsight ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "IntelligenceInsight" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntelligenceInsight_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "IntelligenceInsight_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "IntelligenceInsight_schoolId_status_idx" ON "IntelligenceInsight"("schoolId", "status");

-- ── Backfill: existing users get ACTIVE status (default already handles it) ──
-- kaizenId backfill is done by application code on next admin action / dedicated
-- backfill script, NOT here, to guarantee uniqueness safely.
