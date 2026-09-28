import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiUser, schoolIdOr400 } from '@/lib/api-auth';
import { can } from '@/lib/rbac';

export interface ExpenseRequestRow {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  head: { id: string; name: string };
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedBy: string;
  requestedById: string;
  source: { id: string; name: string } | null;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
}

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

function toRow(r: {
  id: string; title: string; description: string | null; amount: number;
  head: { id: string; name: string }; status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedById: string; requestedBy: { name: string };
  source: { id: string; name: string } | null;
  decidedBy: { name: string } | null; decidedAt: Date | null; createdAt: Date;
}): ExpenseRequestRow {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    amount: r.amount,
    head: r.head,
    status: r.status,
    requestedBy: r.requestedBy.name,
    requestedById: r.requestedById,
    source: r.source,
    decidedBy: r.decidedBy?.name ?? null,
    decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

/**
 * GET /api/expense-requests?status=PENDING|APPROVED|REJECTED
 * Approvers (expenses.approve) see every request in the school; everyone else
 * sees only their own requests.
 */
export async function GET(req: Request) {
  const auth = await apiUser('expenses.request');
  if (auth.error) return auth.error;
  const { user } = auth;

  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status');
  let status: (typeof STATUSES)[number] | undefined;
  if (statusParam) {
    if (!(STATUSES as readonly string[]).includes(statusParam)) {
      return NextResponse.json({ error: 'status must be PENDING, APPROVED or REJECTED' }, { status: 400 });
    }
    status = statusParam as (typeof STATUSES)[number];
  }

  const isApprover = can(user.role, 'expenses.approve');
  const where: { schoolId: string; status?: (typeof STATUSES)[number]; requestedById?: string } = {
    schoolId: sres.schoolId,
  };
  if (status) where.status = status;
  if (!isApprover) where.requestedById = user.id;

  const requests = await prisma.expenseRequest.findMany({
    where,
    include: {
      head: { select: { id: true, name: true } },
      source: { select: { id: true, name: true } },
      requestedBy: { select: { name: true } },
      decidedBy: { select: { name: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 500,
  });

  return NextResponse.json({ requests: requests.map(toRow), isApprover });
}

/** POST /api/expense-requests { title, description?, amount, headId } */
export async function POST(req: Request) {
  const auth = await apiUser('expenses.request');
  if (auth.error) return auth.error;
  const { user } = auth;

  const sres = await schoolIdOr400();
  if ('error' in sres) return sres.error;

  let body: { title?: string; description?: string; amount?: number; headId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const title = body.title?.trim();
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });
  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive whole number (PKR)' }, { status: 400 });
  }
  if (!body.headId) return NextResponse.json({ error: 'headId is required' }, { status: 400 });

  const head = await prisma.expenseHead.findFirst({
    where: { id: body.headId, schoolId: sres.schoolId },
  });
  if (!head) return NextResponse.json({ error: 'Unknown expense head' }, { status: 400 });

  const request = await prisma.expenseRequest.create({
    data: {
      schoolId: sres.schoolId,
      requestedById: user.id,
      title: title.slice(0, 200),
      description: body.description?.trim() ? body.description.trim().slice(0, 1000) : null,
      amount,
      headId: head.id,
      status: 'PENDING',
    },
    include: {
      head: { select: { id: true, name: true } },
      source: { select: { id: true, name: true } },
      requestedBy: { select: { name: true } },
      decidedBy: { select: { name: true } },
    },
  });

  return NextResponse.json({ ok: true, request: toRow(request) }, { status: 201 });
}
