import { NextResponse } from 'next/server';
import { Client } from 'pg';
import { requireUser } from '@/lib/auth';

/**
 * TEMPORARY one-time migration (Phase 2): StudyMaterial + AdmissionApplication
 * tables, MaterialType/ApplicationStatus enums, NotificationLog.readAt.
 * Raw TCP via `pg` — the Neon HTTP driver silently discards DDL.
 * DELETE THIS ROUTE after first successful run. SUPER_ADMIN only.
 */
const DDL = [
  `CREATE TYPE "MaterialType" AS ENUM ('NOTE', 'WORKSHEET', 'PAST_PAPER', 'VIDEO_LINK', 'AUDIO_LINK')`,
  `CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED')`,
  `ALTER TABLE "NotificationLog" ADD COLUMN "readAt" TIMESTAMP(3)`,
  `CREATE TABLE "StudyMaterial" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "gradeId" TEXT,
    "sectionId" TEXT,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT,
    "type" "MaterialType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudyMaterial_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE "AdmissionApplication" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dob" TIMESTAMP(3),
    "gender" TEXT,
    "gradeId" TEXT NOT NULL,
    "parentName" TEXT NOT NULL,
    "parentPhone" TEXT NOT NULL,
    "address" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdmissionApplication_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX "StudyMaterial_schoolId_subjectId_idx" ON "StudyMaterial"("schoolId", "subjectId")`,
  `CREATE INDEX "StudyMaterial_gradeId_idx" ON "StudyMaterial"("gradeId")`,
  `CREATE INDEX "StudyMaterial_teacherId_idx" ON "StudyMaterial"("teacherId")`,
  `CREATE INDEX "AdmissionApplication_schoolId_status_idx" ON "AdmissionApplication"("schoolId", "status")`,
  `ALTER TABLE "StudyMaterial" ADD CONSTRAINT "StudyMaterial_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "StudyMaterial" ADD CONSTRAINT "StudyMaterial_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "StudyMaterial" ADD CONSTRAINT "StudyMaterial_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  `ALTER TABLE "StudyMaterial" ADD CONSTRAINT "StudyMaterial_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  `ALTER TABLE "StudyMaterial" ADD CONSTRAINT "StudyMaterial_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "AdmissionApplication" ADD CONSTRAINT "AdmissionApplication_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "AdmissionApplication" ADD CONSTRAINT "AdmissionApplication_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
  `ALTER TABLE "AdmissionApplication" ADD CONSTRAINT "AdmissionApplication_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
];

export async function POST() {
  const user = await requireUser().catch(() => null);
  if (!user || user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ error: 'No database URL' }, { status: 500 });

  const client = new Client({ connectionString: url });
  await client.connect();
  const applied: string[] = [];
  const skipped: string[] = [];
  try {
    // Idempotency guards
    const tables = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_name IN ('StudyMaterial','AdmissionApplication')`
    );
    const haveTables = new Set(tables.rows.map((r) => r.table_name));
    const types = await client.query(
      `SELECT typname FROM pg_type WHERE typname IN ('MaterialType','ApplicationStatus')`
    );
    const haveTypes = new Set(types.rows.map((r) => r.typname));
    const cols = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='NotificationLog' AND column_name='readAt'`
    );
    const haveReadAt = cols.rowCount! > 0;

    for (const stmt of DDL) {
      const head = stmt.slice(0, 60);
      if (head.includes('CREATE TYPE "MaterialType"') && haveTypes.has('MaterialType')) { skipped.push('MaterialType'); continue; }
      if (head.includes('CREATE TYPE "ApplicationStatus"') && haveTypes.has('ApplicationStatus')) { skipped.push('ApplicationStatus'); continue; }
      if (head.includes('ADD COLUMN "readAt"') && haveReadAt) { skipped.push('readAt'); continue; }
      if (head.includes('CREATE TABLE "StudyMaterial"') && haveTables.has('StudyMaterial')) { skipped.push('StudyMaterial table'); continue; }
      if (head.includes('CREATE TABLE "AdmissionApplication"') && haveTables.has('AdmissionApplication')) { skipped.push('AdmissionApplication table'); continue; }
      try {
        await client.query(stmt);
        applied.push(head.replace(/\s+/g, ' ').trim());
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/already exists|duplicate/i.test(msg)) skipped.push(head.slice(0, 40) + ' (exists)');
        else throw e;
      }
    }
    return NextResponse.json({ ok: true, applied, skipped });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  } finally {
    await client.end();
  }
}
