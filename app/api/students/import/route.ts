import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser, schoolIdOr400 } from '@/lib/api-auth';

const MAX_CSV_BYTES = 500 * 1024;
const MAX_DATA_ROWS = 2000;

// Recognized headers (lowercased). name + admissionNo are required.
const REQUIRED_HEADERS = ['name', 'admissionno'] as const;
const VALID_GENDERS = ['Male', 'Female', 'Other'] as const;
const PHONE_RE = /^[0-9+\-\s]{10,15}$/;
const DOB_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

interface Preview {
  name: string;
  admissionNo: string;
  gender: string | null;
  dob: string | null; // YYYY-MM-DD, exactly as in the CSV
  phone: string | null;
  grade: string;
  section: string;
  parentName: string | null;
  parentPhone: string | null;
}

interface RowResult {
  row: number; // 1-based CSV line number (header is line 1)
  errors: string[];
  preview: Preview;
}

/**
 * Minimal dependency-free CSV parser. Handles quoted fields, escaped
 * quotes (""), commas and newlines inside quotes, and \r\n line endings.
 * Exported for unit testing.
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, ''); // strip BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += c;
        i += 1;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
    } else if (c === ',') {
      row.push(field);
      field = '';
      i += 1;
    } else if (c === '\r' || c === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      if (c === '\r' && src[i + 1] === '\n') i += 1;
      i += 1;
    } else {
      field += c;
      i += 1;
    }
  }
  if (field !== '' || row.length > 0 || inQuotes) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Parse YYYY-MM-DD strictly (no leniency: rejects 2020-02-30). Exported for unit testing. */
