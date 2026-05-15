/**
 * QFusionAI — Hybrid AI Engine: intelligent multi-provider router.
 *
 * Endpoints:
 *   POST /api/qfusionai/route     — main routing endpoint (strategy-based)
 *   GET  /api/qfusionai/providers — list providers + live status
 *   GET  /api/qfusionai/stats     — request stats (Postgres + in-memory fallback)
 *   GET  /api/qfusionai/health    — health check
 *   GET  /api/qfusionai/openapi.json — OpenAPI spec
 */

import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import {
  callProvider,
  getProviders,
  sanitizeMessages,
  type ChatMessage,
} from "../services/qcoreai/providers";
import { rateLimit } from "../lib/rateLimit";
import { getPool } from "../lib/dbPool";

export const qfusionaiRouter = Router();

// ── Strategy types ───────────────────────────────────────────────────────────

type Strategy = "speed" | "quality" | "cost" | "auto";

// ── Category routing (existing logic, kept for auto-strategy) ────────────────

const ROUTING_BY_CATEGORY: Record<string, string[]> = {
  code: ["deepseek", "anthropic", "openai", "gemini", "grok"],
  creative: ["anthropic", "openai", "grok", "gemini", "deepseek"],
  factual: ["openai", "anthropic", "gemini", "deepseek", "grok"],
  longctx: ["gemini", "anthropic", "openai", "deepseek", "grok"],
  math: ["deepseek", "openai", "anthropic", "gemini", "grok"],
  general: ["anthropic", "openai", "gemini", "deepseek", "grok"],
};

type Category = keyof typeof ROUTING_BY_CATEGORY;

function classifyPrompt(prompt: string): Category {
  const p = prompt.toLowerCase();
  const codeHints = /\b(code|function|class|bug|error|stack ?trace|typescript|python|rust|javascript|java|c\+\+|sql|regex|api|debug|refactor|компил|функци|класс|баг|ошибк|регэксп)\b/;
  const mathHints = /\b(equation|solve|derivative|integral|matrix|prob[ae]bility|theorem|proof|уравнен|производн|интеграл|матриц|вероятн|теорем|доказательств)\b/;
  const creativeHints = /\b(story|poem|song|joke|роман|рассказ|стих|шутк|сценар|character|персонаж|metaphor|метафор)\b/;
  const factualHints = /\b(what is|when did|who is|where is|define|history of|что так|когда|кто так|где|определени|истори)\b/;
  if (codeHints.test(p)) return "code";
  if (mathHints.test(p)) return "math";
  if (creativeHints.test(p)) return "creative";
  if (prompt.length > 4000) return "longctx";
  if (factualHints.test(p)) return "factual";
  return "general";
}

// ── Strategy-based provider selection ───────────────────────────────────────

/**
 * Returns the provider id to use, plus a human-readable decision reason.
 * Strategy determines the selection algorithm:
 *   speed   — first available configured provider (fastest path)
 *   quality — preference order: anthropic > openai > gemini > deepseek > grok
 *   cost    — prefer cheapest: deepseek > gemini > openai > anthropic > grok
 *   auto    — short prompt → speed, long prompt → quality, classified
 */
