import { NextResponse } from 'next/server';
import { Client } from 'pg';
import { requireUser } from '@/lib/auth';

/**
 * TEMPORARY one-time migration: creates the DiaryEntry table and seeds today's
 * diary entries in production. Raw TCP via `pg` is required because the Neon
 * HTTP driver silently discards DDL. DELETE THIS ROUTE after first successful run.
 * SUPER_ADMIN only.
 */
export async function POST() {
  const user = await requireUser().catch(() => null);
  if (!user || user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ error: 'No database URL' }, { status: 500 });

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const exists = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'DiaryEntry'`
    );
    const steps: string[] = [];
    if (exists.rowCount === 0) {
      const ddl = [
        `CREATE TABLE "DiaryEntry" (
          "id" TEXT NOT NULL,
          "schoolId" TEXT NOT NULL,
          "date" TEXT NOT NULL,
          "sectionId" TEXT NOT NULL,
          "subjectId" TEXT,
          "teacherId" TEXT NOT NULL,
          "taughtToday" TEXT,
          "classwork" TEXT,
          "homework" TEXT,
          "note" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "DiaryEntry_pkey" PRIMARY KEY ("id")
        )`,
        `CREATE INDEX "DiaryEntry_sectionId_date_idx" ON "DiaryEntry"("sectionId", "date")`,
        `CREATE INDEX "DiaryEntry_teacherId_date_idx" ON "DiaryEntry"("teacherId", "date")`,
        `CREATE INDEX "DiaryEntry_date_idx" ON "DiaryEntry"("date")`,
        `CREATE UNIQUE INDEX "DiaryEntry_sectionId_subjectId_date_key" ON "DiaryEntry"("sectionId", "subjectId", "date")`,
        `ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
        `ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
        `ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
        `ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      ];
      for (const stmt of ddl) await client.query(stmt);
      steps.push('table created');
    } else {
      steps.push('table already existed');
    }

    // Seed today's diary entries (idempotent).
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    const count = await client.query(`SELECT COUNT(*)::int AS n FROM "DiaryEntry" WHERE date = $1`, [today]);
    let inserted = 0;
    if (count.rows[0].n === 0) {
      const school = (await client.query(`SELECT id FROM "School" LIMIT 1`)).rows[0];
      const sections = (await client.query(
        `SELECT s.id, COALESCE(s."classTeacherId", (SELECT id FROM "Teacher" LIMIT 1)) AS "teacherId"
         FROM "Section" s ORDER BY s.id LIMIT 8`
      )).rows;
      const subjects = (await client.query(`SELECT id FROM "Subject" ORDER BY id`)).rows;
      const samples = [
        ['Fractions — addition and subtraction of like fractions', 'Exercise 5.1, Q1–Q6 solved in class', 'Exercise 5.1, Q7–Q12 — due tomorrow', 'Short test on Friday — please revise this topic at home.'],
        ['Reading comprehension — "The Honest Woodcutter"', 'New vocabulary with Urdu meanings written in notebook', 'Learn 10 new words and write 5 sentences', null],
        ['Parts of plants — root, stem, leaf and flower', 'Diagram of a plant labelled in notebook', 'Draw and label the parts of a flower', null],
        ['Multiplication tables 6 to 8', 'Table test of 6 and 7 taken in class', 'Learn table of 8, written twice', 'Short test on Friday — please revise this topic at home.'],
        ['Noun and its kinds — proper, common, collective', 'Exercise: underline nouns in 10 sentences', 'Write 5 examples of each kind of noun', null],
        ['The water cycle — evaporation, condensation, rain', 'Water cycle diagram drawn and explained', 'Write 6 lines on why rain is important', null],
      ];
      for (let i = 0; i < sections.length; i++) {
        const s = samples[i % samples.length];
        const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12) + i;
        await client.query(
          `INSERT INTO "DiaryEntry" (id, "schoolId", date, "sectionId", "subjectId", "teacherId",
            "taughtToday", classwork, homework, note, "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW())
           ON CONFLICT DO NOTHING`,
          [id, school.id, today, sections[i].id, subjects[i % subjects.length].id,
           sections[i].teacherId, s[0], s[1], s[2], s[3]]
        );
        inserted++;
      }
      steps.push(`seeded ${inserted} diary entries for ${today}`);
    } else {
      steps.push(`diary entries for ${today} already existed`);
    }
    return NextResponse.json({ ok: true, steps });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  } finally {
    await client.end();
  }
}
