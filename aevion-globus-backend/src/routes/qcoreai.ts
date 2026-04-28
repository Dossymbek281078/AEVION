import { Router } from "express";

import { verifyBearerOptional } from "../lib/authJwt";
import {
  callProvider,
  getProviders,
  resolveProvider,
  sanitizeMessages,
} from "../services/qcoreai/providers";
import { AgentOverride } from "../services/qcoreai/agents";
import {
  runMultiAgent,
  OrchestratorEvent,
  PipelineStrategy,
} from "../services/qcoreai/orchestrator";
import { getPricingTable, costUsd } from "../services/qcoreai/pricing";
import { getDbError, isDbReady } from "../lib/ensureQCoreTables";
import { rateLimit } from "../lib/rateLimit";
import { isWebhookConfigured, notifyRunCompleted } from "../lib/qcoreWebhook";
import {
  applyRefinement,
  buildHistoryContext,
  createRun,
  deleteSession,
  deleteUserWebhook,
  ensureSession,
  finishRun,
  getAnalytics,
  getMaxOrdering,
  getRun,
  getRunByShareToken,
  getSession,
  getSessionPublic,
  getUserWebhook,
  getUserWebhookForRun,
  insertMessage,
  listMessages,
  listRuns,
  listSessions,
  renameSession,
  renameSessionIfDefault,
  searchRuns,
  setRunTags,
  setUserWebhook,
  shareRun,
  touchSession,
  unshareRun,
} from "../services/qcoreai/store";

export const qcoreaiRouter = Router();

/* ═══════════════════════════════════════════════════════════════════════
   Legacy single-shot chat (kept for backwards compatibility)
   POST /api/qcoreai/chat
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/chat", async (req, res) => {
  try {
    const messages = sanitizeMessages(req.body?.messages);
    if (!messages) {
      return res.status(400).json({ error: "messages required" });
    }
    const requestedProvider = typeof req.body?.provider === "string" ? req.body.provider : undefined;
    const providerId = resolveProvider(requestedProvider);

    if (providerId === "stub") {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      return res.json({
        mode: "stub",
        provider: "none",
        model: "none",
        reply:
          `[QCoreAI — no AI provider configured]\n\nYour question: "${lastUser?.content?.slice(0, 200) || ""}"\n\n` +
          `To enable AI responses, add one of these API keys to the backend environment:\n` +
          `- ANTHROPIC_API_KEY (Claude)\n- OPENAI_API_KEY (GPT-4)\n- GEMINI_API_KEY (Gemini)\n- DEEPSEEK_API_KEY (DeepSeek)\n- GROK_API_KEY (Grok)`,
        usage: null,
      });
    }

    const provider = getProviders().find((p) => p.id === providerId)!;
    const modelName = (typeof req.body?.model === "string" && req.body.model) || provider.defaultModel;
    const temperature = typeof req.body?.temperature === "number" ? req.body.temperature : 0.6;

    const result = await callProvider(providerId, messages, modelName, temperature);
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

/* ═══════════════════════════════════════════════════════════════════════
   Providers + pricing + health
   ═══════════════════════════════════════════════════════════════════════ */

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

qcoreaiRouter.get("/pricing", (_req, res) => {
  res.json({
    currency: "USD",
    unit: "per 1,000,000 tokens",
    table: getPricingTable(),
    updatedAt: "2026-04",
    note:
      "Representative list prices for display in the cost dashboard. Exact billing is determined by the upstream provider invoices.",
  });
});

qcoreaiRouter.get("/health", async (_req, res) => {
  const providers = getProviders();
  const configured = providers.filter((p) => p.configured);
  // Trigger lazy DB probe so the storage mode is known at health-check time.
  try {
    const { ensureQCoreTables } = await import("../lib/ensureQCoreTables");
    const { getPool } = await import("../lib/dbPool");
    await ensureQCoreTables(getPool());
  } catch { /* probe errors are reflected via isDbReady() */ }
  const envCap = parseEnvCap();
  res.json({
    service: "qcoreai",
    ok: true,
    configuredProviders: configured.map((p) => p.id),
    totalProviders: providers.length,
    activeProvider: resolveProvider(),
    storage: isDbReady() ? "postgres" : "in-memory",
    storageError: isDbReady() ? null : getDbError(),
    webhookConfigured: isWebhookConfigured(),
    costCapDefaultUsd: envCap,
    at: new Date().toISOString(),
  });
});

