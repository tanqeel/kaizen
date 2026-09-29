/**
 * Kaizen AI — free, pluggable intelligence provider layer.
 *
 * Priority (first configured wins; override with AI_PROVIDER_ORDER, e.g.
 * "ollama,huggingface,pollinations,gemini"):
 *   1. ollama       — local open-source models via OLLAMA_BASE_URL (no key, fully private)
 *   2. pollinations — free public gateway serving open-source models (no key needed)
 *   3. huggingface  — hosted open-source models via HF_TOKEN (free tier)
 *   4. gemini       — Gemini free tier via GEMINI_API_KEY
 *   5. rule-based   — deterministic built-in fallback (always available)
 *
 * Generative providers are used ONLY for open-ended intents (study help,
 * summaries, general questions). All school-data queries go through the
 * rule-based DB engine in ./engine so records are never invented.
 */

export type AiProviderId = 'ollama' | 'pollinations' | 'huggingface' | 'gemini' | 'rule-based';

export interface GenerateOptions {
  system: string;
  prompt: string;
  maxTokens?: number;
}

export interface ProviderInfo {
  id: AiProviderId;
  label: string;
  model: string;
  configured: boolean;
  active: boolean;
  hint: string;
}

/** Provider priority: first configured provider wins. Overridable via AI_PROVIDER_ORDER. */
const PROVIDER_ORDER: AiProviderId[] = (
  process.env.AI_PROVIDER_ORDER || 'ollama,pollinations,huggingface,gemini'
)
  .split(',')
  .map((s) => s.trim())
  .filter((s): s is AiProviderId =>
    ['ollama', 'pollinations', 'huggingface', 'gemini'].includes(s),
  );

function isConfigured(id: AiProviderId): boolean {
  switch (id) {
    case 'ollama':
      return !!process.env.OLLAMA_BASE_URL;
    case 'pollinations':
      return process.env.POLLINATIONS_DISABLED !== '1';
    case 'huggingface':
      return !!process.env.HF_TOKEN;
    case 'gemini':
      return !!process.env.GEMINI_API_KEY;
    case 'rule-based':
      return true;
  }
}

/** Which generative provider would handle a request right now. */
export function activeProvider(): AiProviderId {
  return PROVIDER_ORDER.find(isConfigured) ?? 'rule-based';
}

export function providerStatus(): ProviderInfo[] {
  const active = activeProvider();
  const infos: ProviderInfo[] = [
    {
      id: 'ollama',
      label: 'Ollama (local open-source)',
      model: process.env.OLLAMA_MODEL || 'llama3.1:8b',
      configured: !!process.env.OLLAMA_BASE_URL,
      active: active === 'ollama',
      hint: 'Set OLLAMA_BASE_URL (e.g. http://localhost:11434) and pull a model with `ollama pull llama3.1:8b`. Free, private, no API key.',
    },
    {
      id: 'pollinations',
      label: 'Pollinations (free open-source)',
      model: process.env.POLLINATIONS_MODEL || 'openai-fast (GPT-OSS 20B)',
      configured: isConfigured('pollinations'),
      active: active === 'pollinations',
      hint: 'Free public gateway serving open-source models — no API key needed. Anonymous tier is rate-limited. Set POLLINATIONS_MODEL to change the model, POLLINATIONS_DISABLED=1 to turn it off.',
    },
    {
      id: 'huggingface',
      label: 'Hugging Face (hosted open-source)',
      model: process.env.HF_MODEL || 'Qwen/Qwen2.5-7B-Instruct',
      configured: !!process.env.HF_TOKEN,
      active: active === 'huggingface',
      hint: 'Set HF_TOKEN (free at huggingface.co) and optionally HF_MODEL. Hosted open models, generous free tier.',
    },
    {
      id: 'gemini',
      label: 'Gemini (free tier)',
      model: 'gemini-2.0-flash',
      configured: !!process.env.GEMINI_API_KEY,
      active: active === 'gemini',
      hint: 'Set GEMINI_API_KEY (free tier at aistudio.google.com).',
    },
    {
      id: 'rule-based',
      label: 'Rule-based fallback',
      model: 'built-in',
      configured: true,
      active: active === 'rule-based',
      hint: 'Always available. Answers from templates + real database queries; never pretends to be generative AI.',
    },
  ];
  return infos;
}

