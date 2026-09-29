'use client';

import { useEffect, useRef, useState } from 'react';
import type { Role } from '@prisma/client';
import { Button, Badge, Card, EmptyState, PageHeader, Select } from '@/components/ui';
import { Icon } from '@/components/icons';
import { DATA_INTENTS } from '@/lib/ai/engine';
import { safeJson } from '@/lib/api-client';

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: string;
  messageCount: number;
}

export interface ChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  toolsUsed?: string | null;
  /** Only available for messages sent in this session. */
  providerLabel?: string;
  sources?: string;
}

interface ChatClientProps {
  role: Role;
  greeting: string;
  chips: string[];
  initialConversations: ChatConversation[];
}

/* --------------------- tiny markdown renderer (safe) ---------------------- */

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? (
      <strong key={`${keyPrefix}-${i}`} className="font-semibold text-slate-900 dark:text-white">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{p}</span>
    ),
  );
}

function renderMessage(content: string): React.ReactNode {
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];
  const flushList = () => {
    if (list.length > 0) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="my-1.5 list-disc space-y-1 pl-5">
          {list}
        </ul>,
      );
      list = [];
    }
  };
  lines.forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('- ')) {
      list.push(<li key={`li-${i}`}>{renderInline(t.slice(2), `li-${i}`)}</li>);
    } else if (t === '') {
      flushList();
    } else {
      flushList();
      blocks.push(
        <p key={`p-${i}`} className="my-1.5">
          {renderInline(t, `p-${i}`)}
        </p>,
      );
    }
  });
  flushList();
  return blocks;
}

/* ------------------------------ provider badge ----------------------------- */

function providerBadgeVariant(label: string): 'info' | 'present' | 'neutral' {
  if (label === 'School records') return 'info';
  if (label === 'Guidance') return 'neutral';
  return 'present';
}

/** Badge for persisted messages (provider not stored): derive from intent. */
function historicBadge(toolsUsed?: string | null): string {
  if (toolsUsed && (DATA_INTENTS.has(toolsUsed as never) || toolsUsed === 'help')) return 'School records';
  return 'Kaizen AI';
}

/* --------------------------------- component ------------------------------- */

