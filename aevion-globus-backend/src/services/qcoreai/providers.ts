/**
 * QCoreAI providers — common adapter layer for all supported LLMs.
 *
 * Two surfaces:
 *   - callProvider(...) — classic non-streaming, returns { reply, model, usage }.
 *   - streamProvider(...) — async generator yielding text chunks + final event.
 *
 * Used by both the legacy POST /api/qcoreai/chat route and the multi-agent
 * orchestrator (sequential / parallel / debate / council).
 *
 * ── Free-fleet design ──────────────────────────────────────────────────────
 * Every provider below is one of three tiers:
 *   - "premium"  — flagship reasoning (Claude Fable/Opus, GPT-4o, Grok-3).
 *                  Paid per token. Used for the hard depth roles (synthesis,
 *                  judging, analysis).
 *   - "budget"   — cheap paid models (Gemini Flash, DeepSeek, GPT-4o-mini).
 *   - "free"     — no per-token cost to the user: free-tier gateways
 *                  (OpenRouter :free, Groq, Cerebras, Together Free, GitHub
 *                  Models, Mistral free tier) and local Ollama. These are the
 *                  "crowd" — cheap parallel breadth for council/parallel modes.
 *
 * Most providers speak the OpenAI /chat/completions dialect, so they share one
 * adapter (callOpenAICompat / streamOpenAICompat) driven by OPENAI_COMPAT.
 * Only Anthropic and Gemini use their native wire formats.
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ProviderTier = "premium" | "budget" | "free";

export type Provider = {
  id: string;
  name: string;
  models: string[];
  defaultModel: string;
  envKey: string;
  configured: boolean;
  /** true = no per-token cost to the user (free-tier gateway or local). */
  free: boolean;
  /** Routing hint used by the orchestrator to assign roles cost-rationally. */
  tier: ProviderTier;
};

export type StreamEvent =
  | { kind: "text"; text: string }
  | { kind: "done"; tokensIn?: number; tokensOut?: number };

/* ═══════════════════════════════════════════════════════════════════════
   OpenAI-compatible gateway registry.

   Everything here answers POST `${baseUrl}/chat/completions` with the OpenAI
   schema. baseUrl is a getter so env overrides (OPENAI_BASE_URL, OLLAMA_BASE_URL)
   are read at call time, not module load. `keyless` gateways (Ollama) send no
   Authorization header. `extraHeaders` covers gateway-specific niceties
   (OpenRouter attribution headers).
   ═══════════════════════════════════════════════════════════════════════ */

type OpenAICompatCfg = {
  baseUrl: () => string;
  envKey: string;
  keyless?: boolean;
  extraHeaders?: () => Record<string, string>;
};

