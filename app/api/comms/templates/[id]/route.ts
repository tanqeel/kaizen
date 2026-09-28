import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser, schoolIdOr400 } from '@/lib/api-auth';

/** PUT /api/comms/templates/[id] { name?, body? } — update a template. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('comms.manage');
  if (auth.error) return auth.error;
  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  const { id } = await params;
  const existing = await prisma.smsTemplate.findFirst({
    where: { id, schoolId: sres.schoolId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  let body: { name?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const name = body.name?.trim();
  const tplBody = body.body?.trim();
  if (name !== undefined && !name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
  if (tplBody !== undefined && !tplBody) return NextResponse.json({ error: 'body cannot be empty' }, { status: 400 });

  const template = await prisma.smsTemplate.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: name.slice(0, 80) } : {}),
      ...(tplBody !== undefined ? { body: tplBody.slice(0, 1000) } : {}),
    },
    select: { id: true, name: true, body: true },
  });
  return NextResponse.json({ ok: true, template });
}

/** DELETE /api/comms/templates/[id] — remove a template. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser('comms.manage');
  if (auth.error) return auth.error;
  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  const { id } = await params;
  const existing = await prisma.smsTemplate.findFirst({
    where: { id, schoolId: sres.schoolId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  await prisma.smsTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
