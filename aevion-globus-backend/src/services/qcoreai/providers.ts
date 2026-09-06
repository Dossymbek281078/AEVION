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

import { recordOutcome } from "./providerHealth";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** Optional image attachment for vision-capable calls — base64 payload plus
 * its media type. Attached to the LAST user message on the wire. */
export type ChatImage = { mediaType: string; dataBase64: string };

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
  /**
   * true = runs on the user's own machine (Ollama, LM Studio, Jan, LocalAI,
   * llama.cpp). These keep working with the internet fully off — the basis for
   * the offline council. All local providers are also `free`.
   */
  local?: boolean;
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
      "HTTP-Referer": process.env.OPENROUTER_REFERER || "https://aevion.app",
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
  nvidia: {
    // NVIDIA NIM (build.nvidia.com) — OpenAI-compatible catalogue of 80+ hosted
    // models. Free tier: `nvapi-…` key, no card, ~5000 credits + 40 req/min per
    // model (prototyping, not production). Opt-in via NVIDIA_API_KEY.
    baseUrl: () => (process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/$/, ""),
    envKey: "NVIDIA_API_KEY",
  },
  // ── Local runtimes (offline-capable) ────────────────────────────────────
  // Each exposes an OpenAI-compatible /chat/completions on localhost, so the
  // same adapter drives them. Keyless. Opt-in via their *_BASE_URL env, which
  // also means they never appear in a cloud deploy unless explicitly set.
  ollama: {
    // Local runtime — fully free, no key. Opt-in via OLLAMA_BASE_URL.
    baseUrl: () => (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1").replace(/\/$/, ""),
    envKey: "OLLAMA_BASE_URL",
    keyless: true,
  },
  lmstudio: {
    // LM Studio — GUI runtime, OpenAI server on :1234. Opt-in via LMSTUDIO_BASE_URL.
    baseUrl: () => (process.env.LMSTUDIO_BASE_URL || "http://127.0.0.1:1234/v1").replace(/\/$/, ""),
    envKey: "LMSTUDIO_BASE_URL",
    keyless: true,
  },
  jan: {
    // Jan — fully-offline desktop app, OpenAI server on :1337. Opt-in via JAN_BASE_URL.
    baseUrl: () => (process.env.JAN_BASE_URL || "http://127.0.0.1:1337/v1").replace(/\/$/, ""),
    envKey: "JAN_BASE_URL",
    keyless: true,
  },
  localai: {
    // LocalAI — drop-in OpenAI replacement, default :8080. Opt-in via LOCALAI_BASE_URL.
    baseUrl: () => (process.env.LOCALAI_BASE_URL || "http://127.0.0.1:8080/v1").replace(/\/$/, ""),
    envKey: "LOCALAI_BASE_URL",
    keyless: true,
  },
  llamacpp: {
    // llama.cpp server — bare engine, default :8080. Opt-in via LLAMACPP_BASE_URL
    // (set a distinct port if sharing the host with LocalAI).
    baseUrl: () => (process.env.LLAMACPP_BASE_URL || "http://127.0.0.1:8080/v1").replace(/\/$/, ""),
    envKey: "LLAMACPP_BASE_URL",
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
      // Real `:free` slugs verified against openrouter.ai/api/v1/models (2026-07-05).
      // Ordered by observed availability: the most-requested free models
      // (llama-3.3-70b) 429 first under load, so less-saturated strong models
      // lead — this order is also the 429-fallback order. Override via
      // OPENROUTER_MODEL / per call. The catalogue churns.
      models: [
        "nvidia/nemotron-3-super-120b-a12b:free",
        "openai/gpt-oss-120b:free",
        "qwen/qwen3-next-80b-a3b-instruct:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "google/gemma-4-31b-it:free",
        "nousresearch/hermes-3-llama-3.1-405b:free",
        "qwen/qwen3-coder:free",
      ],
      defaultModel: process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-super-120b-a12b:free",
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
      id: "nvidia",
      name: "NVIDIA NIM (free tier)",
      // build.nvidia.com hosted catalogue — OpenAI-compatible ids. Adds frontier
      // free-tier breadth (NVIDIA's own Nemotron, DeepSeek R1, Llama, Qwen) to
      // the council crowd at $0. Catalogue churns; override via NVIDIA_MODEL.
      models: [
        "nvidia/llama-3.3-nemotron-super-49b-v1",
        "deepseek-ai/deepseek-r1",
        "meta/llama-3.3-70b-instruct",
        "qwen/qwen2.5-72b-instruct",
        "qwen/qwen2.5-coder-32b-instruct",
        "mistralai/mistral-large-2-instruct",
      ],
      defaultModel: process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct",
      envKey: "NVIDIA_API_KEY",
      configured: isConfigured("NVIDIA_API_KEY"),
      free: true,
      tier: "free",
    },
    /* ── Local runtimes (offline-capable) ───────────────────────────────── */
    {
      id: "ollama",
      name: "Ollama (local, offline)",
      models: ["llama3.1", "qwen2.5", "gemma2", "mistral", "phi3"],
      defaultModel: process.env.OLLAMA_MODEL || "llama3.1",
      envKey: "OLLAMA_BASE_URL",
      configured: isConfigured("OLLAMA_BASE_URL"),
      free: true,
      tier: "free",
      local: true,
    },
    {
      id: "lmstudio",
      name: "LM Studio (local, offline)",
      // Model id = whatever you've loaded in LM Studio. Override via LMSTUDIO_MODEL.
      models: ["qwen2.5-7b-instruct", "llama-3.2-3b-instruct", "mistral-7b-instruct"],
      defaultModel: process.env.LMSTUDIO_MODEL || "qwen2.5-7b-instruct",
      envKey: "LMSTUDIO_BASE_URL",
      configured: isConfigured("LMSTUDIO_BASE_URL"),
      free: true,
      tier: "free",
      local: true,
    },
    {
      id: "jan",
      name: "Jan (local, offline)",
      models: ["llama3.2-3b-instruct", "qwen2.5-7b-instruct", "mistral-7b-instruct"],
      defaultModel: process.env.JAN_MODEL || "llama3.2-3b-instruct",
      envKey: "JAN_BASE_URL",
      configured: isConfigured("JAN_BASE_URL"),
      free: true,
      tier: "free",
      local: true,
    },
    {
      id: "localai",
      name: "LocalAI (local, offline)",
      models: ["llama-3.2-3b-instruct", "qwen2.5-7b-instruct", "phi-3-mini"],
      defaultModel: process.env.LOCALAI_MODEL || "llama-3.2-3b-instruct",
      envKey: "LOCALAI_BASE_URL",
      configured: isConfigured("LOCALAI_BASE_URL"),
      free: true,
      tier: "free",
      local: true,
    },
    {
      id: "llamacpp",
      name: "llama.cpp (local, offline)",
      // The server usually ignores the model field (serves the loaded gguf).
      models: ["local-gguf"],
      defaultModel: process.env.LLAMACPP_MODEL || "local-gguf",
      envKey: "LLAMACPP_BASE_URL",
      configured: isConfigured("LLAMACPP_BASE_URL"),
      free: true,
      tier: "free",
      local: true,
    },
    // Demo/offline provider — canned responses, no network. Only appears (and
    // only "configured") when QCOREAI_STUB=1, so it never leaks into prod.
    // Lets the full council pipeline run for demos/screenshots without keys.
    ...(process.env.QCOREAI_STUB === "1"
      ? [{
          id: "stub" as const,
          name: "Demo (offline stub)",
          models: ["stub-rigorous", "stub-creative", "stub-skeptic", "stub-pragmatist", "stub-domain", "stub-synth"],
          defaultModel: "stub-rigorous",
          envKey: "QCOREAI_STUB",
          configured: true,
          free: true,
          tier: "free" as ProviderTier,
          // Marked local so the WHOLE offline pipeline (council AND debate) can
          // run through the stub with no network — offline demos/CI don't need a
          // real local runtime. Never in prod (stub only exists under STUB=1).
          local: true,
        }]
      : []),
  ];
}