function selectProviderByStrategy(
  prompt: string,
  strategy: Strategy
): { providerId: string | null; decisionReason: string } {
  const configured = getProviders().filter((p) => p.configured);
  const configuredIds = new Set(configured.map((p) => p.id));

  if (configuredIds.size === 0) {
    return { providerId: null, decisionReason: "No providers configured" };
  }

  function firstFrom(order: string[]): string | null {
    for (const id of order) {
      if (configuredIds.has(id)) return id;
    }
    return configured[0]?.id ?? null;
  }

  switch (strategy) {
    case "speed": {
      const id = firstFrom(["gemini", "openai", "anthropic", "deepseek", "grok"]);
      return {
        providerId: id,
        decisionReason: `speed strategy: selected first low-latency provider (${id ?? "none"})`,
      };
    }
    case "quality": {
      const id = firstFrom(["anthropic", "openai", "gemini", "deepseek", "grok"]);
      return {
        providerId: id,
        decisionReason: `quality strategy: selected highest-reasoning provider (${id ?? "none"})`,
      };
    }
    case "cost": {
      const id = firstFrom(["deepseek", "gemini", "openai", "anthropic", "grok"]);
      return {
        providerId: id,
        decisionReason: `cost strategy: selected lowest-cost provider (${id ?? "none"})`,
      };
    }
    case "auto":
    default: {
      if (prompt.length < 200) {
        const id = firstFrom(["gemini", "openai", "anthropic", "deepseek", "grok"]);
        return {
          providerId: id,
          decisionReason: `auto strategy: short prompt (${prompt.length} chars) → speed routing → ${id ?? "none"}`,
        };
      }
      const category = classifyPrompt(prompt);
      const order = ROUTING_BY_CATEGORY[category] ?? ROUTING_BY_CATEGORY.general;
      const id = firstFrom(order);
      return {
        providerId: id,
        decisionReason: `auto strategy: prompt classified as "${category}" (len=${prompt.length}) → ${id ?? "none"}`,
      };
    }
  }
}

// ── In-memory stats store (fallback when DB unavailable) ────────────────────

type StatEntry = {
  strategy: Strategy;
  provider: string;
  latencyMs: number;
  tokensEstimate: number;
  createdAt: number;
};

const MEM_STATS: StatEntry[] = [];
const MEM_STATS_MAX = 100;

function pushMemStat(e: StatEntry): void {
  MEM_STATS.push(e);
  if (MEM_STATS.length > MEM_STATS_MAX) MEM_STATS.shift();
}

// ── Postgres lazy table creation ─────────────────────────────────────────────

let dbTableReady = false;

async function ensureFusionTable(): Promise<boolean> {
  if (dbTableReady) return true;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS qfusionai_requests (
        id              SERIAL PRIMARY KEY,
        strategy        TEXT,
        provider        TEXT,
        latency_ms      INTEGER,
        tokens_estimate INTEGER,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    dbTableReady = true;
    return true;
  } catch {
    return false;
  }
}

