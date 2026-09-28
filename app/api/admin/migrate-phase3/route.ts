import { NextResponse } from 'next/server';
import { Client } from 'pg';
import { requireUser } from '@/lib/auth';

/**
 * TEMPORARY one-time migration (Phase 3): LeaveRequest, StaffAttendance,
 * Discount, FeePolicy, SchoolEvent, LiveClass + enums.
 * Raw TCP via `pg` — the Neon HTTP driver silently discards DDL.
 * DELETE THIS ROUTE after first successful run. SUPER_ADMIN only.
 */
const DDL = [
  `CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');`,
  `CREATE TYPE "StaffAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LEAVE', 'LATE');`,
  `CREATE TYPE "DiscountType" AS ENUM ('SIBLING', 'STAFF_WARD', 'MERIT', 'NEED_BASED', 'OTHER');`,
  `CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT,
    "teacherId" TEXT,
    "staffMemberId" TEXT,
    "fromDate" TEXT NOT NULL,
    "toDate" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);`,
  `CREATE TABLE "StaffAttendance" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT,
    "staffMemberId" TEXT,
    "date" TEXT NOT NULL,
    "status" "StaffAttendanceStatus" NOT NULL,
    "note" TEXT,
    "markedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id")
);`,
  `CREATE TABLE "Discount" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "percent" INTEGER,
    "amount" INTEGER,
    "reason" TEXT,
    "approvedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);`,
  `CREATE TABLE "FeePolicy" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "fineGraceDays" INTEGER NOT NULL DEFAULT 10,
    "finePerDay" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeePolicy_pkey" PRIMARY KEY ("id")
);`,
  `CREATE TABLE "SchoolEvent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "audience" "AnnouncementAudience" NOT NULL DEFAULT 'ALL',
    "gradeId" TEXT,
    "venue" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolEvent_pkey" PRIMARY KEY ("id")
);`,
  `CREATE TABLE "LiveClass" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meetingUrl" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveClass_pkey" PRIMARY KEY ("id")
);`,
  `CREATE INDEX "LeaveRequest_schoolId_status_idx" ON "LeaveRequest"("schoolId", "status");`,
  `CREATE INDEX "LeaveRequest_studentId_idx" ON "LeaveRequest"("studentId");`,
  `CREATE INDEX "StaffAttendance_schoolId_date_idx" ON "StaffAttendance"("schoolId", "date");`,
  `CREATE UNIQUE INDEX "StaffAttendance_teacherId_staffMemberId_date_key" ON "StaffAttendance"("teacherId", "staffMemberId", "date");`,
  `CREATE INDEX "Discount_studentId_idx" ON "Discount"("studentId");`,
  `CREATE UNIQUE INDEX "FeePolicy_schoolId_key" ON "FeePolicy"("schoolId");`,
  `CREATE INDEX "SchoolEvent_schoolId_date_idx" ON "SchoolEvent"("schoolId", "date");`,
  `CREATE INDEX "LiveClass_schoolId_startsAt_idx" ON "LiveClass"("schoolId", "startsAt");`,
  `CREATE INDEX "LiveClass_sectionId_idx" ON "LiveClass"("sectionId");`,
  `ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
  `ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`,
  `ALTER TABLE "Discount" ADD CONSTRAINT "Discount_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "Discount" ADD CONSTRAINT "Discount_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`,
  `ALTER TABLE "FeePolicy" ADD CONSTRAINT "FeePolicy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "SchoolEvent" ADD CONSTRAINT "SchoolEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "SchoolEvent" ADD CONSTRAINT "SchoolEvent_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
  `ALTER TABLE "SchoolEvent" ADD CONSTRAINT "SchoolEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`,
  `ALTER TABLE "LiveClass" ADD CONSTRAINT "LiveClass_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "LiveClass" ADD CONSTRAINT "LiveClass_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "LiveClass" ADD CONSTRAINT "LiveClass_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
  `ALTER TABLE "LiveClass" ADD CONSTRAINT "LiveClass_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
];

const TABLES = ['LeaveRequest', 'StaffAttendance', 'Discount', 'FeePolicy', 'SchoolEvent', 'LiveClass'];
const TYPES = ['LeaveStatus', 'StaffAttendanceStatus', 'DiscountType'];

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
    const tables = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_name = ANY($1)`, [TABLES]
    );
    const haveTables = new Set(tables.rows.map((r) => r.table_name));
    const types = await client.query(`SELECT typname FROM pg_type WHERE typname = ANY($1)`, [TYPES]);
    const haveTypes = new Set(types.rows.map((r) => r.typname));

    for (const stmt of DDL) {
      const head = stmt.slice(0, 60);
      const typeMatch = head.match(/CREATE TYPE "(\w+)"/);
      if (typeMatch && haveTypes.has(typeMatch[1])) { skipped.push(typeMatch[1]); continue; }
      const tableMatch = head.match(/CREATE TABLE "(\w+)"/);
      if (tableMatch && haveTables.has(tableMatch[1])) { skipped.push(tableMatch[1] + ' table'); continue; }
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