/** All configured providers whose tier is "free" (for the council swarm). */
export function getFreeProviders(): Provider[] {
  return getProviders().filter((p) => p.configured && p.free);
}

/**
 * All configured providers that run locally (Ollama / LM Studio / Jan / LocalAI
 * / llama.cpp). These keep working with the internet fully off — the pool the
 * offline council draws from for both its crowd and its chair.
 */
export function getLocalProviders(): Provider[] {
  return getProviders().filter((p) => p.configured && p.local);
}

/** GET a JSON body with a short timeout; null on any failure. */
async function fetchJsonSafe(url: string, timeoutMs = 2500): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Ask a single local runtime which models are ACTUALLY pulled/loaded, so the
 * offline council convenes only models that exist (no 404s on a model the user
 * never downloaded). Best-effort: returns [] if the runtime is unreachable.
 *   - Ollama exposes the native `/api/tags` ({ models: [{ name }] }).
 *   - LM Studio / Jan / LocalAI / llama.cpp expose OpenAI `/models` ({ data:[{id}] }).
 */
export async function listRuntimeModels(providerId: string): Promise<string[]> {
  const cfg = OPENAI_COMPAT[providerId];
  if (!cfg) return [];
  const base = cfg.baseUrl(); // e.g. http://127.0.0.1:11434/v1
  if (providerId === "ollama") {
    const host = base.replace(/\/v1$/, "");
    const j = await fetchJsonSafe(`${host}/api/tags`);
    const names = Array.isArray(j?.models) ? j.models.map((m: any) => m?.name).filter(Boolean) : [];
    return names;
  }
  const j = await fetchJsonSafe(`${base}/models`);
  const ids = Array.isArray(j?.data) ? j.data.map((m: any) => m?.id).filter(Boolean) : [];
  return ids;
}