export function ChatClient({ role, greeting, chips, initialConversations }: ChatClientProps) {
  const [conversations, setConversations] = useState<ChatConversation[]>(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  async function openConversation(id: string | null) {
    setActiveId(id);
    setMessages([]);
    if (!id) return;
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/ai/chat?conversationId=${encodeURIComponent(id)}`);
      if (res.ok) {
        try {
          const data = await safeJson(res);
          setMessages(data.conversation.messages);
        } catch {
          // Non-JSON response; leave messages empty.
        }
      }
    } finally {
      setLoadingThread(false);
    }
  }

  function newChat() {
    setActiveId(null);
    setMessages([]);
    setInput('');
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      role: 'USER',
      content: message,
    };
    setMessages((m) => [...m, optimistic]);
    setInput('');
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: activeId, message }),
      });
      // Parse defensively: error responses may be non-JSON (proxy/HTML).
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      if (!data?.reply) throw new Error('Empty response from server');
      const assistant: ChatMessage = {
        id: `local-a-${Date.now()}`,
        role: 'ASSISTANT',
        content: data.reply,
        toolsUsed: data.intent,
        providerLabel: data.providerLabel,
        sources: data.sources,
      };
      setMessages((m) => [...m, assistant]);
      // Register a brand-new conversation in the list.
      if (!activeId) {
        setActiveId(data.conversationId);
        setConversations((c) => [
          { id: data.conversationId, title: message.slice(0, 40), createdAt: new Date().toISOString(), messageCount: 2 },
          ...c,
        ]);
      } else {
        setConversations((c) =>
          c.map((conv) =>
            conv.id === activeId ? { ...conv, messageCount: conv.messageCount + 2 } : conv,
          ),
        );
      }
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          id: `local-err-${Date.now()}`,
          role: 'ASSISTANT',
          content: `Sorry — something went wrong sending your message (${err instanceof Error ? err.message : 'unknown error'}). Please try again.`,
          providerLabel: 'Guidance',
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  const activeTitle = conversations.find((c) => c.id === activeId)?.title ?? 'New conversation';

  return (
    <div>
      <PageHeader
        title="Kaizen AI"
        subtitle="Role-aware assistant. Data answers are read from real school records — never invented."
      />

      {/* Mobile conversation picker */}
      <div className="mb-4 lg:hidden">
        <Select
          aria-label="Choose a conversation"
          value={activeId ?? ''}
          onChange={(e) => (e.target.value ? openConversation(e.target.value) : newChat())}
          options={[
            { value: '', label: 'New conversation' },
            ...conversations.map((c) => ({ value: c.id, label: c.title })),
          ]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Sidebar (desktop) */}
        <Card className="hidden max-h-[70vh] flex-col overflow-hidden lg:flex">
          <div className="border-b border-slate-200 p-3 dark:border-slate-800">
            <Button className="w-full" onClick={newChat}>
              <Icon name="plus" size={18} /> New chat
            </Button>
          </div>
          <div className="nice-scroll flex-1 overflow-y-auto p-2">
            {conversations.length === 0 ? (
              <p className="px-2 py-4 text-sm text-slate-500 dark:text-slate-400">
                No conversations yet. Ask your first question!
              </p>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openConversation(c.id)}
                  aria-current={c.id === activeId}
                  className={`mb-1 flex min-h-[44px] w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    c.id === activeId
                      ? 'bg-brand-100 font-semibold text-brand-800 dark:bg-brand-500/15 dark:text-brand-300'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon name="sparkles" size={16} className="shrink-0 opacity-70" />
                  <span className="truncate">{c.title}</span>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Thread */}
        <Card className="flex min-h-[60vh] max-w-full flex-col overflow-hidden lg:max-h-[70vh]">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              {activeTitle}
            </p>
            <Button variant="ghost" size="sm" onClick={newChat} className="lg:hidden">
              <Icon name="plus" size={16} /> New
            </Button>
          </div>

          <div ref={scrollRef} className="nice-scroll flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {loadingThread ? (
              <TypingBubble />
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <EmptyState
                  icon="sparkles"
                  title="Start the conversation"
                  guidance={greeting}
                />
              </div>
            ) : (
              messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))
            )}
            {sending && messages[messages.length - 1]?.role !== 'ASSISTANT' && <TypingBubble />}
          </div>

          {/* Follow-up chips */}
          {chips.length > 0 && (
            <div className="nice-scroll flex gap-2 overflow-x-auto border-t border-slate-100 px-4 pt-3 dark:border-slate-800">
              {chips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => send(chip)}
                  disabled={sending}
                  className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center rounded-full border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-700 transition-colors hover:border-brand-400 hover:text-brand-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Composer */}
          <form
            className="flex items-end gap-2 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <label htmlFor="ai-input" className="sr-only">
              Ask Kaizen AI
            </label>
            <input
              id="ai-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about attendance, fees, results, schedules…"
              autoComplete="off"
              disabled={sending}
              className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 hover:border-slate-400 focus:border-brand-600 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-brand-400"
            />
            <Button type="submit" loading={sending} disabled={!input.trim()} aria-label="Send message">
              <Icon name="arrow-left" size={18} className="rotate-180" />
              <span className="hidden sm:inline">Send</span>
            </Button>
          </form>

          <p className="border-t border-slate-100 px-4 py-2 text-center text-[11px] leading-relaxed text-slate-400 dark:border-slate-800 dark:text-slate-500">
            Data answers come from the school database and are never invented. Study help uses a
            configured AI provider when available, otherwise built-in guidance.
          </p>
        </Card>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'USER';
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-sm break-words text-white dark:bg-brand-500">
          {message.content}
        </div>
      </div>
    );
  }
  const badge = message.providerLabel ?? historicBadge(message.toolsUsed);
  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed break-words text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200">
        <div className="mb-1 flex items-center gap-2">
          <Icon name="sparkles" size={14} className="text-brand-600 dark:text-brand-400" />
          <Badge variant={providerBadgeVariant(badge)}>{badge}</Badge>
        </div>
        <div className="[&_p]:my-1.5">{renderMessage(message.content)}</div>
        {message.sources && (
          <p className="mt-2 border-t border-slate-200 pt-1.5 text-[11px] text-slate-400 dark:border-slate-700 dark:text-slate-500">
            {message.sources}
          </p>
        )}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start" role="status" aria-label="Kaizen AI is typing">
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/60">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 animate-pulse rounded-full bg-slate-400 dark:bg-slate-500"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
