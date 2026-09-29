/**
 * Kaizen AI — free, pluggable intelligence provider layer.
 *
 * Every generative provider below serves OPEN-SOURCE models on a free tier.
 * Priority (first configured wins; override with AI_PROVIDER_ORDER, e.g.
 * "ollama,pollinations,groq,cerebras"):
 *   Keyless (work out of the box):
 *     1. ollama       — local open-source models via OLLAMA_BASE_URL (fully private)
 *     2. pollinations — free public gateway serving open-source models (no key)
 *   Free tier with an API key (add the key in Vercel env vars to enable):
 *     3. groq         — GROQ_API_KEY          (fast Llama/Qwen free tier)
 *     4. cerebras     — CEREBRAS_API_KEY      (very fast Llama/Qwen free tier)
 *     5. sambanova    — SAMBANOVA_API_KEY     (Llama free tier)
 *     6. openrouter    — OPENROUTER_API_KEY    (free :free open models)
 *     7. mistral      — MISTRAL_API_KEY       (Mistral open-weights free tier)
 *     8. github-models — GITHUB_MODELS_TOKEN  (free tier, Llama/Qwen/Mistral)
 *     9. together     — TOGETHER_API_KEY      (free credits for open models)
 *    10. fireworks    — FIREWORKS_API_KEY     (open models free tier)
 *    11. huggingface  — HF_TOKEN              (hosted open models free tier)
 *    12. gemini       — GEMINI_API_KEY        (Gemini free tier)
 *   Always available:
 *    13. rule-based   — deterministic built-in fallback (no AI needed)
 *
 * Groq/Cerebras/SambaNova/OpenRouter/Mistral/GitHub Models/Together/Fireworks
 * all expose the standard OpenAI-compatible /chat/completions API, so they
 * share one driver. If any provider errors or times out, the chain moves on;
 * the rule-based engine always answers in the end, so the chat NEVER hangs.
 *
 * Generative providers are used ONLY for open-ended intents (study help,
 * summaries, general questions). All school-data queries go through the
 * rule-based DB engine in ./engine so records are never invented.
 */

export type AiProviderId =
  | 'ollama'
  | 'pollinations'
  | 'groq'
  | 'cerebras'
  | 'sambanova'
  | 'openrouter'
  | 'mistral'
  | 'github-models'
  | 'together'
  | 'fireworks'
  | 'huggingface'
  | 'gemini'
  | 'rule-based';

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

const ALL_IDS: AiProviderId[] = [
  'ollama', 'pollinations', 'groq', 'cerebras', 'sambanova', 'openrouter',
  'mistral', 'github-models', 'together', 'fireworks', 'huggingface', 'gemini',
];

/** Provider priority: first configured provider wins. Overridable via AI_PROVIDER_ORDER. */
const PROVIDER_ORDER: AiProviderId[] = (
  process.env.AI_PROVIDER_ORDER ||
  'ollama,pollinations,groq,cerebras,sambanova,openrouter,mistral,github-models,together,fireworks,huggingface,gemini'
)
  .split(',')
  .map((s) => s.trim())
  .filter((s): s is AiProviderId => (ALL_IDS as string[]).includes(s));

/** Env var holding the API key for each key-based provider (undefined = keyless). */
const KEY_ENV: Partial<Record<AiProviderId, string>> = {
  groq: 'GROQ_API_KEY',
  cerebras: 'CEREBRAS_API_KEY',
  sambanova: 'SAMBANOVA_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  'github-models': 'GITHUB_MODELS_TOKEN',
  together: 'TOGETHER_API_KEY',
  fireworks: 'FIREWORKS_API_KEY',
  huggingface: 'HF_TOKEN',
  gemini: 'GEMINI_API_KEY',
};

/** OpenAI-compatible chat-completions endpoint per provider. */
const OA_BASE_URL: Partial<Record<AiProviderId, string>> = {
  groq: 'https://api.groq.com/openai/v1',
  cerebras: 'https://api.cerebras.ai/v1',
  sambanova: 'https://api.sambanova.ai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  mistral: 'https://api.mistral.ai/v1',
  'github-models': 'https://models.github.ai/inference',
  together: 'https://api.together.xyz/v1',
  fireworks: 'https://api.fireworks.ai/inference/v1',
};