const OPENAI_COMPAT: Record<string, OpenAICompatCfg> = {
  openai: {
    baseUrl: () => (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
    envKey: "OPENAI_API_KEY",
  },
  deepseek: {
    baseUrl: () => "https://api.deepseek.com",
    envKey: "DEEPSEEK_API_KEY",
  },
  grok: {
    baseUrl: () => "https://api.x.ai/v1",
    envKey: "GROK_API_KEY",
  },
  // ── Free-tier gateways ──────────────────────────────────────────────────
  openrouter: {
    // One key → dozens of `:free` models (Llama, Qwen, DeepSeek R1, Gemma…).
    baseUrl: () => "https://openrouter.ai/api/v1",
    envKey: "OPENROUTER_API_KEY",
    extraHeaders: () => ({
      "HTTP-Referer": process.env.OPENROUTER_REFERER || "https://aevion.vercel.app",
      "X-Title": "AEVION QCoreAI",
    }),
  },
  groq: {
    baseUrl: () => "https://api.groq.com/openai/v1",
    envKey: "GROQ_API_KEY",
  },
  cerebras: {
    baseUrl: () => "https://api.cerebras.ai/v1",
    envKey: "CEREBRAS_API_KEY",
  },
  mistral: {
    baseUrl: () => "https://api.mistral.ai/v1",
    envKey: "MISTRAL_API_KEY",
  },
  together: {
    baseUrl: () => "https://api.together.xyz/v1",
    envKey: "TOGETHER_API_KEY",
  },
  github: {
    // GitHub Models — OpenAI-compatible inference, free for GitHub accounts.
    baseUrl: () => (process.env.GITHUB_MODELS_BASE_URL || "https://models.github.ai/inference").replace(/\/$/, ""),
    envKey: "GITHUB_MODELS_TOKEN",
  },
  ollama: {
    // Local runtime — fully free, no key. Opt-in via OLLAMA_BASE_URL.
    baseUrl: () => (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1").replace(/\/$/, ""),
    envKey: "OLLAMA_BASE_URL",
    keyless: true,
  },
};

function isConfigured(envKey: string): boolean {
  return !!process.env[envKey]?.trim();
}

/**
 * The full provider catalogue. Model ids are current-as-of-writing defaults and
 * can be overridden per call; free-gateway model ids in particular churn, so the
 * lists below are representative rather than exhaustive.
 */
export function getProviders(): Provider[] {
  return [
    {
      id: "anthropic",
      name: "Claude (Anthropic)",
      // claude-opus-4-8 = рабочий конь; claude-fable-5 = топ-тир под тяжёлое
      // рассуждение и финальный синтез. ВАЖНО: fable-5 / opus-4-7 / opus-4-8
      // НЕ принимают temperature.
      models: [
        "claude-opus-4-8",
        "claude-fable-5",
        "claude-sonnet-4-6",
        "claude-sonnet-4-20250514",
        "claude-haiku-4-5-20251001",
      ],
      defaultModel: process.env.QCOREAI_ANTHROPIC_MODEL || "claude-opus-4-8",
      envKey: "ANTHROPIC_API_KEY",
      configured: isConfigured("ANTHROPIC_API_KEY"),
      free: false,
      tier: "premium",
    },
    {
      id: "openai",
      name: "GPT (OpenAI)",
      models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
      defaultModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
      envKey: "OPENAI_API_KEY",
      configured: isConfigured("OPENAI_API_KEY"),
      free: false,
      tier: "premium",
    },
    {
      id: "gemini",
      name: "Gemini (Google)",
      models: ["gemini-2.5-flash", "gemini-2.0-flash-001", "gemini-1.5-pro"],
      defaultModel: "gemini-2.5-flash",
      envKey: "GEMINI_API_KEY",
      configured: isConfigured("GEMINI_API_KEY"),
      // Gemini has a genuinely free tier (rate-limited) on the Flash models.
      free: true,
      tier: "free",
    },
    {
      id: "deepseek",
      name: "DeepSeek",
      models: ["deepseek-chat", "deepseek-reasoner"],
      defaultModel: "deepseek-chat",
      envKey: "DEEPSEEK_API_KEY",
      configured: isConfigured("DEEPSEEK_API_KEY"),
      free: false,
      tier: "budget",
    },
    {
      id: "grok",
      name: "Grok (xAI)",
      models: ["grok-3", "grok-3-mini"],
      defaultModel: "grok-3-mini",
      envKey: "GROK_API_KEY",
      configured: isConfigured("GROK_API_KEY"),
      free: false,
      tier: "premium",
    },
    /* ── Free fleet ─────────────────────────────────────────────────────── */
    {
      id: "openrouter",
      name: "OpenRouter (free models)",
      models: [
        "meta-llama/llama-3.3-70b-instruct:free",
        "deepseek/deepseek-r1:free",
        "deepseek/deepseek-chat-v3-0324:free",
        "qwen/qwen-2.5-72b-instruct:free",
        "google/gemma-3-27b-it:free",
        "mistralai/mistral-small-3.2-24b-instruct:free",
        "nvidia/llama-3.1-nemotron-ultra-253b-v1:free",
      ],
      defaultModel: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
      envKey: "OPENROUTER_API_KEY",
      configured: isConfigured("OPENROUTER_API_KEY"),
      free: true,
      tier: "free",
    },
    {
      id: "groq",
      name: "Groq (free, ultra-fast)",
      models: [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "deepseek-r1-distill-llama-70b",
        "gemma2-9b-it",
        "moonshotai/kimi-k2-instruct",
      ],
      defaultModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      envKey: "GROQ_API_KEY",
      configured: isConfigured("GROQ_API_KEY"),
      free: true,
      tier: "free",
    },
    {
      id: "cerebras",
      name: "Cerebras (free, fastest)",
      models: ["llama-3.3-70b", "llama3.1-8b", "qwen-3-32b"],
      defaultModel: process.env.CEREBRAS_MODEL || "llama-3.3-70b",
      envKey: "CEREBRAS_API_KEY",
      configured: isConfigured("CEREBRAS_API_KEY"),
      free: true,
      tier: "free",
    },
    {
      id: "mistral",
      name: "Mistral (free tier)",
      models: ["mistral-small-latest", "open-mistral-nemo", "mistral-large-latest"],
      defaultModel: process.env.MISTRAL_MODEL || "mistral-small-latest",
      envKey: "MISTRAL_API_KEY",
      configured: isConfigured("MISTRAL_API_KEY"),
      free: true,
      tier: "free",
    },
    {
      id: "together",
      name: "Together (free model)",
      models: [
        "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
        "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      ],
      defaultModel: process.env.TOGETHER_MODEL || "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
      envKey: "TOGETHER_API_KEY",
      configured: isConfigured("TOGETHER_API_KEY"),
      free: true,
      tier: "free",
    },
    {
      id: "github",
      name: "GitHub Models (free)",
      models: ["openai/gpt-4o-mini", "openai/gpt-4o", "meta/Meta-Llama-3.1-70B-Instruct", "microsoft/Phi-3.5-MoE-instruct"],
      defaultModel: process.env.GITHUB_MODELS_MODEL || "openai/gpt-4o-mini",
      envKey: "GITHUB_MODELS_TOKEN",
      configured: isConfigured("GITHUB_MODELS_TOKEN"),
      free: true,
      tier: "free",
    },
    {
      id: "ollama",
      name: "Ollama (local, free)",
      models: ["llama3.1", "qwen2.5", "gemma2", "mistral", "phi3"],
      defaultModel: process.env.OLLAMA_MODEL || "llama3.1",
      envKey: "OLLAMA_BASE_URL",
      configured: isConfigured("OLLAMA_BASE_URL"),
      free: true,
      tier: "free",
    },
  ];
}

/** All configured providers whose tier is "free" (for the council swarm). */
export function getFreeProviders(): Provider[] {
  return getProviders().filter((p) => p.configured && p.free);
}

export function sanitizeMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ChatMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const role = (m as any).role;
    const content = (m as any).content;
    if (role !== "user" && role !== "assistant" && role !== "system") continue;
    if (typeof content !== "string" || !content.trim()) continue;
    out.push({ role, content: content.slice(0, 32000) });
  }
  return out.length ? out : null;
}

export function resolveProvider(providerId?: string): string {
  if (providerId) {
    const p = getProviders().find((p) => p.id === providerId);
    if (p?.configured) return p.id;
  }
  for (const p of getProviders()) {
    if (p.configured) return p.id;
  }
  return "stub";
}

/** Pick a provider id from a preference list; fallback to first configured. */
export function pickConfiguredProvider(preferred?: string): string {
  return resolveProvider(preferred);
}

/* ═══════════════════════════════════════════════════════════════════════
   Non-streaming calls (legacy /chat endpoint)
   ═══════════════════════════════════════════════════════════════════════ */

export type CallResult = {
  reply: string;
  model: string;
  usage: any;
};

/**
 * Fable 5 / Opus 4.7 / 4.8 убрали sampling-параметры: temperature, top_p, top_k
 * возвращают 400. Для этих моделей temperature НЕ отправляем (иначе chat_failed).
 */
function anthropicRejectsSampling(model: string): boolean {
  return (
    model.startsWith("claude-fable-5") ||
    model.startsWith("claude-opus-4-7") ||
    model.startsWith("claude-opus-4-8")
  );
}

async function callAnthropic(messages: ChatMessage[], model: string, temperature: number): Promise<CallResult> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");

  const systemMsg = messages.find((m) => m.role === "system");
  const chatMsgs = messages.filter((m) => m.role !== "system");

  const body: any = {
    model,
    max_tokens: 4096,
    messages: chatMsgs.map((m) => ({ role: m.role, content: m.content })),
  };
  if (!anthropicRejectsSampling(model)) body.temperature = temperature;
  if (systemMsg) body.system = systemMsg.content;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await r.json()) as any;
  if (!r.ok) throw new Error(data?.error?.message || `Anthropic ${r.status}`);
  const reply = data.content?.map((b: any) => b.text || "").join("") || "";
  return { reply, model: data.model || model, usage: data.usage || null };
}