/**
 * Generate text with the first working provider in priority order.
 * Throws 'no-generative-provider' when nothing is configured, or
 * 'all-providers-failed' when every configured provider errored.
 *
 * Each provider gets a short budget (10s): on serverless (60s function
 * limit) a 30s-per-provider chain could hit the platform timeout before
 * the rule-based fallback ever runs.
 */
export async function generateText(opts: GenerateOptions): Promise<{ text: string; provider: AiProviderId }> {
  let attempted = 0;
  for (const id of PROVIDER_ORDER) {
    if (!isConfigured(id)) continue;
    attempted++;
    try {
      const text = await withTimeout(10000, (signal) => {
        if (id === 'ollama') return viaOllama(opts, signal);
        if (id === 'pollinations') return viaPollinations(opts, signal);
        if (id === 'huggingface') return viaHuggingFace(opts, signal);
        return viaGemini(opts, signal);
      });
      return { text, provider: id };
    } catch (err) {
      console.warn(`[kaizen-ai] provider "${id}" failed, trying next:`, (err as Error).message);
    }
  }
  throw new Error(attempted > 0 ? 'all-providers-failed' : 'no-generative-provider');
}

async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function viaOllama({ system, prompt, maxTokens }: GenerateOptions, signal?: AbortSignal): Promise<string> {
  const base = (process.env.OLLAMA_BASE_URL || '').replace(/\/$/, '');
  const model = process.env.OLLAMA_MODEL || 'llama3.1:8b';
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      options: { num_predict: maxTokens ?? 512 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama error: HTTP ${res.status}`);
  const json = await res.json();
  const text = (json.message?.content || '').trim();
  if (!text) throw new Error('Ollama returned an empty response');
  return text;
}

/** Free, no-key gateway serving open-source models (OpenAI-compatible chat API). */
async function viaPollinations({ system, prompt, maxTokens }: GenerateOptions, signal?: AbortSignal): Promise<string> {
  const model = process.env.POLLINATIONS_MODEL || 'openai-fast';
  const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(model)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: maxTokens ?? 600,
    }),
  });
  if (!res.ok) throw new Error(`Pollinations error: HTTP ${res.status}`);
  const json = await res.json();
  const text = (json.choices?.[0]?.message?.content || '').trim();
  if (!text) throw new Error('Pollinations returned an empty response');
  return text;
}

async function viaHuggingFace({ system, prompt, maxTokens }: GenerateOptions, signal?: AbortSignal): Promise<string> {
  const model = process.env.HF_MODEL || 'Qwen/Qwen2.5-7B-Instruct';
  const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.HF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    signal,
    body: JSON.stringify({
      inputs:
        `<|im_start|>system\n${system}<|im_end|>\n` +
        `<|im_start|>user\n${prompt}<|im_end|>\n<|im_start|>assistant\n`,
      parameters: { max_new_tokens: maxTokens ?? 512, return_full_text: false, temperature: 0.7 },
    }),
  });
  if (!res.ok) throw new Error(`Hugging Face error: HTTP ${res.status}`);
  const json = await res.json();
  const text = (Array.isArray(json) ? json[0]?.generated_text : json.generated_text || '').trim();
  if (!text) throw new Error('Hugging Face returned an empty response');
  return text;
}

async function viaGemini({ system, prompt, maxTokens }: GenerateOptions, signal?: AbortSignal): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens ?? 512, temperature: 0.7 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini error: HTTP ${res.status}`);
  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p: { text?: string }) => p.text || '').join('').trim();
  if (!text) throw new Error('Gemini returned an empty response');
  return text;
}

/** Shared system prompt guardrail for every generative call. */
export function buildSystemPrompt(role: string, schoolName: string): string {
  return [
    `You are Kaizen AI, the assistant for ${schoolName} (a school management system).`,
    `The user is a ${role}. Be concise, warm, and practical.`,
    'CRITICAL RULES:',
    '- Never invent attendance records, marks, fee amounts, or any school data.',
    '- If asked about school records, say you can only answer from real database records and suggest where to look in the app.',
    '- For study help, explain clearly with simple examples suitable for primary school level.',
    '- Keep answers short unless the user asks for detail.',
  ].join('\n');
}
