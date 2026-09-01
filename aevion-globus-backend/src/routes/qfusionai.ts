/**
 * QFusionAI — Hybrid AI Engine: intelligent multi-provider router.
 *
 * Endpoints:
 *   POST /api/qfusionai/route     — main routing endpoint (strategy-based)
 *   GET  /api/qfusionai/providers — list providers + live status
 *   GET  /api/qfusionai/stats     — request stats (Postgres + in-memory fallback)
 *   GET  /api/qfusionai/runs      — recent fusion runs for the caller (prompt+reply history)
 *   GET  /api/qfusionai/runs/:id  — single run detail (owner-scoped)
 *   GET  /api/qfusionai/health    — health check
 *   GET  /api/qfusionai/openapi.json — OpenAPI spec
 */

import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import { mountConceptBoard } from "../lib/conceptBoardStore";
import {
  callProvider,
  getProviders,
  sanitizeMessages,
  type ChatMessage,
} from "../services/qcoreai/providers";
import { rateLimit } from "../lib/rateLimit";
import { getPool } from "../lib/dbPool";
import { verifyBearerOptional } from "../lib/authJwt";
import { makeServiceCapture } from "../lib/sentry/platform";

export const qfusionaiRouter = Router();

const captureQFusionAIError = makeServiceCapture("qfusionai");

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

// ── Fusion runs (persisted prompt+reply history) ─────────────────────────────
//
// The stats table above only keeps telemetry (strategy/provider/latency). A run
// keeps the actual content — prompt, chosen provider, and the reply — so the
// caller can review their fusion history. Runs are scoped to an owner key
// (auth sub, or an anonymous client id) and never returned across owners, so
// one user's prompts are never exposed to another (the Vercel→Railway proxy
// masks the real IP, so IP-scoping is unreliable — we scope by client id).

let runsTableReady = false;
async function ensureRunsTable(): Promise<boolean> {
  if (runsTableReady) return true;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS qfusionai_runs (
        id              TEXT PRIMARY KEY,
        owner_key       TEXT NOT NULL,
        prompt          TEXT NOT NULL,
        strategy        TEXT,
        provider        TEXT,
        provider_name   TEXT,
        model           TEXT,
        reply           TEXT,
        latency_ms      INTEGER,
        tokens_estimate INTEGER,
        decision_reason TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS qfusionai_runs_owner_idx ON qfusionai_runs (owner_key, created_at DESC);`);
    runsTableReady = true;
    return true;
  } catch {
    return false;
  }
}

/** Owner scope for a run: authenticated user if a valid Bearer is present,
 *  otherwise a client-provided anonymous id. Returns null when neither exists —
 *  in that case the run isn't persisted (nothing to scope reads to). */
function ownerKey(req: Request, clientId?: unknown): string | null {
  const auth = verifyBearerOptional(req);
  if (auth?.sub) return `u:${auth.sub}`;
  const cid = typeof clientId === "string" ? clientId.trim().slice(0, 80) : "";
  if (cid) return `c:${cid}`;
  const q = typeof req.query.clientId === "string" ? req.query.clientId.trim().slice(0, 80) : "";
  return q ? `c:${q}` : null;
}

interface RunInsert {
  owner: string;
  prompt: string;
  strategy: string;
  provider: string;
  providerName: string;
  model: string;
  reply: string;
  latencyMs: number;
  tokensEstimate: number;
  decisionReason: string | null;
}
async function insertRun(r: RunInsert): Promise<void> {
  const ready = await ensureRunsTable();
  if (!ready) return;
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO qfusionai_runs
        (id, owner_key, prompt, strategy, provider, provider_name, model, reply, latency_ms, tokens_estimate, decision_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        crypto.randomUUID(), r.owner,
        r.prompt.slice(0, 8000), r.strategy, r.provider, r.providerName, r.model,
        r.reply.slice(0, 16000), r.latencyMs, r.tokensEstimate, r.decisionReason,
      ],
    );
  } catch {
    // history is best-effort — a persistence failure never breaks the response
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

/** GET /fusions — list recent fusion runs (Postgres + in-memory fallback) */
qfusionaiRouter.get("/fusions", async (req: Request, res: Response) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1), 100);
  const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);

  // Try Postgres first
  try {
    const ready = await ensureFusionTable();
    if (ready) {
      const pool = getPool();
      const [itemsRes, totalRes] = await Promise.all([
        pool.query(
          `SELECT id, strategy, provider, latency_ms, tokens_estimate, created_at
           FROM qfusionai_requests
           ORDER BY created_at DESC
           LIMIT $1 OFFSET $2`,
          [limit, offset]
        ),
        pool.query("SELECT COUNT(*)::int AS total FROM qfusionai_requests"),
      ]);
      return res.json({
        source: "postgres",
        total: totalRes.rows[0]?.total ?? 0,
        limit,
        offset,
        items: itemsRes.rows,
      });
    }
  } catch {
    // fall through to in-memory
  }

  // In-memory fallback — MEM_STATS is append-order, newest last
  const total = MEM_STATS.length;
  const items = MEM_STATS.slice()
    .reverse()
    .slice(offset, offset + limit)
    .map((s, idx) => ({
      id: total - offset - idx,
      strategy: s.strategy,
      provider: s.provider,
      latency_ms: s.latencyMs,
      tokens_estimate: s.tokensEstimate,
      created_at: new Date(s.createdAt).toISOString(),
    }));

  res.json({ source: "memory", total, limit, offset, items });
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
    // 28.08.2026: в ответе стоял `hint` с ИМЕНАМИ переменных окружения. Ключи
    // не утекали, но имена — это карта нашей настройки для любого вызывающего.
    // Подсказка нужна НАМ и уходит в журнал; человеку — понятная причина.
    console.error("[qfusionai] нет провайдера: задайте один из ключей ИИ на сервере");
    return res.status(503).json({
      error: "no-provider-configured",
      strategy,
      message_ru: "Модуль ИИ сейчас недоступен. Мы уже знаем о сбое.",
      message_en: "The AI module is unavailable right now. We are on it.",
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

    const owner = ownerKey(req, body.clientId);
    if (owner) {
      insertRun({
        owner,
        prompt,
        strategy,
        provider: providerId,
        providerName: providerMeta.name,
        model: result.model,
        reply: result.reply,
        latencyMs,
        tokensEstimate,
        decisionReason: decisionReason ?? null,
      }).catch(() => void 0); // fire-and-forget
    }

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
    captureQFusionAIError(err, { route: "POST /route", provider: providerId, strategy });
    return res.status(502).json({
      error: "provider-error",
      provider: providerId,
      strategy,
      latencyMs,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

// ── GET /runs — the caller's fusion history (owner-scoped) ───────────────────
qfusionaiRouter.get("/runs", routeLimiter, async (req: Request, res: Response) => {
  const owner = ownerKey(req);
  if (!owner) {
    return res.status(400).json({ error: "owner-required", hint: "Pass ?clientId=<your-anon-id> or a Bearer token." });
  }
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const ready = await ensureRunsTable();
  if (!ready) return res.json({ runs: [], total: 0, backend: "unavailable" });
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, prompt, strategy, provider, provider_name, model,
              LEFT(reply, 280) AS reply_preview, LENGTH(reply) AS reply_len,
              latency_ms, tokens_estimate, decision_reason, created_at
       FROM qfusionai_runs WHERE owner_key = $1
       ORDER BY created_at DESC LIMIT $2`,
      [owner, limit],
    );
    res.json({ runs: rows, total: rows.length, backend: "postgres" });
  } catch (e) {
    captureQFusionAIError(e, { route: "GET /runs" });
    res.status(500).json({ error: "runs-list-failed" });
  }
});

