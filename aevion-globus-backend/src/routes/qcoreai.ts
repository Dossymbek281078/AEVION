import { Router, type Request } from "express";
import { verifyBearerOptional } from "../lib/authJwt";
import { rateLimit } from "../lib/rateLimit";
import { recordChatTurn } from "../lib/chatHistory";

export const qcoreaiRouter = Router();

// 30 chat calls / min per authenticated user OR per IP for anon.
// Tuned to the LLM provider's typical RPM ceilings — anything more
// will queue at the upstream anyway, better to surface 429 here.
const chatLimiter = rateLimit({
  capacity: 30,
  refillPerSec: 30 / 60,
  keyFn: (req: Request) => {
    const sub = verifyBearerOptional(req)?.sub;
    return sub ? `user:${sub}` : `ip:${req.ip || req.socket.remoteAddress || "unknown"}`;
  },
});

type ChatMessage = { role: string; content: string };

function sanitizeMessages(raw: unknown): ChatMessage[] | null {
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

/* ═══ Provider definitions ═══ */
type Provider = {
  id: string;
  name: string;
  models: string[];
  defaultModel: string;
  envKey: string;
  configured: boolean;
};

function getProviders(): Provider[] {
  return [
    {
      id: "anthropic",
      name: "Claude (Anthropic)",
      models: ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"],
      defaultModel: "claude-sonnet-4-20250514",
      envKey: "ANTHROPIC_API_KEY",
      configured: !!process.env.ANTHROPIC_API_KEY?.trim(),
    },
    {
      id: "openai",
      name: "GPT (OpenAI)",
      models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
      defaultModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
      envKey: "OPENAI_API_KEY",
      configured: !!process.env.OPENAI_API_KEY?.trim(),
    },
    {
      id: "gemini",
      name: "Gemini (Google)",
      models: ["gemini-2.5-flash", "gemini-2.0-flash-001", "gemini-1.5-pro"],
defaultModel: "gemini-2.5-flash",
      envKey: "GEMINI_API_KEY",
      configured: !!process.env.GEMINI_API_KEY?.trim(),
    },
    {
      id: "deepseek",
      name: "DeepSeek",
      models: ["deepseek-chat", "deepseek-reasoner"],
      defaultModel: "deepseek-chat",
      envKey: "DEEPSEEK_API_KEY",
      configured: !!process.env.DEEPSEEK_API_KEY?.trim(),
    },
    {
      id: "grok",
      name: "Grok (xAI)",
      models: ["grok-3", "grok-3-mini"],
      defaultModel: "grok-3-mini",
      envKey: "GROK_API_KEY",
      configured: !!process.env.GROK_API_KEY?.trim(),
    },
  ];
}

/* ═══ Anthropic (Claude) ═══ */
async function callAnthropic(messages: ChatMessage[], model: string, temperature: number) {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");

  const systemMsg = messages.find((m) => m.role === "system");
  const chatMsgs = messages.filter((m) => m.role !== "system");

  const body: any = {
    model,
    max_tokens: 4096,
    temperature,
    messages: chatMsgs.map((m) => ({ role: m.role, content: m.content })),
  };
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

  const data = await r.json() as any;
  if (!r.ok) throw new Error(data?.error?.message || `Anthropic ${r.status}`);

  const reply = data.content?.map((b: any) => b.text || "").join("") || "";
  return { reply, model: data.model || model, usage: data.usage || null };
}

/* ═══ OpenAI (GPT) ═══ */
async function callOpenAI(messages: ChatMessage[], model: string, temperature: number) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY not configured");

  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const r = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature }),
  });

  const data = await r.json() as any;
  if (!r.ok) throw new Error(data?.error?.message || `OpenAI ${r.status}`);

  const reply = data.choices?.[0]?.message?.content ?? "";
  return { reply, model: data.model || model, usage: data.usage || null };
}

/* ═══ Gemini (Google) ═══ */
async function callGemini(messages: ChatMessage[], model: string, temperature: number) {
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
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );

  const data = await r.json() as any;
  if (!r.ok) throw new Error(data?.error?.message || `Gemini ${r.status}`);

  const reply = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
  return { reply, model, usage: null };
}

/* ═══ DeepSeek ═══ */
async function callDeepSeek(messages: ChatMessage[], model: string, temperature: number) {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) throw new Error("DEEPSEEK_API_KEY not configured");

  const r = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature }),
  });

  const data = await r.json() as any;
  if (!r.ok) throw new Error(data?.error?.message || `DeepSeek ${r.status}`);

  const reply = data.choices?.[0]?.message?.content ?? "";
  return { reply, model: data.model || model, usage: data.usage || null };
}

/* ═══ Grok (xAI) ═══ */
async function callGrok(messages: ChatMessage[], model: string, temperature: number) {
  const key = process.env.GROK_API_KEY?.trim();
  if (!key) throw new Error("GROK_API_KEY not configured");

  const r = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature }),
  });

  const data = await r.json() as any;
  if (!r.ok) throw new Error(data?.error?.message || `Grok ${r.status}`);

  const reply = data.choices?.[0]?.message?.content ?? "";
  return { reply, model: data.model || model, usage: data.usage || null };
}