/** Default open-source model per provider (overridable via <PREFIX>_MODEL). */
const DEFAULT_MODEL: Partial<Record<AiProviderId, string>> = {
  groq: 'llama-3.3-70b-versatile',
  cerebras: 'llama-3.3-70b',
  sambanova: 'Meta-Llama-3.3-70B-Instruct',
  openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
  mistral: 'mistral-small-latest',
  'github-models': 'meta-llama-3.3-70b-instruct',
  together: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  fireworks: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
};

const MODEL_ENV: Partial<Record<AiProviderId, string>> = {
  groq: 'GROQ_MODEL',
  cerebras: 'CEREBRAS_MODEL',
  sambanova: 'SAMBANOVA_MODEL',
  openrouter: 'OPENROUTER_MODEL',
  mistral: 'MISTRAL_MODEL',
  'github-models': 'GITHUB_MODELS_MODEL',
  together: 'TOGETHER_MODEL',
  fireworks: 'FIREWORKS_MODEL',
};

function modelFor(id: AiProviderId): string {
  const envName = MODEL_ENV[id];
  return (envName && process.env[envName]) || DEFAULT_MODEL[id] || '';
}

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
    default: {
      const keyEnv = KEY_ENV[id];
      return !!keyEnv && !!process.env[keyEnv];
    }
  }
}

/** Which generative provider would handle a request right now. */
export function activeProvider(): AiProviderId {
  return PROVIDER_ORDER.find(isConfigured) ?? 'rule-based';
}

const HINTS: Record<AiProviderId, string> = {
  ollama: 'Set OLLAMA_BASE_URL (e.g. http://localhost:11434) and pull a model with `ollama pull llama3.1:8b`. Free, private, no API key.',
  pollinations: 'Free public gateway serving open-source models — no API key needed. Set POLLINATIONS_MODEL to change the model, POLLINATIONS_DISABLED=1 to turn it off.',
  groq: 'Set GROQ_API_KEY (free tier at console.groq.com — fast Llama/Qwen). Optional GROQ_MODEL to change the model.',
  cerebras: 'Set CEREBRAS_API_KEY (free tier at cloud.cerebras.ai — very fast Llama/Qwen). Optional CEREBRAS_MODEL.',
  sambanova: 'Set SAMBANOVA_API_KEY (free tier at cloud.sambanova.ai — Llama). Optional SAMBANOVA_MODEL.',
  openrouter: 'Set OPENROUTER_API_KEY (free at openrouter.ai — models ending in :free cost nothing). Optional OPENROUTER_MODEL.',
  mistral: 'Set MISTRAL_API_KEY (free tier at console.mistral.ai — Mistral open-weights). Optional MISTRAL_MODEL.',
  'github-models': 'Set GITHUB_MODELS_TOKEN (free GitHub PAT at github.com/settings/tokens — GitHub Models free tier). Optional GITHUB_MODELS_MODEL.',
  together: 'Set TOGETHER_API_KEY (free starting credits at api.together.ai — open models). Optional TOGETHER_MODEL.',
  fireworks: 'Set FIREWORKS_API_KEY (free tier at fireworks.ai — open models). Optional FIREWORKS_MODEL.',
  huggingface: 'Set HF_TOKEN (free at huggingface.co) and optionally HF_MODEL. Hosted open models, generous free tier.',
  gemini: 'Set GEMINI_API_KEY (free tier at aistudio.google.com).',
  'rule-based': 'Always available. Answers from templates + real database queries; never pretends to be generative AI.',
};

const LABELS: Record<AiProviderId, string> = {
  ollama: 'Ollama (local open-source)',
  pollinations: 'Pollinations (free open-source)',
  groq: 'Groq (free tier)',
  cerebras: 'Cerebras (free tier)',
  sambanova: 'SambaNova (free tier)',
  openrouter: 'OpenRouter (free models)',
  mistral: 'Mistral (free tier)',
  'github-models': 'GitHub Models (free tier)',
  together: 'Together AI (free credits)',
  fireworks: 'Fireworks AI (free tier)',
  huggingface: 'Hugging Face (hosted open-source)',
  gemini: 'Gemini (free tier)',
  'rule-based': 'Rule-based fallback',
};

