import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser, schoolIdOr400 } from '@/lib/api-auth';

type Action = 'promote' | 'graduate' | 'stay';

interface PlanStudent {
  id: string;
  name: string;
  admissionNo: string;
  fromGrade: string;
  fromSection: string | null;
  toGrade: string | null;
  toSection: string | null;
  toGradeId: string | null;
  toSectionId: string | null;
  action: Action;
}

interface Plan {
  current: { id: string; name: string; term: string; startDate: Date; endDate: Date };
  gradeMap: { from: { id: string; name: string }; to: { id: string; name: string } | null }[];
  plan: PlanStudent[];
}

/**
 * Build the promotion plan for the current academic session.
 * 100% read-only — shared by the dry-run GET and the committing POST
 * (POST recomputes it fresh; never trusts client-supplied data).
 */
async function computePlan(schoolId: string): Promise<Plan> {
  const current = await prisma.academicSession.findFirst({
    where: { schoolId, isCurrent: true },
  });
  if (!current) throw new Error('No current academic session found');

  const grades = await prisma.grade.findMany({
    where: { schoolId },
    include: { sections: { orderBy: { name: 'asc' } } },
    orderBy: [{ level: 'asc' }, { name: 'asc' }],
  });
  if (grades.length === 0) throw new Error('No grades defined for this school');

  // Preload sections: per grade, map UPPER(section name) -> section
  const sectionByGrade = new Map<string, Map<string, { id: string; name: string }>>();
  for (const g of grades) {
    const m = new Map<string, { id: string; name: string }>();
    for (const s of g.sections) m.set(s.name.trim().toUpperCase(), { id: s.id, name: s.name });
    sectionByGrade.set(g.id, m);
  }

  const gradeIndex = new Map(grades.map((g, i) => [g.id, i]));
  const gradeMap = grades.map((g, i) => ({
    from: { id: g.id, name: g.name },
    to: i + 1 < grades.length ? { id: grades[i + 1].id, name: grades[i + 1].name } : null,
  }));

  const students = await prisma.student.findMany({
    where: { sessionId: current.id, isActive: true },
    include: { grade: true, section: true },
    orderBy: [{ grade: { level: 'asc' } }, { name: 'asc' }],
  });

  const plan: PlanStudent[] = students.map((st) => {
    const base = {
      id: st.id,
      name: st.name,
      admissionNo: st.admissionNo,
      fromGrade: st.grade?.name ?? '—',
      fromSection: st.section?.name ?? null,
    };
    const idx = gradeIndex.get(st.gradeId);
    // Final grade (or unknown grade) -> graduate
    if (idx === undefined || idx >= grades.length - 1) {
      return { ...base, toGrade: null, toSection: null, toGradeId: null, toSectionId: null, action: 'graduate' as Action };
    }
    const next = grades[idx + 1];
    const target = sectionByGrade.get(next.id)?.get((st.section?.name ?? '').trim().toUpperCase());
    // No section with the same name in the next grade -> stay as-is
    if (!target) {
      return { ...base, toGrade: null, toSection: null, toGradeId: null, toSectionId: null, action: 'stay' as Action };
    }
    return {
      ...base,
      toGrade: next.name,
      toSection: target.name,
      toGradeId: next.id,
      toSectionId: target.id,
      action: 'promote' as Action,
    };
  });

  return {
    current: { id: current.id, name: current.name, term: current.term, startDate: current.startDate, endDate: current.endDate },
    gradeMap,
    plan,
  };
}

function countsOf(plan: PlanStudent[]) {
  return {
    total: plan.length,
    promote: plan.filter((p) => p.action === 'promote').length,
    graduate: plan.filter((p) => p.action === 'graduate').length,
    stay: plan.filter((p) => p.action === 'stay').length,
  };
}

/** GET /api/academics/promote — dry-run promotion plan (read-only). */
export async function GET() {
  const auth = await apiUser('academics.manage');
  if (auth.error) return auth.error;
  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  try {
    const { current, gradeMap, plan } = await computePlan(sres.schoolId);
    return NextResponse.json({
      currentSession: { id: current.id, name: current.name, term: current.term },
      gradeMap,
      students: plan,
      counts: countsOf(plan),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not compute promotion plan' },
      { status: 400 },
    );
  }
}

/**
 * POST /api/academics/promote { newSessionName, confirm: true }
 * Commits the promotion in ONE transaction: creates the new session
 * (current), deactivates the old one, moves promoted students to the next
 * grade's same-named section, and deactivates graduates.
 */
export async function POST(req: Request) {
  const auth = await apiUser('academics.manage');
  if (auth.error) return auth.error;
  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;
  const schoolId = sres.schoolId;

  let body: { newSessionName?: string; confirm?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const newSessionName = body.newSessionName?.trim();
  if (!newSessionName) {
    return NextResponse.json({ error: 'New session name is required' }, { status: 400 });
  }
  if (body.confirm !== true) {
    return NextResponse.json({ error: 'Promotion requires explicit confirmation (confirm: true)' }, { status: 400 });
  }

  let computed: Plan;
  try {
    computed = await computePlan(schoolId);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not compute promotion plan' },
      { status: 400 },
    );
  }

  // Guard: the new session name must be unique — a duplicate means a
  // promotion was already run for this session cycle.
  const dup = await prisma.academicSession.findFirst({
    where: { schoolId, name: newSessionName },
    select: { id: true },
  });
  if (dup) {
    return NextResponse.json(
      { error: `A session named "${newSessionName}" already exists — promotion may already have been run` },
      { status: 409 },
    );
  }

  // Session metadata: keep the current term pattern; derive the academic
  // year (Apr 1 – Mar 31 PKT) from the year in the session name, falling
  // back to the year after the current session ends.
  const term = computed.current.term;
  const yearMatch = newSessionName.match(/(\d{4})/);
  const startYear = yearMatch ? Number(yearMatch[1]) : computed.current.endDate.getUTCFullYear();
  const startDate = new Date(`${startYear}-04-01T00:00:00+05:00`);
  const endDate = new Date(`${startYear + 1}-03-31T23:59:59+05:00`);
  if (Number.isNaN(startDate.getTime())) {
    return NextResponse.json({ error: 'Could not derive session dates from the session name' }, { status: 400 });
  }

  const promotes = computed.plan.filter((p) => p.action === 'promote');
  const graduates = computed.plan.filter((p) => p.action === 'graduate');

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const newSession = await tx.academicSession.create({
          data: { schoolId, name: newSessionName, term, startDate, endDate, isCurrent: true },
          select: { id: true },
        });
        await tx.academicSession.update({
          where: { id: computed.current.id },
          data: { isCurrent: false },
        });
        await Promise.all(
          promotes.map((p) =>
            tx.student.update({
              where: { id: p.id },
              // sessionId moves to the new session so fees/vouchers/attendance
              // scoping (which filters by current session) keeps working.
              data: { gradeId: p.toGradeId!, sectionId: p.toSectionId!, sessionId: newSession.id },
            }),
          ),
        );
        await Promise.all(
          graduates.map((p) => tx.student.update({ where: { id: p.id }, data: { isActive: false } })),
        );
        return {
          promoted: promotes.length,
          graduated: graduates.length,
          stayed: computed.plan.length - promotes.length - graduates.length,
          newSessionId: newSession.id,
        };
      },
      { timeout: 30000 },
    );
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Promotion failed' },
      { status: 500 },
    );
  }
}
