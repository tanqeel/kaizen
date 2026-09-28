import { NextResponse } from 'next/server';
import { Client } from 'pg';
import { requireUser } from '@/lib/auth';

/**
 * TEMPORARY one-time migration (Phase 4): Payslip, ExpenseRequest + enums.
 * Raw TCP via `pg` — the Neon HTTP driver silently discards DDL.
 * DELETE THIS ROUTE after first successful run. SUPER_ADMIN only.
 */
const DDL = [
  `CREATE TYPE "PayslipStatus" AS ENUM ('DRAFT', 'GENERATED', 'PAID');`,
  `CREATE TYPE "ExpenseRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');`,
  `CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT,
    "staffMemberId" TEXT,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "baseSalary" INTEGER NOT NULL,
    "allowances" INTEGER NOT NULL DEFAULT 0,
    "deductions" INTEGER NOT NULL DEFAULT 0,
    "netPay" INTEGER NOT NULL,
    "status" "PayslipStatus" NOT NULL DEFAULT 'GENERATED',
    "generatedById" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);`,
  `CREATE TABLE "ExpenseRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" INTEGER NOT NULL,
    "headId" TEXT NOT NULL,
    "status" "ExpenseRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "sourceId" TEXT,
    "expenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseRequest_pkey" PRIMARY KEY ("id")
);`,
  `CREATE INDEX "Payslip_schoolId_year_month_idx" ON "Payslip"("schoolId", "year", "month");`,
  `CREATE INDEX "Payslip_teacherId_idx" ON "Payslip"("teacherId");`,
  `CREATE INDEX "Payslip_staffMemberId_idx" ON "Payslip"("staffMemberId");`,
  `CREATE UNIQUE INDEX "ExpenseRequest_expenseId_key" ON "ExpenseRequest"("expenseId");`,
  `CREATE INDEX "ExpenseRequest_schoolId_status_idx" ON "ExpenseRequest"("schoolId", "status");`,
  `ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`,
  `ALTER TABLE "ExpenseRequest" ADD CONSTRAINT "ExpenseRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "ExpenseRequest" ADD CONSTRAINT "ExpenseRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`,
  `ALTER TABLE "ExpenseRequest" ADD CONSTRAINT "ExpenseRequest_headId_fkey" FOREIGN KEY ("headId") REFERENCES "ExpenseHead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`,
  `ALTER TABLE "ExpenseRequest" ADD CONSTRAINT "ExpenseRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
  `ALTER TABLE "ExpenseRequest" ADD CONSTRAINT "ExpenseRequest_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "PaymentSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
  `ALTER TABLE "ExpenseRequest" ADD CONSTRAINT "ExpenseRequest_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
];

const TABLES = ['Payslip', 'ExpenseRequest'];
const TYPES = ['PayslipStatus', 'ExpenseRequestStatus'];

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