export function providerStatus(): ProviderInfo[] {
  const active = activeProvider();
  const ids: AiProviderId[] = [...ALL_IDS, 'rule-based'];
  return ids.map((id) => ({
    id,
    label: LABELS[id],
    model:
      id === 'ollama'
        ? process.env.OLLAMA_MODEL || 'llama3.1:8b'
        : id === 'pollinations'
          ? process.env.POLLINATIONS_MODEL || 'openai-fast (GPT-OSS 20B)'
          : id === 'huggingface'
            ? process.env.HF_MODEL || 'Qwen/Qwen2.5-7B-Instruct'
            : id === 'gemini'
              ? 'gemini-2.0-flash'
              : id === 'rule-based'
                ? 'built-in'
                : modelFor(id),
    configured: isConfigured(id),
    active: active === id,
    hint: HINTS[id],
  }));
}

/**
 * Total wall-clock budget for the whole provider chain. Serverless functions
 * cap at ~60s, so the chain must finish (or hand off to the rule-based
 * fallback) well before that. Each provider gets up to 10s, but never past
 * the shared deadline.
 */
const CHAIN_BUDGET_MS = 45000;
const PER_PROVIDER_MS = 10000;

/**
 * Generate text with the first working provider in priority order.
 * Throws 'no-generative-provider' when nothing is configured, or
 * 'all-providers-failed' when every configured provider errored.
 */
export async function generateText(opts: GenerateOptions): Promise<{ text: string; provider: AiProviderId }> {
  const deadline = Date.now() + CHAIN_BUDGET_MS;
  let attempted = 0;
  for (const id of PROVIDER_ORDER) {
    if (!isConfigured(id)) continue;
    const remaining = deadline - Date.now();
    if (remaining < 2500) {
      console.warn('[kaizen-ai] chain budget exhausted, stopping before provider', id);
      break;
    }
    attempted++;
    try {
      const text = await withTimeout(Math.min(PER_PROVIDER_MS, remaining), (signal) =>
        dispatch(id, opts, signal),
      );
      return { text, provider: id };
    } catch (err) {
      console.warn(`[kaizen-ai] provider "${id}" failed, trying next:`, (err as Error).message);
    }
  }
  throw new Error(attempted > 0 ? 'all-providers-failed' : 'no-generative-provider');
}

function dispatch(id: AiProviderId, opts: GenerateOptions, signal?: AbortSignal): Promise<string> {
  if (id === 'ollama') return viaOllama(opts, signal);
  if (id === 'pollinations') return viaPollinations(opts, signal);
  if (id === 'huggingface') return viaHuggingFace(opts, signal);
  if (id === 'gemini') return viaGemini(opts, signal);
  // All other key-based providers share the OpenAI-compatible driver.
  return viaOpenAICompatible(id, opts, signal);
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

/** Shared driver for every OpenAI-compatible /chat/completions provider. */
async function viaOpenAICompatible(
  id: AiProviderId,
  { system, prompt, maxTokens }: GenerateOptions,
  signal?: AbortSignal,
): Promise<string> {
  const base = OA_BASE_URL[id];
  const keyEnv = KEY_ENV[id];
  const key = keyEnv ? process.env[keyEnv] : undefined;
  if (!base || !key) throw new Error(`${id} is not configured`);
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      ...(id === 'openrouter'
        ? { 'HTTP-Referer': 'https://kaizen-topaz-kappa.vercel.app', 'X-Title': 'Kaizen School Management' }
        : {}),
    },
    signal,
    body: JSON.stringify({
      model: modelFor(id),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: maxTokens ?? 600,
    }),
  });
  if (!res.ok) throw new Error(`${LABELS[id]} error: HTTP ${res.status}`);
  const json = await res.json();
  const text = (json.choices?.[0]?.message?.content || '').trim();
  if (!text) throw new Error(`${LABELS[id]} returned an empty response`);
  return text;
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

/** Short display label for chat UI ("Source: …" line). */
export function providerShortLabel(id: AiProviderId): string {
  const short: Record<AiProviderId, string> = {
    ollama: 'Ollama',
    pollinations: 'Pollinations',
    groq: 'Groq',
    cerebras: 'Cerebras',
    sambanova: 'SambaNova',
    openrouter: 'OpenRouter',
    mistral: 'Mistral',
    'github-models': 'GitHub Models',
    together: 'Together AI',
    fireworks: 'Fireworks AI',
    huggingface: 'Hugging Face',
    gemini: 'Gemini',
    'rule-based': 'Guidance',
  };
  return short[id];
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