/**
 * Parse the env hard-cap. Allows ops to set a global guardrail per worker:
 *   QCORE_HARD_CAP_USD=0.50
 * Per-request body field `costCapUsd` overrides this default downward.
 */
function parseEnvCap(): number | null {
  const raw = process.env.QCORE_HARD_CAP_USD;
  if (!raw) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* ═══════════════════════════════════════════════════════════════════════
   Sessions CRUD
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.get("/sessions", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const rows = await listSessions(auth?.sub ?? null, 50);
    res.json({ items: rows, total: rows.length, scope: auth ? "mine" : "anonymous" });
  } catch (err: any) {
    res.status(500).json({ error: "list sessions failed", details: err?.message });
  }
});

qcoreaiRouter.get("/sessions/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const session = await getSession(req.params.id, auth?.sub ?? null);
    if (!session) return res.status(404).json({ error: "session not found" });
    const runs = await listRuns(session.id, 200);
    res.json({ session, runs });
  } catch (err: any) {
    res.status(500).json({ error: "get session failed", details: err?.message });
  }
});

qcoreaiRouter.patch("/sessions/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const title = typeof req.body?.title === "string" ? req.body.title : "";
    if (!title.trim()) return res.status(400).json({ error: "title required" });
    const updated = await renameSession(req.params.id, auth?.sub ?? null, title);
    if (!updated) return res.status(404).json({ error: "session not found" });
    res.json({ session: updated });
  } catch (err: any) {
    res.status(500).json({ error: "rename failed", details: err?.message });
  }
});

qcoreaiRouter.delete("/sessions/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const ok = await deleteSession(req.params.id, auth?.sub ?? null);
    if (!ok) return res.status(404).json({ error: "session not found" });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "delete session failed", details: err?.message });
  }
});

/**
 * PATCH /api/qcoreai/runs/:id/tags
 * Replace the run's tags. Owner-only. Body: { tags: string[] }.
 */
qcoreaiRouter.patch("/runs/:id/tags", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const incoming = Array.isArray(req.body?.tags) ? req.body.tags : null;
    if (incoming === null) {
      return res.status(400).json({ error: "tags must be an array of strings" });
    }
    const updated = await setRunTags(String(req.params.id), auth?.sub ?? null, incoming);
    if (!updated) return res.status(404).json({ error: "run not found or forbidden" });
    res.json({ ok: true, tags: updated.tags });
  } catch (err: any) {
    res.status(500).json({ error: "set tags failed", details: err?.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Per-user webhook (multi-tenant overlay on the env-based webhook)
   GET    /api/qcoreai/me/webhook       — returns { url?, hasSecret }
   PUT    /api/qcoreai/me/webhook       — body: { url, secret? }
   DELETE /api/qcoreai/me/webhook
   Auth required (no anon webhooks; env webhook still exists for global use).
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.get("/me/webhook", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const hook = await getUserWebhook(auth.sub);
    if (!hook) return res.json({ configured: false });
    res.json({
      configured: true,
      url: hook.url,
      hasSecret: !!hook.secret,
      updatedAt: hook.updatedAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: "get webhook failed", details: err?.message });
  }
});

qcoreaiRouter.put("/me/webhook", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const url = typeof req.body?.url === "string" ? req.body.url.trim() : "";
    if (!/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: "url must be http(s)://..." });
    }
    const secret =
      typeof req.body?.secret === "string" && req.body.secret.length > 0
        ? req.body.secret
        : null;
    const row = await setUserWebhook(auth.sub, url, secret);
    res.json({
      configured: true,
      url: row.url,
      hasSecret: !!row.secret,
      updatedAt: row.updatedAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: "set webhook failed", details: err?.message });
  }
});