/**
 * Discover the real, pulled models for every configured LOCAL runtime, in
 * parallel. Feeds the offline council so it only assembles models that exist.
 * Providers that are unreachable or expose nothing are simply omitted.
 */
export async function discoverLocalModels(): Promise<Record<string, string[]>> {
  const locals = getLocalProviders();
  const entries = await Promise.all(
    locals.map(async (p) => [p.id, await listRuntimeModels(p.id)] as const)
  );
  const out: Record<string, string[]> = {};
  for (const [id, models] of entries) {
    if (models.length) out[id] = models;
  }
  return out;
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

async function callAnthropic(messages: ChatMessage[], model: string, temperature: number, images?: ChatImage[], maxTokens?: number): Promise<CallResult> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");

  const systemMsg = messages.find((m) => m.role === "system");
  const chatMsgs = messages.filter((m) => m.role !== "system");

  const body: any = {
    model,
    // 4096 silently truncated multi-file code generations mid-JSON (found
    // live 2026-07-22: an 8.8KB reply cut off inside a CSS string).
    max_tokens: maxTokens ?? 8192,
    messages: chatMsgs.map((m, i) => {
      if (images?.length && m.role === "user" && i === chatMsgs.length - 1) {
        return {
          role: m.role,
          content: [
            ...images.map((img) => ({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.dataBase64 } })),
            { type: "text", text: m.content },
          ],
        };
      }
      return { role: m.role, content: m.content };
    }),
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
  temperature: number,
  images?: ChatImage[],
  maxTokens?: number
): Promise<CallResult> {
  const { url, headers } = openAICompatCfg(providerId);
  const lastUserIdx = messages.map((m) => m.role).lastIndexOf("user");
  const wireMessages = images?.length
    ? messages.map((m, i) =>
        i === lastUserIdx
          ? {
              role: m.role,
              content: [
                ...images.map((img) => ({ type: "image_url", image_url: { url: `data:${img.mediaType};base64,${img.dataBase64}` } })),
                { type: "text", text: m.content },
              ],
            }
          : m
      )
    : messages;
  const r = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages: wireMessages, temperature, ...(maxTokens ? { max_tokens: maxTokens } : {}) }),
  });
  const data = (await r.json()) as any;
  if (!r.ok) {
    // Include the HTTP status AND any provider error code so callers (and the
    // 429-fallback wrapper) can classify it. OpenRouter often returns
    // {"error":{"message":"Provider returned error","code":429}} — the bare
    // message alone hides the 429.
    const code = data?.error?.code ?? r.status;
    const msg = data?.error?.message || "request failed";
    throw new Error(`${providerId} ${r.status}: ${msg} (code ${code})`);
  }
  const reply = data.choices?.[0]?.message?.content ?? "";
  return { reply, model: data.model || model, usage: data.usage || null };
}