/* ═══ Router: resolve provider ═══ */
function resolveProvider(providerId?: string): string {
  if (providerId) {
    const p = getProviders().find((p) => p.id === providerId);
    if (p?.configured) return p.id;
  }
  // Auto-select first configured provider (priority: anthropic > openai > gemini > deepseek > grok)
  for (const p of getProviders()) {
    if (p.configured) return p.id;
  }
  return "stub";
}

async function callProvider(providerId: string, messages: ChatMessage[], model: string, temperature: number) {
  switch (providerId) {
    case "anthropic": return callAnthropic(messages, model, temperature);
    case "openai": return callOpenAI(messages, model, temperature);
    case "gemini": return callGemini(messages, model, temperature);
    case "deepseek": return callDeepSeek(messages, model, temperature);
    case "grok": return callGrok(messages, model, temperature);
    default: throw new Error("No AI provider configured");
  }
}

/* ═══ POST /api/qcoreai/chat ═══ */
qcoreaiRouter.post("/chat", chatLimiter, async (req, res) => {
  try {
    const messages = sanitizeMessages(req.body?.messages);
    if (!messages) {
      return res.status(400).json({ error: "messages required" });
    }

    const auth = verifyBearerOptional(req);
    const conversationId =
      typeof req.body?.conversationId === "string" ? req.body.conversationId : null;

    const requestedProvider = typeof req.body?.provider === "string" ? req.body.provider : undefined;
    const providerId = resolveProvider(requestedProvider);

    // Persist the latest user turn (best-effort, doesn't block on failure).
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser && auth) {
      await recordChatTurn({
        userId: auth.sub,
        conversationId,
        role: "user",
        content: lastUser.content,
      });
    }

    if (providerId === "stub") {
      return res.json({
        mode: "stub",
        provider: "none",
        model: "none",
        reply: `[QCoreAI — no AI provider configured]\n\nYour question: "${lastUser?.content?.slice(0, 200) || ""}"\n\nTo enable AI responses, add one of these API keys to the backend environment:\n- ANTHROPIC_API_KEY (Claude)\n- OPENAI_API_KEY (GPT-4)\n- GEMINI_API_KEY (Gemini)\n- DEEPSEEK_API_KEY (DeepSeek)\n- GROK_API_KEY (Grok)`,
        usage: null,
      });
    }

    const provider = getProviders().find((p) => p.id === providerId)!;
    const modelName = (typeof req.body?.model === "string" && req.body.model) || provider.defaultModel;
    const temperature = typeof req.body?.temperature === "number" ? req.body.temperature : 0.6;

    const result = await callProvider(providerId, messages, modelName, temperature);

    if (auth) {
      await recordChatTurn({
        userId: auth.sub,
        conversationId,
        role: "assistant",
        content: result.reply,
        provider: provider.name,
        model: result.model,
        tokensIn: result.usage?.input_tokens ?? result.usage?.prompt_tokens ?? null,
        tokensOut: result.usage?.output_tokens ?? result.usage?.completion_tokens ?? null,
      });
    }

    res.json({
      mode: providerId,
      provider: provider.name,
      model: result.model,
      reply: result.reply,
      usage: result.usage,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "chat failed";
    console.error("[QCoreAI] error:", msg);
    res.status(500).json({ error: msg });
  }
});

/* ═══ GET /api/qcoreai/history ═══
 * Returns the caller's persisted turns, optionally filtered by
 * ?conversationId=. Auth required — own history only.
 */
qcoreaiRouter.get("/history", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });
  const conversationId =
    typeof req.query.conversationId === "string" ? req.query.conversationId : undefined;
  const limit = Number(req.query.limit) || 100;
  try {
    const { listChatTurns } = await import("../lib/chatHistory");
    const items = await listChatTurns({ userId: auth.sub, conversationId, limit });
    res.json({ items, total: items.length });
  } catch (err: unknown) {
    res.status(500).json({ error: "history load failed", details: err instanceof Error ? err.message : String(err) });
  }
});

/* ═══ GET /api/qcoreai/providers ═══ */
qcoreaiRouter.get("/providers", (_req, res) => {
  const providers = getProviders().map((p) => ({
    id: p.id,
    name: p.name,
    models: p.models,
    defaultModel: p.defaultModel,
    configured: p.configured,
  }));
  res.json({ providers });
});

/* ═══ GET /api/qcoreai/health ═══ */
qcoreaiRouter.get("/health", (_req, res) => {
  const providers = getProviders();
  const configured = providers.filter((p) => p.configured);
  res.json({
    service: "qcoreai",
    ok: true,
    configuredProviders: configured.map((p) => p.id),
    totalProviders: providers.length,
    activeProvider: resolveProvider(),
    at: new Date().toISOString(),
  });
});