qcoreaiRouter.delete("/me/webhook", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const ok = await deleteUserWebhook(auth.sub);
    res.json({ ok, configured: false });
  } catch (err: any) {
    res.status(500).json({ error: "delete webhook failed", details: err?.message });
  }
});

qcoreaiRouter.get("/runs/:id", async (req, res) => {
  try {
    const run = await getRun(req.params.id);
    if (!run) return res.status(404).json({ error: "run not found" });
    const auth = verifyBearerOptional(req);
    const session = await getSession(run.sessionId, auth?.sub ?? null);
    if (!session) return res.status(403).json({ error: "forbidden" });
    const messages = await listMessages(run.id);
    res.json({ run, messages });
  } catch (err: any) {
    res.status(500).json({ error: "get run failed", details: err?.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Shared runs (public, read-only)
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/runs/:id/share", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const token = await shareRun(req.params.id, auth?.sub ?? null);
    if (!token) return res.status(404).json({ error: "run not found" });
    res.json({ token });
  } catch (err: any) {
    res.status(500).json({ error: "share failed", details: err?.message });
  }
});

qcoreaiRouter.delete("/runs/:id/share", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const ok = await unshareRun(req.params.id, auth?.sub ?? null);
    if (!ok) return res.status(404).json({ error: "run not found or not shared" });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "unshare failed", details: err?.message });
  }
});

/**
 * Public read-only endpoint. No auth. Anyone with the token sees the run's
 * agent trace and final answer. Sensitive fields (session.userId, agentConfig
 * with raw system prompts) are stripped.
 */
const sharedLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyPrefix: "qcore-shared",
  message: "Too many requests to the public share endpoint. Please retry later.",
});

qcoreaiRouter.get("/shared/:token", sharedLimiter, async (req, res) => {
  try {
    const run = await getRunByShareToken(String(req.params.token || ""));
    if (!run) return res.status(404).json({ error: "not found" });
    const session = await getSessionPublic(run.sessionId);
    const messages = await listMessages(run.id);
    // Strip raw system prompts from agentConfig to avoid leaking custom prompts.
    const safeConfig = run.agentConfig && typeof run.agentConfig === "object"
      ? {
          strategy: run.agentConfig.strategy ?? run.strategy ?? "sequential",
          maxRevisions: run.agentConfig.maxRevisions ?? null,
          overrides: scrubOverrides(run.agentConfig.overrides),
        }
      : null;
    const safeRun = {
      id: run.id,
      strategy: run.strategy,
      status: run.status,
      userInput: run.userInput,
      finalContent: run.finalContent,
      totalDurationMs: run.totalDurationMs,
      totalCostUsd: run.totalCostUsd,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      agentConfig: safeConfig,
    };
    res.json({ session, run: safeRun, messages });
  } catch (err: any) {
    res.status(500).json({ error: "shared lookup failed", details: err?.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Analytics
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.get("/analytics", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const summary = await getAnalytics(auth?.sub ?? null);
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: "analytics failed", details: err?.message });
  }
});

/**
 * GET /api/qcoreai/search?q=...
 * Substring search across the caller's runs. Matches userInput,
 * finalContent, and parent session.title. Used by the sidebar quick-find.
 */
qcoreaiRouter.get("/search", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const q = String(req.query.q ?? "").trim().slice(0, 200);
    const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit ?? "30"), 10) || 30));
    if (!q) return res.json({ items: [], query: "" });
    const items = await searchRuns(auth?.sub ?? null, q, limit);
    res.json({ items, query: q });
  } catch (err: any) {
    res.status(500).json({ error: "search failed", details: err?.message });
  }
});

/**
 * GET /api/qcoreai/runs/:id/export?format=json|md
 * Returns a clean, shareable snapshot of a run: agents, messages, final answer,
 * token/cost totals. Useful for investor demos and offline review.
 */