async function callGemini(messages: ChatMessage[], model: string, temperature: number, images?: ChatImage[], maxTokens?: number): Promise<CallResult> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY not configured");
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMsgs = messages.filter((m) => m.role !== "system");
  const lastUserIdx = chatMsgs.map((m) => m.role).lastIndexOf("user");
  const contents = chatMsgs.map((m, i) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts:
      images?.length && i === lastUserIdx
        ? [
            ...images.map((img) => ({ inline_data: { mime_type: img.mediaType, data: img.dataBase64 } })),
            { text: m.content },
          ]
        : [{ text: m.content }],
  }));
  const body: any = {
    contents,
    generationConfig: { temperature, maxOutputTokens: maxTokens ?? 4096 },
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

/* ── Offline stub (QCOREAI_STUB=1) ───────────────────────────────────────── */

/** Canned demo text, flavoured by the persona detected in the system prompt. */
function stubReply(messages: ChatMessage[]): string {
  const sys = (messages.find((m) => m.role === "system")?.content || "").toLowerCase();
  const rawUser = messages.filter((m) => m.role === "user").pop()?.content || "";
  const qMatch = rawUser.match(/user question:\s*([^\n]+)/i);
  const q = (qMatch ? qMatch[1] : rawUser).trim().slice(0, 80) || "the question";
  if (sys.includes("synthesizer") || sys.includes("chair of a multi-model council")) {
    return `**Bottom line.** Combining the council's views: the strongest answer to “${q}” is the one all members converged on, with the skeptic's caveat folded in. Where they disagreed, the verifiable facts win. This fused answer keeps the rigorous member's structure, the creative member's framing, and the pragmatist's concrete next step — corrected for the one error the domain member flagged.`;
  }
  if (sys.includes("lateral-thinking") || sys.includes("creative")) {
    return `Here's the non-obvious angle on “${q}”: reframe it as a system, not a task — the leverage is upstream of where it looks. Two adjacent ideas worth stealing follow.`;
  }
  if (sys.includes("skeptic")) {
    return `Stress-testing “${q}”: the naive answer hides two assumptions and one failure mode. Name them before committing — the edge case bites at scale, not in the demo.`;
  }
  if (sys.includes("pragmatic")) {
    return `Shortest working path for “${q}”: pick the sane default, ship the minimal version, measure, iterate. Concrete first step, then the one trade-off you accept.`;
  }
  if (sys.includes("domain-expert") || sys.includes("domain")) {
    return `From a specialist's view of “${q}”: the term most people get wrong matters here, and the correct reasoning (not just the conclusion) points to a subtly different answer.`;
  }
  // Rigorous / default.
  return `Rigorous take on “${q}”: state the definition, reason step by step, and flag the one uncertainty. Correctness first; assumptions made explicit.`;
}

/**
 * Учёт расхода В КЛИЕНТЕ, а не в обработчиках (проект 06.09.2026).
 *
 * Свип показал: 49 из 52 платных точек вызова вне месячного леджера — учёт,
 * добавляемый по-ручечно, отстаёт вечно, а через ЭТОТ клиент проходят все.
 * meter — необязательный: ни один существующий вызов не ломается; вызовы с
 * userId пишутся в QCoreTokenLedger (addTokenUsage), вызовы БЕЗ метра
 * считаются в сводку неучтённых — молча ослепнуть хвост не может (§16).
 *
 * НЕ передавать meter там, где учёт уже есть своим путём: оркестратор пишет
 * QCoreMessage (стримы), devhub-генерация ограничена своей счётной квотой.
 * enforcement здесь НЕ живёт: месяц честных чисел, потом решения о пределах.
 */
export type CallMeter = { userId?: string | null; module?: string };

export function tokensFromUsage(usage: any): { tin: number; tout: number } {
  if (!usage) return { tin: 0, tout: 0 };
  return {
    tin: Number(usage.input_tokens ?? usage.prompt_tokens ?? usage.promptTokenCount ?? 0) || 0,
    tout: Number(usage.output_tokens ?? usage.completion_tokens ?? usage.candidatesTokenCount ?? 0) || 0,
  };
}

const unmeteredCalls = new Map<string, number>();
let unmeteredLastLogAt = 0;
export function __unmeteredCallCounts(): ReadonlyMap<string, number> { return unmeteredCalls; }

function noteUnmetered(module: string) {
  unmeteredCalls.set(module, (unmeteredCalls.get(module) ?? 0) + 1);
  const nowMs = Date.now();
  if (nowMs - unmeteredLastLogAt > 3_600_000) {
    unmeteredLastLogAt = nowMs;
    const rows = [...unmeteredCalls.entries()].map(([m, n]) => `${m}=${n}`).join(", ");
    console.warn(`[qcoreai] платные вызовы БЕЗ учёта за процесс: ${rows}`);
  }
}

async function meterCall(meter: CallMeter | undefined, providerId: string, model: string, usage: any): Promise<void> {
  if (!meter || !meter.userId) {
    noteUnmetered(meter?.module ?? "unknown");
    return;
  }
  const { tin, tout } = tokensFromUsage(usage);
  try {
    // Ленивый импорт: store статически импортирует providers, обратное ребро
    // замкнуло бы цикл модулей.
    const { addTokenUsage } = await import("./store");
    await addTokenUsage(meter.userId, tin, tout, { provider: providerId, model });
  } catch (e) {
    // Учёт не роняет ответ, ради которого его зовут, — но и не молчит.
    console.error(`[qcoreai] учёт вызова не записан (${meter.module ?? "?"}):`, e instanceof Error ? e.message : e);
  }
}

export async function callProvider(
  providerId: string,
  messages: ChatMessage[],
  model: string,
  temperature: number,
  images?: ChatImage[],
  maxTokens?: number,
  meter?: CallMeter
): Promise<CallResult> {
  if (providerId === "stub") {
    const reply = stubReply(messages);
    const res = { reply, model, usage: { input_tokens: 40, output_tokens: reply.split(/\s+/).length } };
    await meterCall(meter, providerId, model, res.usage);
    return res;
  }
  let res: CallResult;
  if (providerId === "anthropic") res = await callAnthropic(messages, model, temperature, images, maxTokens);
  else if (providerId === "gemini") res = await callGemini(messages, model, temperature, images, maxTokens);
  else if (OPENAI_COMPAT[providerId]) res = await callOpenAICompat(providerId, messages, model, temperature, images, maxTokens);
  else throw new Error("No AI provider configured");
  await meterCall(meter, providerId, model, res.usage);
  return res;
}

async function* streamStub(messages: ChatMessage[]): AsyncGenerator<StreamEvent> {
  const reply = stubReply(messages);
  const words = reply.split(/(\s+)/);
  for (const w of words) {
    yield { kind: "text", text: w };
    // Small delay so the demo streams visibly; skipped in test/CI (fast path).
    if (process.env.QCOREAI_STUB_DELAY !== "0") {
      await new Promise((r) => setTimeout(r, 12));
    }
  }
  yield { kind: "done", tokensIn: 40, tokensOut: words.filter((w) => w.trim()).length };
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
  if (providerId === "stub") {
    yield* streamStub(messages);
    return;
  }
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

/* ═══════════════════════════════════════════════════════════════════════
   429-resilient wrappers.

   Free-tier gateways (OpenRouter etc.) return 429 when a popular free model is
   saturated. For FREE providers only, if a call fails with a retryable status
   BEFORE any text has streamed, we transparently fall back to the next model in
   that provider's list (capped at MAX_FALLBACK attempts). Paid providers get no
   silent model swap — a model change there has cost/behaviour implications the
   caller didn't ask for.
   ═══════════════════════════════════════════════════════════════════════ */

const MAX_FALLBACK = 4;

/** A provider error worth retrying on a different model (rate-limit / transient). */
function isRetryableProviderError(e: unknown): boolean {
  const m = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return (
    /\b(429|502|503|529)\b/.test(m) ||
    m.includes("rate-limit") ||
    m.includes("rate limit") ||
    m.includes("rate_limit") ||
    m.includes("overloaded") ||
    m.includes("temporarily") ||
    m.includes("timeout")
  );
}

/** Candidate models for a call: the requested one first, then (for free
    providers only) the rest of that provider's list, capped at MAX_FALLBACK. */
function fallbackCandidates(providerId: string, model: string): string[] {
  const prov = getProviders().find((p) => p.id === providerId);
  if (!prov || !prov.free) return [model];
  const rest = prov.models.filter((m) => m !== model);
  return [model, ...rest].slice(0, MAX_FALLBACK);
}

/** Non-streaming call with free-model fallback on retryable errors. */
export async function callProviderResilient(
  providerId: string,
  messages: ChatMessage[],
  model: string,
  temperature: number,
  meter?: CallMeter
): Promise<CallResult> {
  const candidates = fallbackCandidates(providerId, model);
  let lastErr: unknown;
  for (let i = 0; i < candidates.length; i++) {
    const t0 = Date.now();
    try {
      const res = await callProvider(providerId, messages, candidates[i], temperature, undefined, undefined, meter);
      recordOutcome(providerId, candidates[i], true, Date.now() - t0);
      return res;
    } catch (e) {
      recordOutcome(providerId, candidates[i], false);
      lastErr = e;
      if (!isRetryableProviderError(e) || i === candidates.length - 1) throw e;
      // otherwise: try the next free model
    }
  }
  throw lastErr;
}

/**
 * Streaming call with free-model fallback. Falls back to the next model ONLY if
 * the failure happens before any text was emitted (a mid-stream failure can't be
 * un-streamed, so it propagates). Yields the same events as streamProvider.
 */
export async function* streamProviderResilient(
  providerId: string,
  messages: ChatMessage[],
  model: string,
  temperature: number
): AsyncGenerator<StreamEvent> {
  const candidates = fallbackCandidates(providerId, model);
  let lastErr: unknown;
  for (let i = 0; i < candidates.length; i++) {
    let emitted = false;
    try {
      for await (const ev of streamProvider(providerId, messages, candidates[i], temperature)) {
        if (ev.kind === "text" && ev.text) emitted = true;
        yield ev;
      }
      recordOutcome(providerId, candidates[i], true);
      return; // completed successfully
    } catch (e) {
      recordOutcome(providerId, candidates[i], false);
      lastErr = e;
      // Can't retry once text is out, or if error isn't retryable, or if this
      // was the last candidate.
      if (emitted || !isRetryableProviderError(e) || i === candidates.length - 1) throw e;
    }
  }
  if (lastErr) throw lastErr;
}