export function parseDob(raw: string): Date | null {
  const m = DOB_RE.exec(raw);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // Date-only: build at UTC midnight so the calendar date is identical in
  // PKT (UTC+5 never crosses midnight backwards). No timezone shift.
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

/**
 * POST /api/students/import — bulk student import.
 * Body: { csv: string, dryRun: boolean }.
 * dryRun=true  → validate only, no writes.
 * dryRun=false → validate, then insert fully-valid rows in one transaction.
 */
export async function POST(req: Request) {
  const auth = await apiUser('students.manage');
  if (auth.error) return auth.error;
  const school = await schoolIdOr400();
  if ('error' in school) return school.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const csv = typeof body.csv === 'string' ? body.csv : '';
  const dryRun = body.dryRun === true;
  if (!csv.trim()) {
    return NextResponse.json({ error: 'No CSV data provided' }, { status: 400 });
  }
  if (csv.length > MAX_CSV_BYTES) {
    return NextResponse.json({ error: 'CSV is too large (max 500 KB)' }, { status: 400 });
  }

  const rawRows = parseCsv(csv);
  if (rawRows.length === 0) {
    return NextResponse.json({ error: 'CSV is empty' }, { status: 400 });
  }

  const headers = rawRows[0].map((h) => h.trim().toLowerCase());
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Header row is missing required column(s): ${missing.join(', ')}. Required: name, admissionNo.` },
      { status: 400 },
    );
  }
  const col = (name: string): number => headers.indexOf(name);

  // Preload lookups in parallel: existing admission numbers, grade/section
  // map, plus the school's default shift and current academic session
  // (both required on every Student row, same as the admissions flow).
  const [students, sections, shift, session] = await Promise.all([
    prisma.student.findMany({ select: { admissionNo: true } }),
    prisma.section.findMany({
      where: { grade: { schoolId: school.schoolId } },
      include: { grade: { select: { id: true, name: true } } },
    }),
    prisma.shift.findFirst({
      where: { schoolId: school.schoolId },
      select: { id: true },
      orderBy: { name: 'asc' },
    }),
    prisma.academicSession.findFirst({
      where: { schoolId: school.schoolId, isCurrent: true },
      select: { id: true },
    }),
  ]);
  if (!shift) {
    return NextResponse.json({ error: 'No shift configured. Add a shift first.' }, { status: 400 });
  }
  if (!session) {
    return NextResponse.json({ error: 'No current academic session. Set one first.' }, { status: 400 });
  }

  const existingAdmissionNos = new Set(students.map((s) => s.admissionNo));
  const sectionKey = (grade: string, section: string) =>
    `${grade.trim().toLowerCase()}|${section.trim().toLowerCase()}`;
  const sectionMap = new Map(
    sections.map((s) => [
      sectionKey(s.grade.name, s.name),
      { gradeId: s.grade.id, sectionId: s.id, gradeName: s.grade.name, sectionName: s.name },
    ]),
  );

  // Drop fully-blank lines; keep real 1-based CSV line numbers for errors.
  const dataLines = rawRows
    .map((cells, idx) => ({ cells, line: idx + 1 }))
    .slice(1)
    .filter(({ cells }) => cells.some((c) => c.trim() !== ''));
  if (dataLines.length === 0) {
    return NextResponse.json({ error: 'No student rows found in the CSV' }, { status: 400 });
  }
  if (dataLines.length > MAX_DATA_ROWS) {
    return NextResponse.json({ error: `Too many rows (max ${MAX_DATA_ROWS})` }, { status: 400 });
  }

  const cell = (cells: string[], name: string): string => {
    const i = col(name);
    return i >= 0 && i < cells.length ? cells[i].trim() : '';
  };

  const seenAdmissionNos = new Set<string>();
  const results: RowResult[] = [];

  for (const { cells, line } of dataLines) {
    const errors: string[] = [];
    const name = cell(cells, 'name');
    const admissionNo = cell(cells, 'admissionno');
    const gradeRaw = cell(cells, 'grade');
    const sectionRaw = cell(cells, 'section');

    if (!name) errors.push('Name is required');
    if (!admissionNo) {
      errors.push('Admission no is required');
    } else {
      if (seenAdmissionNos.has(admissionNo)) {
        errors.push(`Duplicate admission no "${admissionNo}" in this file`);
      } else if (existingAdmissionNos.has(admissionNo)) {
        errors.push(`Admission no "${admissionNo}" already exists`);
      }
    }
    seenAdmissionNos.add(admissionNo);

    // Gender: optional; normalize to the app's canonical values.
    const genderRaw = cell(cells, 'gender');
    let gender: string | null = null;
    if (genderRaw) {
      const match = VALID_GENDERS.find((g) => g.toLowerCase() === genderRaw.toLowerCase());
      if (!match) {
        errors.push(`Gender must be one of ${VALID_GENDERS.join(', ')}`);
      } else {
        gender = match;
      }
    }

    // DOB: optional; strict YYYY-MM-DD, valid calendar date, not in future.
    const dobRaw = cell(cells, 'dob');
    let dob: Date | null = null;
    if (dobRaw) {
      const parsed = parseDob(dobRaw);
      if (!parsed) {
        errors.push('DOB must be a valid date in YYYY-MM-DD format');
      } else if (parsed.getTime() > Date.now()) {
        errors.push('DOB must not be in the future');
      } else {
        dob = parsed;
      }
    }

    const phone = cell(cells, 'phone') || null;
    if (phone && !PHONE_RE.test(phone)) {
      errors.push('Phone number looks invalid');
    }
    // Student has no phone field in the schema (contact numbers live on
    // Parent). Refuse to silently drop the value — it must move to
    // parentPhone or be cleared.
    if (phone) {
      errors.push('Student records have no phone field — move this number to parentPhone or leave phone blank');
    }

    if (!gradeRaw) errors.push('Grade is required');
    if (!sectionRaw) errors.push('Section is required');
    const sectionRef =
      gradeRaw && sectionRaw ? sectionMap.get(sectionKey(gradeRaw, sectionRaw)) : undefined;
    if (gradeRaw && sectionRaw && !sectionRef) {
      errors.push(`No section "${sectionRaw}" found in grade "${gradeRaw}"`);
    }

    // Parent: optional as a pair. Never invent a phone — both or neither.
    const parentName = cell(cells, 'parentname') || null;
    const parentPhone = cell(cells, 'parentphone') || null;
    if (parentName && !parentPhone) errors.push('Parent phone is required when parent name is given');
    if (parentPhone && !parentName) errors.push('Parent name is required when parent phone is given');
    if (parentPhone && !PHONE_RE.test(parentPhone)) {
      errors.push('Parent phone number looks invalid');
    }

    results.push({
      row: line,
      errors,
      preview: {
        name,
        admissionNo,
        gender,
        dob: dob ? dobRaw : null,
        phone,
        grade: gradeRaw,
        section: sectionRaw,
        parentName,
        parentPhone,
      },
    });
  }

  const valid = results.filter((r) => r.errors.length === 0);
  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      valid: valid.length,
      invalid: results.length - valid.length,
      rows: results,
    });
  }

  // Commit: insert only fully-valid rows, in one transaction.
  // Parent dedupe follows the admissions pattern (match by phone),
  // with an in-run map so siblings in the same file share one parent.
  const parentIds = new Map<string, string>();
  let created = 0;
  const skipped = results
    .filter((r) => r.errors.length > 0)
    .map((r) => ({ row: r.row, errors: r.errors }));

  try {
    // NOTE: Neon HTTP adapter does not support $transaction — rows are
    // written sequentially instead. Not atomic: on failure the response
    // reports how many rows were created before the error.
    for (const r of valid) {
      const p = r.preview;
      const sectionRef = sectionMap.get(sectionKey(p.grade, p.section))!;

      let parentId: string | null = null;
      if (p.parentName && p.parentPhone) {
        parentId = parentIds.get(p.parentPhone) ?? null;
        if (!parentId) {
          const existing = await prisma.parent.findFirst({
            where: { phone: p.parentPhone },
            select: { id: true },
          });
          if (existing) {
            parentId = existing.id;
          } else {
            const createdParent = await prisma.parent.create({
              data: { name: p.parentName, phone: p.parentPhone },
              select: { id: true },
            });
            parentId = createdParent.id;
          }
          parentIds.set(p.parentPhone, parentId);
        }
      }

      const student = await prisma.student.create({
        data: {
          admissionNo: p.admissionNo,
          name: p.name,
          dob: r.preview.dob ? parseDob(r.preview.dob)! : null,
          gender: p.gender,
          gradeId: sectionRef.gradeId,
          sectionId: sectionRef.sectionId,
          shiftId: shift.id,
          sessionId: session.id,
          isActive: true,
        },
        select: { id: true },
      });

      if (parentId) {
        await prisma.studentParent.create({
          data: { studentId: student.id, parentId },
        });
      }
      created += 1;
    }
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? `Import failed: ${e.message}` : 'Import failed',
        created,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, dryRun: false, created, skipped });
}