// ── GET /runs/:id — a single run in full (owner-scoped) ──────────────────────
qfusionaiRouter.get("/runs/:id", routeLimiter, async (req: Request, res: Response) => {
  const owner = ownerKey(req);
  if (!owner) {
    return res.status(400).json({ error: "owner-required", hint: "Pass ?clientId=<your-anon-id> or a Bearer token." });
  }
  const ready = await ensureRunsTable();
  if (!ready) return res.status(503).json({ error: "runs-unavailable" });
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, prompt, strategy, provider, provider_name, model, reply,
              latency_ms, tokens_estimate, decision_reason, created_at
       FROM qfusionai_runs WHERE id = $1 AND owner_key = $2 LIMIT 1`,
      [String(req.params.id), owner],
    );
    if (!rows[0]) return res.status(404).json({ error: "run-not-found" });
    res.json({ run: rows[0] });
  } catch (e) {
    captureQFusionAIError(e, { route: "GET /runs/:id" });
    res.status(500).json({ error: "run-detail-failed" });
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
      contact: {
            name: "AEVION",
            // Форма, а не почтовый ящик: у домена aevion.app нет записи MX,
            // письмо туда не доходит ни до кого. Обращения формы пишутся на
            // постоянный том и читаются защищённой ручкой — это проверено
            // соседним окном по всей цепочке, а не по виду.
            //
            // Прецедент 29.08 (коммит 886fe5657) ставил вместо мёртвого адреса
            // рабочий почтовый ящик. Здесь у поля контакта уже есть url, и он
            // решает ту же задачу, не разнося личный адрес ещё по четырём
            // ручкам. Канал раскрытия уязвимостей это НЕ меняет: он один и
            // задан в /.well-known/security.txt, у него свой сторож.
            url: "https://aevion.app/pricing/contact",
          },
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
      "/runs": {
        get: {
          summary: "Owner-scoped fusion run history (prompt + reply preview)",
          parameters: [
            { name: "clientId", in: "query", schema: { type: "string" }, description: "Anonymous client id (or send a Bearer token)" },
            { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 50 } },
          ],
          responses: { "200": { description: "run list" }, "400": { description: "owner (clientId/Bearer) required" } },
        },
      },
      "/runs/{id}": {
        get: {
          summary: "Single fusion run in full (owner-scoped)",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
            { name: "clientId", in: "query", schema: { type: "string" } },
          ],
          responses: { "200": { description: "run detail" }, "404": { description: "not found for this owner" } },
        },
      },
    },
  });
});

// ── MVP concept board surface ───────────────────────────────────────────────

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
    timestamp: new Date().toISOString(),
  });
});

mountConceptBoard({ router: qfusionaiRouter, moduleId: "qfusionai", defaultTag: "qfusionai", readLimit: routeLimiter, writeLimit: routeLimiter });