async function insertStat(entry: StatEntry): Promise<void> {
  const ready = await ensureFusionTable();
  if (!ready) return;
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO qfusionai_requests (strategy, provider, latency_ms, tokens_estimate)
       VALUES ($1, $2, $3, $4)`,
      [entry.strategy, entry.provider, entry.latencyMs, entry.tokensEstimate]
    );
  } catch {
    // silently degrade — in-memory fallback already captured the stat
  }
}

// ── Rate limiter ─────────────────────────────────────────────────────────────

const routeLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyPrefix: "qfusionai:route",
  message: "rate_limit_exceeded: max 10 routes per minute per IP",
});

// ── Endpoints ────────────────────────────────────────────────────────────────

/** GET /health */
qfusionaiRouter.get("/health", (_req, res) => {
  const providers = getProviders().map((p) => ({
    id: p.id,
    name: p.name,
    configured: p.configured,
  }));
  res.json({
    ok: true,
    module: "qfusionai",
    version: "2.0.0-mvp",
    providers,
    strategies: ["speed", "quality", "cost", "auto"],
  });
});

/** GET /providers — live status list */
qfusionaiRouter.get("/providers", (_req, res) => {
  const providers = getProviders().map((p) => ({
    id: p.id,
    name: p.name,
    configured: p.configured,
    defaultModel: p.defaultModel,
    models: p.models,
    status: p.configured ? "available" : "unconfigured",
  }));
  res.json({ providers, total: providers.length, available: providers.filter((p) => p.configured).length });
});

/** GET /stats — aggregate stats with Postgres + in-memory fallback */
qfusionaiRouter.get("/stats", async (_req, res) => {
  // Try Postgres first
  try {
    const ready = await ensureFusionTable();
    if (ready) {
      const pool = getPool();
      const [totalRes, byStrategyRes, avgLatencyRes, topProviderRes, recentRes] = await Promise.all([
        pool.query("SELECT COUNT(*)::int AS total FROM qfusionai_requests"),
        pool.query(
          "SELECT strategy, COUNT(*)::int AS cnt FROM qfusionai_requests GROUP BY strategy ORDER BY cnt DESC"
        ),
        pool.query("SELECT AVG(latency_ms)::int AS avg_latency FROM qfusionai_requests"),
        pool.query(
          "SELECT provider, COUNT(*)::int AS cnt FROM qfusionai_requests GROUP BY provider ORDER BY cnt DESC LIMIT 5"
        ),
        pool.query(
          "SELECT strategy, provider, latency_ms, tokens_estimate, created_at FROM qfusionai_requests ORDER BY created_at DESC LIMIT 10"
        ),
      ]);
      return res.json({
        source: "postgres",
        total: totalRes.rows[0]?.total ?? 0,
        byStrategy: byStrategyRes.rows,
        avgLatencyMs: avgLatencyRes.rows[0]?.avg_latency ?? 0,
        topProviders: topProviderRes.rows,
        recent: recentRes.rows,
      });
    }
  } catch {
    // fall through to in-memory
  }

  // In-memory fallback
  const total = MEM_STATS.length;
  const byStrategy: Record<string, number> = {};
  const byProvider: Record<string, number> = {};
  let latencySum = 0;
  for (const s of MEM_STATS) {
    byStrategy[s.strategy] = (byStrategy[s.strategy] ?? 0) + 1;
    byProvider[s.provider] = (byProvider[s.provider] ?? 0) + 1;
    latencySum += s.latencyMs;
  }
  const avgLatencyMs = total > 0 ? Math.round(latencySum / total) : 0;
  const topProviders = Object.entries(byProvider)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([provider, cnt]) => ({ provider, cnt }));
  const byStrategyArr = Object.entries(byStrategy)
    .sort(([, a], [, b]) => b - a)
    .map(([strategy, cnt]) => ({ strategy, cnt }));
  const recent = MEM_STATS.slice(-10)
    .reverse()
    .map((s) => ({
      strategy: s.strategy,
      provider: s.provider,
      latency_ms: s.latencyMs,
      tokens_estimate: s.tokensEstimate,
      created_at: new Date(s.createdAt).toISOString(),
    }));

  res.json({
    source: "memory",
    total,
    byStrategy: byStrategyArr,
    avgLatencyMs,
    topProviders,
    recent,
  });
});

/** POST /route — main routing endpoint */
qfusionaiRouter.post("/route", routeLimiter, async (req: Request, res: Response) => {
  const body = req.body || {};
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return res.status(400).json({ error: "prompt-required" });
  }
  if (prompt.length > 32000) {
    return res.status(413).json({ error: "prompt-too-long", maxLength: 32000 });
  }

  const rawStrategy = typeof body.strategy === "string" ? body.strategy : "auto";
  const VALID_STRATEGIES: Strategy[] = ["speed", "quality", "cost", "auto"];
  const strategy: Strategy = VALID_STRATEGIES.includes(rawStrategy as Strategy)
    ? (rawStrategy as Strategy)
    : "auto";

  const { providerId, decisionReason } = selectProviderByStrategy(prompt, strategy);

  if (!providerId) {
    return res.status(503).json({
      error: "no-provider-configured",
      strategy,
      hint: "Set ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, DEEPSEEK_API_KEY, or GROK_API_KEY on the server.",
    });
  }

  const providerMeta = getProviders().find((p) => p.id === providerId);
  if (!providerMeta) {
    return res.status(503).json({ error: "provider-not-found", provider: providerId });
  }

  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : providerMeta.defaultModel;

  const temperature = typeof body.temperature === "number" ? body.temperature : 0.7;
  const context = typeof body.context === "string" ? body.context.trim() : null;

  const messages: ChatMessage[] =
    sanitizeMessages(body.messages) ?? [
      {
        role: "system",
        content:
          "You are AEVION QFusionAI, an intelligent AI assistant. Answer clearly and concisely." +
          (context ? `\n\nContext: ${context}` : ""),
      },
      { role: "user", content: prompt },
    ];

  // Rough token estimate: ~4 chars per token
  const tokensEstimate = Math.ceil(
    messages.reduce((acc, m) => acc + m.content.length, 0) / 4
  );

  const t0 = Date.now();
  try {
    const result = await callProvider(providerId, messages, model, temperature);
    const latencyMs = Date.now() - t0;

    const stat: StatEntry = {
      strategy,
      provider: providerId,
      latencyMs,
      tokensEstimate,
      createdAt: Date.now(),
    };
    pushMemStat(stat);
    insertStat(stat).catch(() => void 0); // fire-and-forget

    return res.json({
      result: result.reply,
      provider: providerId,
      providerName: providerMeta.name,
      model: result.model,
      strategy,
      latencyMs,
      tokensEstimate,
      decision_reason: decisionReason,
      usage: result.usage ?? null,
    });
  } catch (err) {
    const latencyMs = Date.now() - t0;
    return res.status(502).json({
      error: "provider-error",
      provider: providerId,
      strategy,
      latencyMs,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

// ── OpenAPI spec ─────────────────────────────────────────────────────────────

qfusionaiRouter.options("/openapi.json", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.status(204).end();
});

qfusionaiRouter.get("/openapi.json", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const base = (process.env.PUBLIC_BACKEND_URL ?? "https://api.aevion.app").replace(/\/$/, "");
  res.json({
    openapi: "3.1.0",
    info: {
      title: "AEVION QFusionAI",
      version: "2.0.0",
      description:
        "Hybrid AI Engine — multi-provider LLM router with strategy-based selection (speed/quality/cost/auto). " +
        "Supports Anthropic, OpenAI, Gemini, DeepSeek, Grok with automatic fallback.",
      contact: { name: "AEVION", url: "https://aevion.app", email: "support@aevion.app" },
    },
    servers: [{ url: `${base}/api/qfusionai`, description: "Production" }],
    paths: {
      "/health": {
        get: {
          summary: "Health + configured providers",
          responses: {
            "200": {
              description: "ok",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      module: { type: "string" },
                      version: { type: "string" },
                      providers: { type: "array", items: { type: "object" } },
                      strategies: { type: "array", items: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/providers": {
        get: {
          summary: "List all providers with live status",
          responses: {
            "200": {
              description: "Provider list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      providers: { type: "array", items: { type: "object" } },
                      total: { type: "integer" },
                      available: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/stats": {
        get: {
          summary: "Request statistics",
          responses: {
            "200": {
              description: "Stats",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      source: { type: "string", enum: ["postgres", "memory"] },
                      total: { type: "integer" },
                      byStrategy: { type: "array" },
                      avgLatencyMs: { type: "integer" },
                      topProviders: { type: "array" },
                      recent: { type: "array" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/route": {
        post: {
          summary: "Route a prompt to the best AI provider by strategy",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["prompt"],
                  properties: {
                    prompt: { type: "string", maxLength: 32000 },
                    strategy: {
                      type: "string",
                      enum: ["speed", "quality", "cost", "auto"],
                      default: "auto",
                      description:
                        "speed: first fast provider; quality: best reasoning provider; cost: cheapest provider; auto: classify by length+content",
                    },
                    context: { type: "string", description: "Optional system context injected into prompt" },
                    model: { type: "string" },
                    temperature: { type: "number", minimum: 0, maximum: 2 },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Routed reply with metadata",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      result: { type: "string" },
                      provider: { type: "string" },
                      providerName: { type: "string" },
                      model: { type: "string" },
                      strategy: { type: "string" },
                      latencyMs: { type: "integer" },
                      tokensEstimate: { type: "integer" },
                      decision_reason: { type: "string" },
                    },
                  },
                },
              },
            },
            "400": { description: "prompt missing" },
            "413": { description: "prompt too long" },
            "429": { description: "rate limit exceeded" },
            "503": { description: "no configured provider" },
          },
        },
      },
    },
  });
});

// ── MVP concept board surface ───────────────────────────────────────────────
interface QFusionAIConceptMessage {
  id: string;
  payload: Record<string, unknown>;
  tags: string[];
  createdAt: string;
}

const QFUSIONAI_CONCEPT_MAX = 200;
const qfusionaiConceptMessages: QFusionAIConceptMessage[] = [];

qfusionaiRouter.get("/status", routeLimiter, (_req: Request, res: Response) => {
  res.json({
    module: "qfusionai",
    code: "QFUSIONAI",
    status: "mvp",
    description: "Hybrid AI engine: route requests across multiple AI providers with smart selection + concept board.",
    endpoints: {
      health: "/api/qfusionai/health",
      route: "/api/qfusionai/route",
      conceptMessages: "/api/qfusionai/concept/messages",
      conceptStats: "/api/qfusionai/concept-stats",
    },
    conceptMessagesCount: qfusionaiConceptMessages.length,
    timestamp: new Date().toISOString(),
  });
});

qfusionaiRouter.get("/concept/messages", routeLimiter, (req: Request, res: Response) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "20"), 10) || 20, 1), 100);
  const items = qfusionaiConceptMessages.slice(0, limit);
  res.json({ items, total: qfusionaiConceptMessages.length, moduleId: "qfusionai", noun: "concept/messages" });
});

qfusionaiRouter.post("/concept/messages", routeLimiter, (req: Request, res: Response) => {
  try {
    const body = (req.body && typeof req.body === "object") ? req.body as Record<string, unknown> : {};
    const payload = (body.payload && typeof body.payload === "object")
      ? body.payload as Record<string, unknown>
      : body;
    const idea = String(payload.idea ?? payload.title ?? "").trim().slice(0, 200);
    if (!idea) return res.status(400).json({ error: "missing_field", field: "idea" });
    const rationale = String(payload.rationale ?? payload.summary ?? "").trim().slice(0, 800);
    const author = String(payload.author ?? "").trim().slice(0, 80);
    const tagsRaw = Array.isArray(payload.tags) ? payload.tags : ["qfusionai"];
    const tags = tagsRaw.map((t) => String(t).trim().slice(0, 30)).filter(Boolean).slice(0, 6);
    const msg: QFusionAIConceptMessage = {
      id: crypto.randomUUID(),
      payload: { idea, rationale, author },
      tags: tags.length ? tags : ["qfusionai"],
      createdAt: new Date().toISOString(),
    };
    qfusionaiConceptMessages.unshift(msg);
    if (qfusionaiConceptMessages.length > QFUSIONAI_CONCEPT_MAX) {
      qfusionaiConceptMessages.length = QFUSIONAI_CONCEPT_MAX;
    }
    return res.status(201).json(msg);
  } catch (err: unknown) {
    console.error("[qfusionai] concept_post_failed", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "concept_post_failed" });
  }
});

qfusionaiRouter.get("/concept-stats", routeLimiter, (_req: Request, res: Response) => {
  const now = Date.now();
  const sevenDays = 7 * 86_400_000;
  const last7d = qfusionaiConceptMessages.filter(
    (m) => now - new Date(m.createdAt).getTime() <= sevenDays,
  ).length;
  const tagCounts = new Map<string, number>();
  for (const m of qfusionaiConceptMessages) {
    for (const t of m.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));
  res.json({
    moduleId: "qfusionai",
    noun: "concept/messages",
    total: qfusionaiConceptMessages.length,
    last7d,
    topTags,
  });
});