/** Resolve the OpenAI-compat gateway config or throw a clear error. */
function openAICompatCfg(providerId: string): { url: string; headers: Record<string, string> } {
  const cfg = OPENAI_COMPAT[providerId];
  if (!cfg) throw new Error(`Unknown OpenAI-compatible provider "${providerId}"`);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!cfg.keyless) {
    const key = process.env[cfg.envKey]?.trim();
    if (!key) throw new Error(`${cfg.envKey} not configured`);
    headers.Authorization = `Bearer ${key}`;
  }
  if (cfg.extraHeaders) Object.assign(headers, cfg.extraHeaders());
  return { url: `${cfg.baseUrl()}/chat/completions`, headers };
}

/** Generic non-streaming call for any OpenAI-compatible gateway. */
async function callOpenAICompat(
  providerId: string,
  messages: ChatMessage[],
  model: string,
  temperature: number
): Promise<CallResult> {
  const { url, headers } = openAICompatCfg(providerId);
  const r = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages, temperature }),
  });
  const data = (await r.json()) as any;
  if (!r.ok) throw new Error(data?.error?.message || `${providerId} ${r.status}`);
  const reply = data.choices?.[0]?.message?.content ?? "";
  return { reply, model: data.model || model, usage: data.usage || null };
}

async function callGemini(messages: ChatMessage[], model: string, temperature: number): Promise<CallResult> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY not configured");
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMsgs = messages.filter((m) => m.role !== "system");
  const contents = chatMsgs.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const body: any = {
    contents,
    generationConfig: { temperature, maxOutputTokens: 4096 },
  };
  if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  const data = (await r.json()) as any;
  if (!r.ok) throw new Error(data?.error?.message || `Gemini ${r.status}`);
  const reply = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
  return { reply, model, usage: data.usageMetadata || null };
}

