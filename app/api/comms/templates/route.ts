import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser, schoolIdOr400 } from '@/lib/api-auth';

/**
 * GET /api/comms/templates — SMS templates for this school.
 * POST /api/comms/templates { name, body } — create a template.
 * Body may use {{student_name}}, {{amount}}, {{date}} placeholders.
 */
export async function GET() {
  const auth = await apiUser('comms.manage');
  if (auth.error) return auth.error;
  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  const templates = await prisma.smsTemplate.findMany({
    where: { schoolId: sres.schoolId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, body: true },
  });
  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const auth = await apiUser('comms.manage');
  if (auth.error) return auth.error;
  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  let body: { name?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const name = body.name?.trim();
  const tplBody = body.body?.trim();
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!tplBody) return NextResponse.json({ error: 'body is required' }, { status: 400 });

  const template = await prisma.smsTemplate.create({
    data: { schoolId: sres.schoolId, name: name.slice(0, 80), body: tplBody.slice(0, 1000) },
  });
  return NextResponse.json(
    { ok: true, template: { id: template.id, name: template.name, body: template.body } },
    { status: 201 },
  );
}