qcoreaiRouter.get("/runs/:id/export", async (req, res) => {
  try {
    const run = await getRun(req.params.id);
    if (!run) return res.status(404).json({ error: "run not found" });
    const auth = verifyBearerOptional(req);
    const session = await getSession(run.sessionId, auth?.sub ?? null);
    if (!session) return res.status(403).json({ error: "forbidden" });
    const messages = await listMessages(run.id);
    const format = (req.query.format === "md" ? "md" : "json") as "md" | "json";
    const safeSlug = slugify(session.title || "run").slice(0, 40) || "run";
    const filename = `qcoreai-${safeSlug}-${run.id.slice(0, 8)}.${format}`;

    if (format === "json") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(JSON.stringify({ session, run, messages }, null, 2));
      return;
    }

    const md = renderRunMarkdown({ session, run, messages });
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(md);
  } catch (err: any) {
    res.status(500).json({ error: "export failed", details: err?.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Refine final answer (single-pass non-streaming)
   POST /api/qcoreai/runs/:id/refine
   Body: { instruction: string, provider?: string, model?: string, temperature?: number }
   Effect: appends a `role=final stage=refinement` message and updates the
           run's finalContent + totalCostUsd + totalDurationMs.
   ═══════════════════════════════════════════════════════════════════════ */

const refineLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyPrefix: "qcore-refine",
  message: "Too many refinements from this IP. Please retry in a minute.",
});

qcoreaiRouter.post("/runs/:id/refine", refineLimiter, async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const run = await getRun(String(req.params.id));
    if (!run) return res.status(404).json({ error: "run not found" });
    const session = await getSession(run.sessionId, auth?.sub ?? null);
    if (!session) return res.status(403).json({ error: "forbidden" });
    if (run.status === "running") {
      return res.status(409).json({ error: "run is still streaming — wait for it to finish" });
    }
    const baseFinal = run.finalContent;
    if (!baseFinal || !baseFinal.trim()) {
      return res.status(400).json({ error: "run has no final answer to refine" });
    }

    const instruction =
      typeof req.body?.instruction === "string" ? req.body.instruction.trim().slice(0, 4000) : "";
    if (!instruction) {
      return res.status(400).json({ error: "instruction required" });
    }

    const requestedProvider = typeof req.body?.provider === "string" ? req.body.provider : undefined;
    const providerId = resolveProvider(requestedProvider);
    if (providerId === "stub") {
      return res.status(503).json({ error: "no AI provider configured" });
    }
    const provider = getProviders().find((p) => p.id === providerId)!;
    const modelName =
      typeof req.body?.model === "string" && req.body.model
        ? req.body.model
        : provider.defaultModel;
    const temperature =
      typeof req.body?.temperature === "number" ? req.body.temperature : 0.5;

    const systemPrompt =
      "You are refining a previously produced answer. Apply the user's instruction " +
      "with surgical precision: keep correct content, rewrite or extend per the instruction, " +
      "preserve formatting (headings, lists, tables, code blocks). Output ONLY the refined " +
      "answer — no preamble, no meta commentary, no \"here is the refined version\" prefix.";
    const userPrompt =
      `Original task:\n${run.userInput}\n\n` +
      `Current answer:\n${baseFinal}\n\n` +
      `Refinement instruction:\n${instruction}`;

    const startedAt = Date.now();
    const result = await callProvider(
      providerId,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      modelName,
      temperature
    );
    const durationMs = Date.now() - startedAt;

    const tokensIn =
      typeof result.usage?.input_tokens === "number"
        ? result.usage.input_tokens
        : typeof result.usage?.prompt_tokens === "number"
        ? result.usage.prompt_tokens
        : typeof result.usage?.promptTokenCount === "number"
        ? result.usage.promptTokenCount
        : null;
    const tokensOut =
      typeof result.usage?.output_tokens === "number"
        ? result.usage.output_tokens
        : typeof result.usage?.completion_tokens === "number"
        ? result.usage.completion_tokens
        : typeof result.usage?.candidatesTokenCount === "number"
        ? result.usage.candidatesTokenCount
        : null;
    const cost = costUsd(providerId, result.model || modelName, tokensIn ?? 0, tokensOut ?? 0);

    const refinedContent = (result.reply || "").trim();
    if (!refinedContent) {
      return res.status(502).json({ error: "provider returned empty refinement" });
    }

    const ordering = (await getMaxOrdering(run.id)) + 1;
    const message = await insertMessage({
      runId: run.id,
      role: "final",
      stage: "refinement",
      provider: providerId,
      model: result.model || modelName,
      content: refinedContent,
      tokensIn,
      tokensOut,
      durationMs,
      costUsd: cost,
      ordering,
    });

    const updated = await applyRefinement({
      runId: run.id,
      finalContent: refinedContent,
      addCostUsd: cost,
      addDurationMs: durationMs,
    });

    res.json({
      ok: true,
      content: refinedContent,
      provider: providerId,
      model: result.model || modelName,
      tokensIn,
      tokensOut,
      durationMs,
      costUsd: cost,
      runTotalCostUsd: updated?.totalCostUsd ?? null,
      runTotalDurationMs: updated?.totalDurationMs ?? null,
      messageId: message.id,
    });
  } catch (err: any) {
    const msg = err?.message || "refine failed";
    console.error("[QCoreAI] refine error:", msg);
    res.status(500).json({ error: msg });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Multi-agent pipeline (Server-Sent Events)
   POST /api/qcoreai/multi-agent
   ═══════════════════════════════════════════════════════════════════════ */

function parseAgentOverride(raw: any): AgentOverride | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: AgentOverride = {};
  if (typeof raw.provider === "string") out.provider = raw.provider;
  if (typeof raw.model === "string") out.model = raw.model;
  if (typeof raw.temperature === "number") out.temperature = raw.temperature;
  if (typeof raw.systemPrompt === "string" && raw.systemPrompt.trim().length > 0) {
    out.systemPrompt = raw.systemPrompt.slice(0, 8000);
  }
  return Object.keys(out).length ? out : undefined;
}

const multiAgentLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  keyPrefix: "qcore-multi-agent",
  message: "Too many multi-agent runs from this IP. Please retry in a minute.",
});