export async function callProvider(
  providerId: string,
  messages: ChatMessage[],
  model: string,
  temperature: number
): Promise<CallResult> {
  if (providerId === "anthropic") return callAnthropic(messages, model, temperature);
  if (providerId === "gemini") return callGemini(messages, model, temperature);
  if (OPENAI_COMPAT[providerId]) return callOpenAICompat(providerId, messages, model, temperature);
  throw new Error("No AI provider configured");
}

/* ═══════════════════════════════════════════════════════════════════════
   Streaming calls (multi-agent orchestrator)
   ═══════════════════════════════════════════════════════════════════════ */

/** Low-level SSE line reader: yields {event?, data} blocks separated by \n\n. */
async function* readSSEBlocks(body: ReadableStream<Uint8Array>): AsyncGenerator<{ event?: string; data: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const parsed = parseSSEBlock(block);
        if (parsed.data) yield parsed;
      }
    }
    if (buffer.trim()) {
      const parsed = parseSSEBlock(buffer);
      if (parsed.data) yield parsed;
    }
  } finally {
    try { reader.releaseLock(); } catch { /* noop */ }
  }
}

function parseSSEBlock(block: string): { event?: string; data: string } {
  let event: string | undefined;
  const dataLines: string[] = [];
  for (const rawLine of block.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).replace(/^\s/, ""));
    }
  }
  return { event, data: dataLines.join("\n") };
}

