import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, type SafeUser } from '@/lib/auth';
import { requirePermission, type Permission } from '@/lib/rbac';
import {
  classifyIntent,
  runIntent,
  DATA_INTENTS,
  studyGuidance,
  generalGuidance,
} from '@/lib/ai/engine';
import { buildSystemPrompt, generateText, providerShortLabel, type AiProviderId } from '@/lib/ai/providers';
import { createManyCompat } from '@/lib/prisma-batch';

/** 401/403 guard for API routes. Returns the user or a JSON error response. */
async function guard(perm: Permission): Promise<{ user: SafeUser } | NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  try {
    requirePermission(user.role, perm);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return { user };
}

const PROVIDER_LABELS: Record<AiProviderId, string> = {
  ollama: providerShortLabel('ollama'),
  pollinations: providerShortLabel('pollinations'),
  groq: providerShortLabel('groq'),
  cerebras: providerShortLabel('cerebras'),
  sambanova: providerShortLabel('sambanova'),
  openrouter: providerShortLabel('openrouter'),
  mistral: providerShortLabel('mistral'),
  'github-models': providerShortLabel('github-models'),
  together: providerShortLabel('together'),
  fireworks: providerShortLabel('fireworks'),
  huggingface: providerShortLabel('huggingface'),
  gemini: providerShortLabel('gemini'),
  'rule-based': providerShortLabel('rule-based'),
};

// ── POST /api/ai/chat ───────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    return await chatPost(req);
  } catch (e) {
    console.error('[kaizen-ai] chat failed:', e);
    return NextResponse.json(
      { error: 'Sorry — something went wrong processing your message. Please try again.' },
      { status: 500 },
    );
  }
}

async function chatPost(req: Request) {
  const started = Date.now();
  const auth = await guard('ai.use');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  let body: { conversationId?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const message = (body.message ?? '').trim();
  if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  if (message.length > 2000) return NextResponse.json({ error: 'Message too long' }, { status: 400 });

  const intent = classifyIntent(message, user.role);
  let reply: string;
  let sources: string;
  let provider: AiProviderId;
  let providerLabel: string;

  if (DATA_INTENTS.has(intent) || intent === 'help') {
    // Deterministic rule-based DB engine — never a generative provider.
    const result = await runIntent(db_prisma(), user, intent);
    reply = result.answer.reply;
    sources = result.answer.sources;
    provider = 'rule-based';
    providerLabel = 'School records';
  } else {
    // Generative intents only: study_help / general.
    const school = await prisma.school.findFirst();
    const schoolName = school?.name ?? 'Kaizen Model School';
    try {
      const gen = await generateText({
        system: buildSystemPrompt(user.role, schoolName),
        prompt: message,
        maxTokens: 600,
      });
      reply = gen.text;
      provider = gen.provider;
      providerLabel = PROVIDER_LABELS[gen.provider];
      sources = 'Source: AI model response (general knowledge — not school records).';
    } catch {
      // No generative provider configured or provider errored: honest fallback.
      reply = intent === 'study_help' ? studyGuidance(message) : generalGuidance(message, user.role);
      provider = 'rule-based';
      providerLabel = 'Guidance';
      sources = 'Source: built-in guidance (no AI provider configured — not school records).';
    }
  }

  // Find or create the conversation (ownership verified).
  let conversationId = body.conversationId;
  if (conversationId) {
    const owned = await prisma.aiConversation.findFirst({
      where: { id: conversationId, userId: user.id },
    });
    if (!owned) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  } else {
    const created = await prisma.aiConversation.create({
      data: { userId: user.id, title: message.slice(0, 40) || 'New conversation' },
    });
    conversationId = created.id;
  }

  // Persist messages + usage log. Best-effort: logging must never break the reply.
  // NOTE: prisma.createMany throws "Transactions are not supported in HTTP
  // mode" on the Neon HTTP driver — insert individually in chunks instead.
  try {
    await createManyCompat(
      (data) => prisma.aiMessage.create({ data }),
      [
        { conversationId, role: 'USER', content: message, toolsUsed: intent },
        { conversationId, role: 'ASSISTANT', content: reply, toolsUsed: intent },
      ],
    );
    const latencyMs = Date.now() - started;
    await prisma.aiUsageLog.create({
      data: {
        userId: user.id,
        query: message.slice(0, 500),
        intent,
        provider,
        latencyMs,
      },
    });
  } catch (e) {
    console.warn('[kaizen-ai] persistence failed (non-fatal):', (e as Error).message);
  }

  return NextResponse.json({ reply, intent, provider, providerLabel, conversationId, sources });
}

// Small indirection so the module stays tree-shake friendly in tests.
function db_prisma() {
  return prisma;
}

// ── GET /api/ai/chat ────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const auth = await guard('ai.use');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get('conversationId');

  if (conversationId) {
    const conversation = await prisma.aiConversation.findFirst({
      where: { id: conversationId, userId: user.id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    return NextResponse.json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        messages: conversation.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          toolsUsed: m.toolsUsed,
          createdAt: m.createdAt,
        })),
      },
    });
  }

  const conversations = await prisma.aiConversation.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { _count: { select: { messages: true } } },
  });
  return NextResponse.json({
    conversations: conversations.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      messageCount: c._count.messages,
    })),
  });
}