qcoreaiRouter.post("/multi-agent", multiAgentLimiter, async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? null;

  const userInput = typeof req.body?.input === "string" ? req.body.input.trim().slice(0, 16000) : "";
  if (!userInput) {
    return res.status(400).json({ error: "input required" });
  }

  const strategy: PipelineStrategy =
    req.body?.strategy === "parallel" ? "parallel" :
    req.body?.strategy === "debate" ? "debate" :
    "sequential";

  const maxRevisions =
    typeof req.body?.maxRevisions === "number" ? Math.max(0, Math.min(2, req.body.maxRevisions)) : 1;

  const overrides: {
    analyst?: AgentOverride;
    writer?: AgentOverride;
    writerB?: AgentOverride;
    critic?: AgentOverride;
  } = {
    analyst: parseAgentOverride(req.body?.overrides?.analyst),
    writer: parseAgentOverride(req.body?.overrides?.writer),
    writerB: parseAgentOverride(req.body?.overrides?.writerB),
    critic: parseAgentOverride(req.body?.overrides?.critic),
  };

  // Hard cost cap. Per-request body wins; falls back to QCORE_HARD_CAP_USD env.
  // When the running total (USD) crosses the cap after any agent_end, the
  // orchestrator is shut down and the run finishes with status="capped".
  const envCap = parseEnvCap();
  const requestedCap =
    typeof req.body?.costCapUsd === "number" && req.body.costCapUsd > 0
      ? req.body.costCapUsd
      : null;
  const costCapUsd: number | null = requestedCap ?? envCap;

  let sessionId: string;
  let runId: string;
  try {
    const session = await ensureSession({
      sessionId: typeof req.body?.sessionId === "string" ? req.body.sessionId : null,
      userId,
      seedTitle: userInput,
    });
    sessionId = session.id;
    const run = await createRun({
      sessionId,
      userInput,
      agentConfig: { strategy, maxRevisions, overrides },
      strategy,
    });
    runId = run.id;
    await insertMessage({
      runId,
      role: "user",
      content: userInput,
      ordering: 0,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "session init failed", details: err?.message });
  }

  // Start SSE
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof (res as any).flushHeaders === "function") (res as any).flushHeaders();

  const send = (data: any) => {
    if (res.writableEnded || res.destroyed) return;
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Heartbeat every 20s so proxies don't drop idle connection.
  const heartbeat = setInterval(() => {
    if (res.writableEnded || res.destroyed) return;
    res.write(`: ping\n\n`);
  }, 20000);

  let aborted = false;
  let capped = false;
  req.on("close", () => {
    aborted = true;
    clearInterval(heartbeat);
  });

  send({ type: "session", sessionId, runId });
  if (costCapUsd != null) {
    send({ type: "cost_cap_set", costCapUsd });
  }

  const history = await buildHistoryContext(sessionId, 6);

  const runStart = Date.now();
  let ordering = 1;
  const pendingByKey = new Map<string, { provider: string; model: string }>();
  const stageKey = (role: string, stage: string, instance?: string) =>
    `${role}|${stage}|${instance || ""}`;
  let finalContent: string | null = null;
  let hadError: string | null = null;
  /** Tracks last completed agent output — used as partial final if the stream is aborted. */
  let lastAgentContent: string | null = null;
  let totalCost = 0;

  try {
    for await (const evt of runMultiAgent({
      userInput,
      strategy,
      overrides,
      maxRevisions,
      history,
    }) as AsyncGenerator<OrchestratorEvent>) {
      if (aborted) break;
      send(evt);

      switch (evt.type) {
        case "agent_start":
          pendingByKey.set(stageKey(evt.role, evt.stage, evt.instance), {
            provider: evt.provider,
            model: evt.model,
          });
          break;
        case "agent_end": {
          const key = stageKey(evt.role, evt.stage, evt.instance);
          const meta = pendingByKey.get(key);
          // Use the event's costUsd if present; recompute defensively otherwise.
          const agentCost =
            typeof evt.costUsd === "number"
              ? evt.costUsd
              : costUsd(meta?.provider || "", meta?.model || "", evt.tokensIn, evt.tokensOut);
          totalCost += agentCost;
          lastAgentContent = evt.content;
          await insertMessage({
            runId,
            role: evt.role,
            stage: evt.stage,
            instance: evt.instance ?? null,
            provider: meta?.provider ?? null,
            model: meta?.model ?? null,
            content: evt.content,
            tokensIn: evt.tokensIn ?? null,
            tokensOut: evt.tokensOut ?? null,
            durationMs: evt.durationMs,
            costUsd: agentCost,
            ordering: ordering++,
          });
          pendingByKey.delete(key);
          if (costCapUsd != null && totalCost >= costCapUsd) {
            capped = true;
            send({
              type: "cost_cap_hit",
              costCapUsd,
              totalCostUsd: totalCost,
              message:
                `Cost cap reached: $${totalCost.toFixed(4)} ≥ $${costCapUsd.toFixed(4)}. ` +
                "Pipeline halted before the next agent.",
            });
          }
          break;
        }
        case "final":
          finalContent = evt.content;
          await insertMessage({
            runId,
            role: "final",
            content: evt.content,
            ordering: ordering++,
          });
          break;
        case "error":
          hadError = evt.message;
          break;
        default:
          break;
      }

      // Stop iterating the orchestrator generator after a cap hit. The
      // generator's `return()` finalizer will fire and close upstream streams.
      if (capped) break;
    }
  } catch (err: any) {
    hadError = err?.message || "orchestrator crashed";
    send({ type: "error", message: hadError });
  } finally {
    clearInterval(heartbeat);
  }

  const totalDurationMs = Date.now() - runStart;

  // Persist run finalization. When the client aborted mid-stream we save the
  // last agent output as a partial final so the user can still see what
  // arrived before they hit Stop.
  let runStatus: "done" | "stopped" | "error" | "capped" = "done";
  let runFinal: string | null = finalContent;
  try {
    if (capped) {
      runStatus = "capped";
      runFinal = finalContent ?? lastAgentContent ?? null;
      await finishRun(runId, "capped", {
        error: `cost cap reached: $${totalCost.toFixed(4)} >= $${(costCapUsd ?? 0).toFixed(4)}`,
        finalContent: runFinal,
        totalDurationMs,
        totalCostUsd: totalCost,
      });
    } else if (aborted) {
      runStatus = "stopped";
      runFinal = finalContent ?? lastAgentContent ?? null;
      await finishRun(runId, "stopped", {
        error: null,
        finalContent: runFinal,
        totalDurationMs,
        totalCostUsd: totalCost,
      });
    } else if (hadError && !finalContent) {
      runStatus = "error";
      runFinal = null;
      await finishRun(runId, "error", {
        error: hadError,
        finalContent: null,
        totalDurationMs,
        totalCostUsd: totalCost,
      });
    } else {
      await finishRun(runId, "done", {
        error: hadError,
        finalContent,
        totalDurationMs,
        totalCostUsd: totalCost,
      });
    }
    await renameSessionIfDefault(sessionId, userInput);
    await touchSession(sessionId);
  } catch (e: any) {
    console.error("[QCoreAI] finishRun error:", e?.message);
  }

  // Fire-and-forget webhook for external integrations (Zapier, Make, etc.).
  // Fans out to env-based webhook (if configured) AND the run owner's
  // per-user webhook (if they set one via PUT /me/webhook). Never blocks the
  // SSE response and never throws back into the request loop.
  void (async () => {
    const extraTargets = [];
    try {
      const userHook = await getUserWebhookForRun(runId);
      if (userHook?.url) {
        extraTargets.push({ url: userHook.url, secret: userHook.secret, origin: "user" as const });
      }
    } catch { /* swallow — webhook is best-effort */ }
    if (isWebhookConfigured() || extraTargets.length > 0) {
      await notifyRunCompleted(
        {
          event: "run.completed",
          runId,
          sessionId,
          status: runStatus,
          strategy,
          userInput,
          finalContent: runFinal,
          totalDurationMs,
          totalCostUsd: totalCost,
          error: hadError ?? null,
          finishedAt: new Date().toISOString(),
        },
        extraTargets
      );
    }
  })();

  if (!aborted) {
    send({ type: "sse_end" });
    res.end();
  } else {
    try { res.end(); } catch { /* noop */ }
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Role + strategy defaults (for UI to pre-populate config dropdowns)
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.get("/agents", (_req, res) => {
  const providers = getProviders();
  const resolveDefault = (preferProvider: string, preferModel: string) => {
    const pref = providers.find((p) => p.id === preferProvider);
    if (pref?.configured) {
      const model = pref.models.includes(preferModel) ? preferModel : pref.defaultModel;
      return { provider: pref.id, model };
    }
    const any = providers.find((p) => p.configured);
    return any ? { provider: any.id, model: any.defaultModel } : null;
  };
  const primaryWriter = resolveDefault("anthropic", "claude-sonnet-4-20250514");
  let writerBDefault: { provider: string; model: string } | null = null;
  if (primaryWriter) {
    const other = providers.find((p) => p.configured && p.id !== primaryWriter.provider);
    if (other) {
      writerBDefault = { provider: other.id, model: other.defaultModel };
    } else {
      const same = providers.find((p) => p.id === primaryWriter.provider);
      if (same) {
        const altModel = same.models.find((m) => m !== primaryWriter.model) || same.defaultModel;
        writerBDefault = { provider: same.id, model: altModel };
      }
    }
  }

  res.json({
    strategies: [
      {
        id: "sequential",
        label: "Sequential",
        description:
          "Analyst → Writer → Critic → (optional) Writer revision. Classic reflection loop: one writer, one reviewer.",
        agents: ["analyst", "writer", "critic"],
      },
      {
        id: "parallel",
        label: "Parallel drafts",
        description:
          "Analyst → two Writers stream in parallel on different models → Judge synthesizes. Diversity of voice; best signal for open-ended questions.",
        agents: ["analyst", "writer", "writerB", "critic"],
      },
      {
        id: "debate",
        label: "Debate",
        description:
          "Analyst → Pro advocate ‖ Con advocate → Moderator synthesizes a balanced answer. Best for decisions, trade-offs, and stress-testing recommendations.",
        agents: ["analyst", "writer", "writerB", "critic"],
      },
    ],
    roles: [
      {
        id: "analyst",
        label: "Analyst",
        description: "Decomposes your request, extracts facts, lists risks, builds a plan.",
        default: resolveDefault("anthropic", "claude-sonnet-4-20250514"),
        temperature: 0.3,
      },
      {
        id: "writer",
        label: "Writer / Pro",
        description:
          "Sequential/Parallel: drafts the final answer. Debate: argues the Pro case.",
        default: primaryWriter,
        temperature: 0.7,
      },
      {
        id: "writerB",
        label: "Writer B / Con",
        description:
          "Parallel: second voice on a different model. Debate: argues the Con case.",
        default: writerBDefault,
        temperature: 0.7,
      },
      {
        id: "critic",
        label: "Critic / Judge / Moderator",
        description:
          "Sequential: approves or requests revision. Parallel: picks or merges drafts. Debate: synthesizes a balanced answer.",
        default: resolveDefault("anthropic", "claude-haiku-4-5-20251001"),
        temperature: 0.2,
      },
    ],
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   Helpers (local to route)
   ═══════════════════════════════════════════════════════════════════════ */

/** Remove raw system prompts from agent overrides — keeps model/provider/temperature. */
function scrubOverrides(raw: any): any {
  if (!raw || typeof raw !== "object") return null;
  const out: any = {};
  for (const k of Object.keys(raw)) {
    const v = raw[k];
    if (!v || typeof v !== "object") continue;
    out[k] = {
      provider: v.provider,
      model: v.model,
      temperature: typeof v.temperature === "number" ? v.temperature : undefined,
    };
  }
  return out;
}

function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fmtMoney(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  if (v === 0) return "$0";
  if (v < 0.0001) return "<$0.0001";
  return `$${v.toFixed(4)}`;
}

function fmtDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function renderRunMarkdown(opts: { session: any; run: any; messages: any[] }): string {
  const { session, run, messages } = opts;
  const lines: string[] = [];
  lines.push(`# ${session.title || "QCoreAI run"}`);
  lines.push("");
  lines.push(`> Exported from QCoreAI multi-agent at ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Meta");
  lines.push("");
  lines.push(`- **Session:** \`${session.id}\``);
  lines.push(`- **Run:** \`${run.id}\``);
  lines.push(`- **Strategy:** ${run.strategy || "sequential"}`);
  lines.push(`- **Status:** ${run.status}`);
  lines.push(`- **Duration:** ${fmtDuration(run.totalDurationMs)}`);
  lines.push(`- **Total cost:** ${fmtMoney(run.totalCostUsd)}`);
  lines.push(`- **Started:** ${run.startedAt}`);
  lines.push("");
  lines.push("## User input");
  lines.push("");
  lines.push(run.userInput || "");
  lines.push("");
  lines.push("## Agent trace");
  lines.push("");
  for (const m of messages) {
    if (m.role === "user" || m.role === "final") continue;
    const tag = [m.role, m.stage, m.instance].filter(Boolean).join(" · ");
    const modelInfo = [m.provider, m.model].filter(Boolean).join(" / ");
    const tok = m.tokensIn != null || m.tokensOut != null ? ` · ${m.tokensIn ?? 0}→${m.tokensOut ?? 0} tok` : "";
    const cost = m.costUsd != null ? ` · ${fmtMoney(m.costUsd)}` : "";
    const dur = m.durationMs != null ? ` · ${fmtDuration(m.durationMs)}` : "";
    lines.push(`### ${tag}${modelInfo ? `  _(${modelInfo})_` : ""}`);
    lines.push("");
    lines.push(`_${dur.replace(/^ · /, "")}${tok}${cost}_`);
    lines.push("");
    lines.push(m.content || "");
    lines.push("");
  }
  const finalMsg = messages.find((m: any) => m.role === "final");
  if (finalMsg || run.finalContent) {
    lines.push("## Final answer");
    lines.push("");
    lines.push(finalMsg?.content || run.finalContent || "");
    lines.push("");
  }
  return lines.join("\n");
}