async function* streamAnthropic(
  messages: ChatMessage[],
  model: string,
  temperature: number
): AsyncGenerator<StreamEvent> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");

  const systemMsg = messages.find((m) => m.role === "system");
  const chatMsgs = messages.filter((m) => m.role !== "system");
  const body: any = {
    model,
    max_tokens: 4096,
    stream: true,
    messages: chatMsgs.map((m) => ({ role: m.role, content: m.content })),
  };
  if (!anthropicRejectsSampling(model)) body.temperature = temperature;
  if (systemMsg) body.system = systemMsg.content;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok || !r.body) {
    const text = await r.text().catch(() => "");
    throw new Error(`Anthropic ${r.status}: ${text.slice(0, 300)}`);
  }

  let tokensIn: number | undefined;
  let tokensOut: number | undefined;

  for await (const block of readSSEBlocks(r.body as any)) {
    if (!block.data) continue;
    let payload: any;
    try { payload = JSON.parse(block.data); } catch { continue; }
    const t = payload?.type;
    if (t === "content_block_delta") {
      const delta = payload?.delta;
      if (delta?.type === "text_delta" && typeof delta.text === "string") {
        yield { kind: "text", text: delta.text };
      }
    } else if (t === "message_start") {
      const u = payload?.message?.usage;
      if (u?.input_tokens != null) tokensIn = u.input_tokens;
      if (u?.output_tokens != null) tokensOut = u.output_tokens;
    } else if (t === "message_delta") {
      const u = payload?.usage;
      if (u?.output_tokens != null) tokensOut = u.output_tokens;
    }
  }
  yield { kind: "done", tokensIn, tokensOut };
}

/** Streaming call for any OpenAI-compatible gateway in OPENAI_COMPAT. */
async function* streamOpenAICompat(
  providerId: string,
  messages: ChatMessage[],
  model: string,
  temperature: number
): AsyncGenerator<StreamEvent> {
  const { url, headers } = openAICompatCfg(providerId);

  const r = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature,
      stream: true,
      stream_options: { include_usage: true },
    }),
  });
  if (!r.ok || !r.body) {
    const text = await r.text().catch(() => "");
    throw new Error(`${providerId} ${r.status}: ${text.slice(0, 300)}`);
  }

  let tokensIn: number | undefined;
  let tokensOut: number | undefined;

  for await (const block of readSSEBlocks(r.body as any)) {
    const data = block.data;
    if (!data || data === "[DONE]") continue;
    let payload: any;
    try { payload = JSON.parse(data); } catch { continue; }
    const delta = payload?.choices?.[0]?.delta?.content;
    if (typeof delta === "string" && delta.length) {
      yield { kind: "text", text: delta };
    }
    if (payload?.usage) {
      tokensIn = payload.usage.prompt_tokens ?? tokensIn;
      tokensOut = payload.usage.completion_tokens ?? tokensOut;
    }
  }
  yield { kind: "done", tokensIn, tokensOut };
}

async function* streamGemini(
  messages: ChatMessage[],
  model: string,
  temperature: number
): AsyncGenerator<StreamEvent> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY not configured");
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMsgs = messages.filter((m) => m.role !== "system");
  const contents = chatMsgs.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const body: any = {
    contents,
    generationConfig: { temperature, maxOutputTokens: 4096 },
  };
  if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent` +
    `?alt=sse&key=${key}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok || !r.body) {
    const text = await r.text().catch(() => "");
    throw new Error(`Gemini ${r.status}: ${text.slice(0, 300)}`);
  }

  let tokensIn: number | undefined;
  let tokensOut: number | undefined;

  for await (const block of readSSEBlocks(r.body as any)) {
    if (!block.data) continue;
    let payload: any;
    try { payload = JSON.parse(block.data); } catch { continue; }
    const parts = payload?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      for (const p of parts) {
        if (typeof p?.text === "string" && p.text.length) {
          yield { kind: "text", text: p.text };
        }
      }
    }
    const um = payload?.usageMetadata;
    if (um) {
      tokensIn = um.promptTokenCount ?? tokensIn;
      tokensOut = um.candidatesTokenCount ?? tokensOut;
    }
  }
  yield { kind: "done", tokensIn, tokensOut };
}

/**
 * Stream a provider. Yields { kind: "text", text } chunks as they arrive,
 * then a single { kind: "done", tokensIn?, tokensOut? } event at the end.
 */
export async function* streamProvider(
  providerId: string,
  messages: ChatMessage[],
  model: string,
  temperature: number
): AsyncGenerator<StreamEvent> {
  if (providerId === "anthropic") {
    yield* streamAnthropic(messages, model, temperature);
    return;
  }
  if (providerId === "gemini") {
    yield* streamGemini(messages, model, temperature);
    return;
  }
  if (OPENAI_COMPAT[providerId]) {
    yield* streamOpenAICompat(providerId, messages, model, temperature);
    return;
  }
  throw new Error(`streamProvider: unsupported provider "${providerId}"`);
}
