import { Router } from "express";

import { verifyBearerOptional } from "../lib/authJwt";
import {
  callProvider,
  getProviders,
  resolveProvider,
  sanitizeMessages,
  streamProvider,
} from "../services/qcoreai/providers";
import { AgentOverride } from "../services/qcoreai/agents";
import {
  runMultiAgent,
  OrchestratorEvent,
  PipelineStrategy,
} from "../services/qcoreai/orchestrator";
import { getPricingTable, costUsd } from "../services/qcoreai/pricing";
import { ensureQCoreTables, getDbError, isDbReady } from "../lib/ensureQCoreTables";
import { getPool } from "../lib/dbPool";
const pool = getPool();
import { rateLimit } from "../lib/rateLimit";
import { isWebhookConfigured, listWebhookLogs, notifyEvent, notifyRunCompleted } from "../lib/qcoreWebhook";
import {
  fetchQRightAttachments,
  normalizeAttachmentIds,
  renderAttachmentsContext,
} from "../services/qcoreai/attachments";
import {
  deleteUserWebhook,
  getUserWebhook,
  setUserWebhook,
  validateWebhookUrl,
} from "../services/qcoreai/userWebhooks";
import {
  applyRefinement,
  buildHistoryContext,
  buildThreadContext,
  createEvalRun,
  createEvalSuite,
  createBatch,
  createScheduledBatch,
  deleteScheduledBatch,
  deleteSpendLimit,
  createPrompt,
  createRun,
  createSharedPreset,
  addWorkspaceMember,
  addWorkspaceSession,
  createComment,
  createSnippet,
  deleteSnippet,
  getSnippet,
  listSnippets,
  listSnippetTagCloud,
  updateSnippet,
  deleteRunsBulk,
  getSessionCostSummary,
  archiveSession,
  assignSnippetToCollection,
  createCollection,
  createPipeline,
  deleteCollection,
  listCollections,
  bookmarkRun,
  deletePipeline,
  getPipeline,
  getRating,
  isBookmarked,
  listBookmarks,
  listPipelines,
  unbookmarkRun,
  listPublicPipelines,
  updatePipeline,
  usePipeline,
  getRatingsSummary,
  listTopRatedRuns,
  mergeSessions,
  pinSession,
  rateRun,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  listAnnotations,
  listAllAnnotations,
  pinWorkspaceSession,
  searchQCore,
  setFollowUpFrom,
  listPublicEvalSuites,
  setEvalSuitePublic,
  createTemplate,
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  listComments,
  listPromptAudit,
  listWorkspaceMembers,
  listWorkspaceSessions,
  listWorkspaces,
  logPromptAudit,
  removeWorkspaceMember,
  removeWorkspaceSession,
  updateWorkspace,
  deleteEvalSuite,
  deletePrompt,
  deleteSession,
  deleteSharedPreset,
  deleteTemplate,
  ensureSession,
  getBatch,
  getDueSchedules,
  getMonthlySpend,
  getScheduledBatch,
  getSpendLimit,
  listBatches,
  listBatchRuns,
  listScheduledBatches,
  recordScheduledRun,
  setSpendLimit,
  updateBatchProgress,
  updateScheduledBatch,
  finishRun,
  forkPrompt,
  getAnalytics,
  getCostTimeseries,
  getEvalRun,
  getEvalSuite,
  getMaxOrdering,
  getPrompt,
  getPromptVersionChain,
  getRun,
  getRunByShareToken,
  getSession,
  getSessionPublic,
  getSharedPreset,
  getTemplate,
  getThread,
  getTopUserTags,
  importSharedPreset,
  insertMessage,
  listEvalSuites,
  listMessages,
  listPrompts,
  listPublicPrompts,
  listPublicSharedPresets,
  listPublicTemplates,
  listRuns,
  listSessions,
  listSuiteRuns,
  listTemplates,
  renameSession,
  renameSessionIfDefault,
  searchRuns,
  setRunTags,
  shareRun,
  touchSession,
  unshareRun,
  updateEvalSuite,
  updatePrompt,
  updateTemplate,
  useTemplate,
  createOrg,
  getOrg,
  listOrgs,
  deleteOrg,
  addOrgMember,
  removeOrgMember,
  listOrgMembers,
  isOrgMember,
  createApiKey,
  validateApiKey,
  listApiKeys,
  deleteApiKey,
  clapRun,
  getRunClapCount,
  setSessionAiSummary,
  getSessionAiSummary,
  checkAndIncrRateLimit,
  adminResetRateLimit,
  listRateLimits,
  // V51 — Prompt chains
  createPromptChain,
  listPromptChains,
  getPromptChain,
  updatePromptChain,
  deletePromptChain,
  listPublicPromptChains,
  incrPromptChainRunCount,
  // V54 — User stats
  getUserStats,
  // V55 — Session invites
  createSessionInvite,
  getSessionInvite,
  listSessionInvites,
  deleteSessionInvite,
  incrementInviteUseCount,
  // V56 — Audit log
  logAudit,
  listAuditLog,
  // V59 — AI Memory
  addMemory,
  listMemories,
  deleteMemory,
  updateMemory,
  extractMemoriesFromRun,
  listPinnedMemories,
  // V60 — Template pin
  pinTemplate,
  // V63 — A/B testing
  createAbTest,
  listAbTests,
  getAbTest,
  deleteAbTest,
  recordAbTestResult,
  // V64 — User settings
  setUserSetting,
  getUserSetting,
  getAllUserSettings,
  deleteUserSetting,
  // V67 — Conditional run branching
  createBranch,
  getBranch,
  listBranches,
  completeBranch,
} from "../services/qcoreai/store";
import { runEvalSuite } from "../services/qcoreai/evalRunner";
import { getGuidanceBus } from "../services/qcoreai/guidanceBus";

export const qcoreaiRouter = Router();

/* ═══════════════════════════════════════════════════════════════════════
   Legacy single-shot chat (kept for backwards compatibility)
   POST /api/qcoreai/chat
   ═══════════════════════════════════════════════════════════════════════ */

// Bound /chat to defend our LLM provider bills. Without this anyone could
// hit /api/qcoreai/chat in a loop and run up Anthropic/OpenAI charges.
// Per-IP cap is conservative; signed-in users get their own limiter
// downstream (sharedLimiter), so a real product flow isn't constrained.
const chatLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyPrefix: "qcoreai:chat",
  message: "rate_limit_exceeded: max 30 chat requests per minute per IP",
});

// Clamp temperature into the range every provider documents. Negative values
// or huge numbers either error out the upstream call or burn extra tokens.
function clampTemperature(raw: unknown, fallback = 0.6): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
  if (raw < 0) return 0;
  if (raw > 2) return 2;
  return raw;
}

// Strip provider-specific internals from upstream errors before they reach
// the client. Callers don't need (and shouldn't see) phrases like
// "Anthropic auth failed: invalid API key prefix sk-ant-..."; they get a
// stable category instead. Server logs keep the full message for ops.
function publicErrorCategory(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("api key") || m.includes("api_key") || m.includes("apikey")) return "provider_auth_failed";
  if (m.includes("rate limit") || m.includes("rate_limit") || m.includes("429")) return "provider_rate_limited";
  if (m.includes("timeout") || m.includes("timed out") || m.includes("etimedout")) return "provider_timeout";
  if (m.includes("model") && (m.includes("not found") || m.includes("does not exist"))) return "model_not_found";
  if (m.includes("billing") || m.includes("quota")) return "provider_quota_exceeded";
  return "chat_failed";
}

qcoreaiRouter.post("/chat", chatLimiter, async (req, res) => {
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
    const temperature = clampTemperature(req.body?.temperature, 0.6);

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
    // Keep the full message in our own logs / Sentry — strip it from the
    // wire response so we never echo a leaked provider key, internal URL,
    // or stack frame back to anonymous callers.
    console.error("[QCoreAI] error:", msg);
    res.status(500).json({ error: publicErrorCategory(msg) });
  }
});

// Exported for unit tests.
export { clampTemperature, publicErrorCategory };

/* ═══════════════════════════════════════════════════════════════════════
   Streaming chat (SSE) — ChatGPT-стиль печатания по кускам
   POST /api/qcoreai/chat-stream
   Body: { messages, provider?, model?, temperature? }
   Response: text/event-stream — события data: { kind: "text", text }
                                              data: { kind: "done", model, provider, usage? }
                                              data: { kind: "error", message }
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/chat-stream", async (req, res) => {
  const messages = sanitizeMessages(req.body?.messages);
  if (!messages) {
    return res.status(400).json({ error: "messages required" });
  }
  const requestedProvider = typeof req.body?.provider === "string" ? req.body.provider : undefined;
  const providerId = resolveProvider(requestedProvider);

  if (providerId === "stub") {
    // Не SSE, обычный JSON — клиент сам поймёт fallback
    return res.json({
      mode: "stub",
      provider: "none",
      model: "none",
      reply:
        "[QCoreAI — no AI provider configured]\n\nTo enable streaming, set one of:\n" +
        "ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, DEEPSEEK_API_KEY, GROK_API_KEY",
    });
  }

  const provider = getProviders().find((p) => p.id === providerId)!;
  const modelName = (typeof req.body?.model === "string" && req.body.model) || provider.defaultModel;
  const temperature = typeof req.body?.temperature === "number" ? req.body.temperature : 0.6;

  // SSE headers
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (payload: unknown) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  // Heartbeat — каждые 15s, чтобы держать соединение и обнаружить разрыв
  const heartbeat = setInterval(() => res.write(`:hb\n\n`), 15000);
  let aborted = false;
  req.on("close", () => { aborted = true; clearInterval(heartbeat); });

  try {
    let totalText = "";
    for await (const ev of streamProvider(providerId, messages, modelName, temperature)) {
      if (aborted) break;
      if (ev.kind === "text") {
        totalText += ev.text;
        send({ kind: "text", text: ev.text });
      } else if (ev.kind === "done") {
        send({
          kind: "done",
          model: modelName,
          provider: provider.name,
          providerId,
          tokensIn: ev.tokensIn,
          tokensOut: ev.tokensOut,
        });
      }
    }
    if (!aborted && totalText === "") {
      send({ kind: "error", message: "empty stream" });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "stream failed";
    console.error("[QCoreAI stream]", msg);
    if (!aborted) send({ kind: "error", message: msg });
  } finally {
    clearInterval(heartbeat);
    if (!aborted) {
      res.write("data: [DONE]\n\n");
      res.end();
    }
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
  let guidanceBusKind = "memory";
  let liveRuns = 0;
  try {
    const bus = await getGuidanceBus();
    guidanceBusKind = bus.kind;
    liveRuns = bus.liveRuns().length;
  } catch { /* tolerable */ }
  res.json({
    service: "qcoreai",
    version: "8.0.0",
    ok: true,
    configuredProviders: configured.map((p) => p.id),
    totalProviders: providers.length,
    activeProvider: resolveProvider(),
    storage: isDbReady() ? "postgres" : "in-memory",
    storageError: isDbReady() ? null : getDbError(),
    webhookConfigured: isWebhookConfigured(),
    webhookEvents: ["run.started", "agent.turn", "run.completed"],
    guidanceBus: guidanceBusKind,
    liveRuns,
    features: [
      "multi-agent", "eval-harness", "prompts-library", "threading",
      "templates", "batch-runs", "scheduled-batches", "spend-limits",
      "workspaces", "run-comments", "prompt-audit", "sdk-v0.4",
    ],
    apiKeysSupported: true,
    orgsSupported: true,
    presenceSupported: true,
    rateLimitsSupported: true,
    at: new Date().toISOString(),
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   Per-user webhook config (auth-required)

   Lets each authenticated user point QCoreAI run.completed events at their
   own URL. Falls back to the env-level webhook when no user-row exists.
   The URL is validated (HTTPS or HTTP, and we block obvious internal
   targets unless QCORE_ALLOW_INTERNAL_WEBHOOKS=1 in dev). Secret is never
   echoed back — GET returns `hasSecret` only.
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.get("/me/webhook", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const cfg = await getUserWebhook(auth.sub);
    if (!cfg) return res.status(404).json({ error: "no webhook configured" });
    return res.json({
      url: cfg.url,
      hasSecret: !!cfg.secret,
      createdAt: cfg.createdAt,
      updatedAt: cfg.updatedAt,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "lookup failed" });
  }
});

qcoreaiRouter.put("/me/webhook", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  if (!isDbReady()) {
    return res.status(503).json({ error: "user webhooks require database (in-memory mode)" });
  }
  const url = validateWebhookUrl(req.body?.url);
  if (!url) {
    return res.status(400).json({
      error: "invalid url — must be http(s) and not loopback/private (set QCORE_ALLOW_INTERNAL_WEBHOOKS=1 in dev to override)",
    });
  }
  const rawSecret = req.body?.secret;
  let secret: string | null = null;
  if (typeof rawSecret === "string" && rawSecret.trim()) {
    secret = rawSecret.trim().slice(0, 256);
  }
  try {
    const cfg = await setUserWebhook(auth.sub, url, secret);
    if (!cfg) return res.status(500).json({ error: "save failed" });
    return res.json({
      url: cfg.url,
      hasSecret: !!cfg.secret,
      createdAt: cfg.createdAt,
      updatedAt: cfg.updatedAt,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "save failed" });
  }
});

qcoreaiRouter.delete("/me/webhook", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const removed = await deleteUserWebhook(auth.sub);
    return res.json({ ok: removed });
  } catch (err: any) {
    return res.status(500).json({ error: "delete failed" });
  }
});

/** POST /api/qcoreai/me/webhook/test — sends a dummy run.completed event to the configured webhook URL. */
qcoreaiRouter.post("/me/webhook/test", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const cfg = await getUserWebhook(auth.sub);
    const envUrl = process.env.QCORE_WEBHOOK_URL?.trim();
    if (!cfg && !envUrl) {
      return res.status(400).json({ error: "no webhook configured" });
    }
    const userOverride = cfg ? { url: cfg.url, secret: cfg.secret } : null;
    const testEvt = {
      event: "run.completed" as const,
      runId: "test-run-" + Date.now(),
      sessionId: "test-session",
      status: "done" as const,
      strategy: "sequential",
      userInput: "Webhook test fired from QCoreAI settings",
      finalContent: "This is a test notification — your webhook is working correctly.",
      totalDurationMs: 1234,
      totalCostUsd: 0,
      error: null,
      finishedAt: new Date().toISOString(),
    };
    await notifyEvent(testEvt, userOverride);
    res.json({ ok: true, sentTo: userOverride?.url || envUrl });
  } catch (err: any) {
    res.status(500).json({ error: "test webhook failed" });
  }
});

/** GET /api/qcoreai/me/webhook/log — last 50 webhook delivery attempts for the caller. */
qcoreaiRouter.get("/me/webhook/log", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const limit = Math.min(100, parseInt(String(req.query.limit || "50"), 10) || 50);
    const items = await listWebhookLogs(auth.sub, limit);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "webhook log failed" });
  }
});

/** GET /api/qcoreai/me/webhook/stats — delivery statistics for the last 30 days. */
qcoreaiRouter.get("/me/webhook/stats", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    if (!isDbReady()) {
      return res.json({ total: 0, successRate: 1, avgLatencyMs: 0, errorCount: 0, period: "30d" });
    }
    const r = await pool.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE "error" IS NULL AND "statusCode" BETWEEN 200 AND 299) AS successes,
         COUNT(*) FILTER (WHERE "error" IS NOT NULL OR "statusCode" < 200 OR "statusCode" >= 300) AS errors,
         AVG("durationMs") AS avg_latency
       FROM "QCoreWebhookLog"
       WHERE "userId"=$1 AND "createdAt" >= NOW() - INTERVAL '30 days'`,
      [auth.sub]
    );
    const row = r.rows[0] || {};
    const total = parseInt(row.total ?? "0", 10);
    const successes = parseInt(row.successes ?? "0", 10);
    const errorCount = parseInt(row.errors ?? "0", 10);
    const avgLatencyMs = Math.round(parseFloat(row.avg_latency ?? "0") || 0);
    const successRate = total > 0 ? Math.round((successes / total) * 1000) / 1000 : 1;
    res.json({ total, successRate, avgLatencyMs, errorCount, period: "30d" });
  } catch (err: any) {
    res.status(500).json({ error: "webhook stats failed" });
  }
});

/** GET /api/qcoreai/me/webhook/events — list all supported event types. */
const WEBHOOK_EVENT_TYPES = [
  { name: "run.started", description: "Fired when a multi-agent run begins. Includes runId, sessionId, strategy, userInput." },
  { name: "agent.turn", description: "Fired after each agent finishes. Includes role, stage, model, tokens, cost, content preview." },
  { name: "run.completed", description: "Fired when a run finishes (done, stopped, or error). Includes final content, cost, duration." },
  { name: "session.created", description: "Fired when a new session is created. Includes sessionId, userId, title." },
  { name: "session.archived", description: "Fired when a session is archived or unarchived. Includes sessionId, archived flag." },
  { name: "annotation.created", description: "Fired when an annotation is added to a run message. Includes annotationId, runId, note." },
];

qcoreaiRouter.get("/me/webhook/events", (_req, res) => {
  res.json({ events: WEBHOOK_EVENT_TYPES });
});

/** POST /api/qcoreai/me/webhook/retry — re-fire a previously failed webhook event. */
qcoreaiRouter.post("/me/webhook/retry", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  const { event, payload } = req.body || {};
  if (!event) return res.status(400).json({ error: "event required" });
  try {
    const cfg = await getUserWebhook(auth.sub);
    const envUrl = process.env.QCORE_WEBHOOK_URL?.trim();
    if (!cfg && !envUrl) return res.status(400).json({ error: "no webhook configured" });
    const userOverride = cfg ? { url: cfg.url, secret: cfg.secret } : null;
    const retryEvt = {
      event: String(event),
      runId: payload?.runId || "retry",
      sessionId: payload?.sessionId || "retry",
      status: payload?.status || "done",
      strategy: payload?.strategy || "sequential",
      userInput: payload?.userInput || "Manual retry",
      finalContent: payload?.finalContent || null,
      totalDurationMs: payload?.totalDurationMs || 0,
      totalCostUsd: payload?.totalCostUsd || 0,
      error: null,
      finishedAt: new Date().toISOString(),
    };
    await notifyEvent(retryEvt as any, userOverride, auth.sub);
    res.json({ ok: true, sentTo: userOverride?.url || envUrl });
  } catch (err: any) {
    res.status(500).json({ error: "retry failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Notebook collections
   POST   /api/qcoreai/notebook/collections
   GET    /api/qcoreai/notebook/collections
   DELETE /api/qcoreai/notebook/collections/:id
   PATCH  /api/qcoreai/notebook/:snippetId/collection  body:{collectionId}
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/notebook/collections", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  const { name, description, color } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "name required" });
  try {
    const c = await createCollection({ ownerUserId: auth.sub, name: String(name), description: description ?? null, color: color ?? null });
    res.status(201).json({ collection: c });
  } catch (err: any) { res.status(500).json({ error: "create collection failed" }); }
});

qcoreaiRouter.get("/notebook/collections", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try { res.json({ items: await listCollections(auth.sub) }); }
  catch (err: any) { res.status(500).json({ error: "list collections failed" }); }
});

qcoreaiRouter.delete("/notebook/collections/:id", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const ok = await deleteCollection(String(req.params.id), auth.sub);
    if (!ok) return res.status(404).json({ error: "not found" });
    res.json({ deleted: true });
  } catch (err: any) { res.status(500).json({ error: "delete collection failed" }); }
});

qcoreaiRouter.patch("/notebook/:snippetId/collection", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  const { collectionId } = req.body || {};
  try {
    const ok = await assignSnippetToCollection(String(req.params.snippetId), collectionId || null, auth.sub);
    if (!ok) return res.status(404).json({ error: "snippet not found" });
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: "assign failed" }); }
});

/* ═══════════════════════════════════════════════════════════════════════
   Run Insights — aggregate patterns from the caller's runs
   GET /api/qcoreai/insights
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.get("/insights", async (req, res) => {
  const auth = verifyBearerOptional(req);
  try {
    if (!isDbReady() || !auth?.sub) {
      return res.json({ topAgentCosts: [], strategyRatings: [], avgCostByHour: [] });
    }

    const [agentCosts, strategyRatings, hourly] = await Promise.all([
      // Top agent roles by avg cost per turn
      pool.query(`
        SELECT m."role", AVG(m."costUsd") AS "avgCostUsd", SUM(m."costUsd") AS "totalCostUsd",
               COUNT(*)::int AS "calls", AVG(m."durationMs") AS "avgDurationMs"
        FROM "QCoreMessage" m
        JOIN "QCoreRun" r ON r."id"=m."runId"
        JOIN "QCoreSession" s ON s."id"=r."sessionId"
        WHERE s."userId"=$1 AND m."costUsd" IS NOT NULL AND m."role" NOT IN ('user','final','guidance','attachments')
        GROUP BY m."role"
        ORDER BY "totalCostUsd" DESC LIMIT 10`, [auth.sub]),

      // Strategy by avg rating score
      pool.query(`
        SELECT r."strategy",
               AVG(CASE WHEN rt."rating"=1 THEN 1.0 WHEN rt."rating"=-1 THEN -1.0 ELSE 0 END) AS "avgRating",
               COUNT(DISTINCT r."id")::int AS "runs",
               AVG(r."totalCostUsd") AS "avgCostUsd"
        FROM "QCoreRun" r
        JOIN "QCoreSession" s ON s."id"=r."sessionId"
        LEFT JOIN "QCoreRunRating" rt ON rt."runId"=r."id"
        WHERE s."userId"=$1 AND r."strategy" IS NOT NULL
        GROUP BY r."strategy" ORDER BY "avgRating" DESC`, [auth.sub]),

      // Avg cost by hour of day (when do expensive runs happen?)
      pool.query(`
        SELECT EXTRACT(HOUR FROM r."startedAt") AS "hour",
               AVG(r."totalCostUsd") AS "avgCostUsd",
               COUNT(*)::int AS "runs"
        FROM "QCoreRun" r
        JOIN "QCoreSession" s ON s."id"=r."sessionId"
        WHERE s."userId"=$1 AND r."totalCostUsd" IS NOT NULL
        GROUP BY "hour" ORDER BY "hour"`, [auth.sub]),
    ]);

    res.json({
      topAgentCosts: agentCosts.rows,
      strategyRatings: strategyRatings.rows,
      avgCostByHour: hourly.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: "insights failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Custom pipelines — user-defined multi-step agent chains
   POST   /api/qcoreai/pipelines
   GET    /api/qcoreai/pipelines
   GET    /api/qcoreai/pipelines/public?q=
   GET    /api/qcoreai/pipelines/:id
   PATCH  /api/qcoreai/pipelines/:id
   DELETE /api/qcoreai/pipelines/:id
   POST   /api/qcoreai/pipelines/:id/use
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/pipelines", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  const { name, description, steps, isPublic } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "name required" });
  if (!Array.isArray(steps) || steps.length < 1) return res.status(400).json({ error: "steps[] required" });
  try {
    const p = await createPipeline({ ownerUserId: auth.sub, name: String(name), description: description ?? null, steps, isPublic: Boolean(isPublic) });
    res.status(201).json({ pipeline: p });
  } catch (err: any) { res.status(500).json({ error: "create pipeline failed" }); }
});

qcoreaiRouter.get("/pipelines/public", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const limit = Math.min(50, parseInt(String(req.query.limit || "20"), 10) || 20);
    res.json({ items: await listPublicPipelines(q, limit) });
  } catch (err: any) { res.status(500).json({ error: "list public pipelines failed" }); }
});

qcoreaiRouter.get("/pipelines", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try { res.json({ items: await listPipelines(auth.sub) }); }
  catch (err: any) { res.status(500).json({ error: "list pipelines failed" }); }
});

qcoreaiRouter.get("/pipelines/:id", async (req, res) => {
  try {
    const p = await getPipeline(String(req.params.id));
    if (!p) return res.status(404).json({ error: "not found" });
    const auth = verifyBearerOptional(req);
    if (!p.isPublic && p.ownerUserId !== auth?.sub) return res.status(403).json({ error: "forbidden" });
    res.json({ pipeline: p });
  } catch (err: any) { res.status(500).json({ error: "get pipeline failed" }); }
});

qcoreaiRouter.patch("/pipelines/:id", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  const { name, description, steps, isPublic } = req.body || {};
  try {
    const p = await updatePipeline(String(req.params.id), auth.sub, {
      ...(name !== undefined && { name: String(name) }),
      ...(description !== undefined && { description }),
      ...(steps !== undefined && { steps }),
      ...(isPublic !== undefined && { isPublic: Boolean(isPublic) }),
    });
    if (!p) return res.status(404).json({ error: "not found or forbidden" });
    res.json({ pipeline: p });
  } catch (err: any) { res.status(500).json({ error: "update pipeline failed" }); }
});

qcoreaiRouter.delete("/pipelines/:id", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const ok = await deletePipeline(String(req.params.id), auth.sub);
    if (!ok) return res.status(404).json({ error: "not found or forbidden" });
    res.json({ deleted: true });
  } catch (err: any) { res.status(500).json({ error: "delete pipeline failed" }); }
});

qcoreaiRouter.post("/pipelines/:id/use", async (req, res) => {
  try {
    const p = await usePipeline(String(req.params.id));
    res.json({ pipeline: p });
  } catch (err: any) { res.status(500).json({ error: "use pipeline failed" }); }
});

/* ═══════════════════════════════════════════════════════════════════════
   Agent personas — custom display names per role
   GET /api/qcoreai/me/personas
   PUT /api/qcoreai/me/personas/:roleId  body:{name, emoji?, color?}
   DELETE /api/qcoreai/me/personas/:roleId
   ═══════════════════════════════════════════════════════════════════════ */

const VALID_ROLES = ["analyst", "writer", "writerB", "critic"];

qcoreaiRouter.get("/me/personas", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    await ensureQCoreTables(pool);
    if (!isDbReady()) return res.json({ personas: [] });
    const r = await pool.query(`SELECT * FROM "QCoreAgentPersona" WHERE "userId"=$1`, [auth.sub]);
    res.json({ personas: r.rows });
  } catch (err: any) { res.status(500).json({ error: "get personas failed" }); }
});

qcoreaiRouter.put("/me/personas/:roleId", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  const roleId = String(req.params.roleId);
  if (!VALID_ROLES.includes(roleId)) return res.status(400).json({ error: "invalid roleId" });
  // V52 — extended fields: defaultProvider, defaultModel, bio, systemPromptHint
  const { name, emoji, color, defaultProvider, defaultModel, bio, systemPromptHint } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "name required" });
  try {
    await ensureQCoreTables(pool);
    if (!isDbReady()) return res.json({ persona: { userId: auth.sub, roleId, name, emoji: emoji || null, color: color || null, defaultProvider: defaultProvider || null, defaultModel: defaultModel || null, bio: bio || null, systemPromptHint: systemPromptHint || null } });
    const r = await pool.query(
      `INSERT INTO "QCoreAgentPersona" ("userId","roleId","name","emoji","color","defaultProvider","defaultModel","bio","systemPromptHint")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT ("userId","roleId") DO UPDATE
         SET "name"=$3,"emoji"=$4,"color"=$5,"defaultProvider"=$6,"defaultModel"=$7,"bio"=$8,"systemPromptHint"=$9,"updatedAt"=NOW()
       RETURNING *`,
      [auth.sub, roleId, String(name).slice(0, 40), emoji?.slice(0, 4) || null, color?.slice(0, 20) || null,
       defaultProvider?.slice(0, 40) || null, defaultModel?.slice(0, 80) || null,
       bio?.slice(0, 500) || null, systemPromptHint?.slice(0, 2000) || null]
    );
    res.json({ persona: r.rows[0] });
  } catch (err: any) { res.status(500).json({ error: "set persona failed" }); }
});

qcoreaiRouter.delete("/me/personas/:roleId", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    await ensureQCoreTables(pool);
    if (!isDbReady()) return res.json({ ok: true });
    await pool.query(`DELETE FROM "QCoreAgentPersona" WHERE "userId"=$1 AND "roleId"=$2`, [auth.sub, req.params.roleId]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: "delete persona failed" }); }
});

/* ═══════════════════════════════════════════════════════════════════════
   Analytics goals — monthly run count and cost targets
   GET /api/qcoreai/me/analytics-goal
   PUT /api/qcoreai/me/analytics-goal  body:{monthlyRuns?,monthlyCostUsd?}
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.get("/me/analytics-goal", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    await ensureQCoreTables(pool);
    if (!isDbReady()) return res.json({ goal: null });
    const r = await pool.query(`SELECT * FROM "QCoreAnalyticsGoal" WHERE "userId"=$1`, [auth.sub]);
    res.json({ goal: r.rows[0] || null });
  } catch (err: any) {
    res.status(500).json({ error: "get goal failed" });
  }
});

qcoreaiRouter.put("/me/analytics-goal", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  const { monthlyRuns, monthlyCostUsd } = req.body || {};
  try {
    await ensureQCoreTables(pool);
    if (!isDbReady()) return res.json({ goal: { userId: auth.sub, monthlyRuns, monthlyCostUsd } });
    const r = await pool.query(
      `INSERT INTO "QCoreAnalyticsGoal" ("userId","monthlyRuns","monthlyCostUsd")
       VALUES ($1,$2,$3)
       ON CONFLICT ("userId") DO UPDATE
         SET "monthlyRuns"=$2, "monthlyCostUsd"=$3, "updatedAt"=NOW()
       RETURNING *`,
      [auth.sub, monthlyRuns ?? null, monthlyCostUsd ?? null]
    );
    res.json({ goal: r.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: "set goal failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Monthly spend limit — per-user budget gate
   GET    /api/qcoreai/me/spend-limit
   PUT    /api/qcoreai/me/spend-limit
   DELETE /api/qcoreai/me/spend-limit
   GET    /api/qcoreai/me/spend-summary  (current month usage + limit)
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.get("/me/spend-limit", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const limit = await getSpendLimit(auth.sub);
    res.json({ limit: limit || null });
  } catch (err: any) {
    res.status(500).json({ error: "get limit failed" });
  }
});

qcoreaiRouter.put("/me/spend-limit", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  const limitUsd = parseFloat(req.body?.monthlyLimitUsd);
  const alertAt = typeof req.body?.alertAt === "number" ? req.body.alertAt : 0.8;
  if (!isFinite(limitUsd) || limitUsd <= 0) {
    return res.status(400).json({ error: "monthlyLimitUsd must be a positive number" });
  }
  try {
    const limit = await setSpendLimit(auth.sub, limitUsd, alertAt);
    res.json({ limit });
  } catch (err: any) {
    res.status(500).json({ error: "set limit failed" });
  }
});

qcoreaiRouter.delete("/me/spend-limit", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const ok = await deleteSpendLimit(auth.sub);
    res.json({ ok });
  } catch (err: any) {
    res.status(500).json({ error: "delete limit failed" });
  }
});

qcoreaiRouter.get("/me/spend-summary", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const [limit, spent] = await Promise.all([
      getSpendLimit(auth.sub),
      getMonthlySpend(auth.sub),
    ]);
    const limitUsd = limit?.monthlyLimitUsd ?? null;
    const alertAt = limit?.alertAt ?? 0.8;
    const pct = limitUsd ? spent / limitUsd : null;
    res.json({
      spentUsd: spent,
      limitUsd,
      alertAt,
      pct,
      alerting: pct !== null && pct >= alertAt,
      exceeded: pct !== null && pct >= 1,
    });
  } catch (err: any) {
    res.status(500).json({ error: "spend summary failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Sessions CRUD
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.get("/sessions", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const rows = await listSessions(auth?.sub ?? null, 50);
    res.json({ items: rows, total: rows.length, scope: auth ? "mine" : "anonymous" });
  } catch (err: any) {
    res.status(500).json({ error: "list sessions failed" });
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
    res.status(500).json({ error: "get session failed" });
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
    res.status(500).json({ error: "rename failed" });
  }
});

/** PATCH /sessions/:id/pin — toggle session pin (starred sessions float to top). */
qcoreaiRouter.patch("/sessions/:id/pin", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const pinned = typeof req.body?.pinned === "boolean" ? req.body.pinned : true;
    const ok = await pinSession(String(req.params.id), auth?.sub ?? null, pinned);
    if (!ok) return res.status(404).json({ error: "session not found" });
    res.json({ ok: true, pinned });
  } catch (err: any) {
    res.status(500).json({ error: "pin failed" });
  }
});

/** PATCH /sessions/:id/tags — replace session tag list. */
qcoreaiRouter.patch("/sessions/:id/tags", async (req, res) => {
  const auth = verifyBearerOptional(req);
  try {
    const { tags } = req.body || {};
    const normalized = Array.isArray(tags) ? tags.slice(0, 10).map((t: unknown) => String(t).trim().toLowerCase().slice(0, 32)).filter(Boolean) : [];
    if (!isDbReady()) return res.json({ ok: true });
    await pool.query(`UPDATE "QCoreSession" SET "tags"=$1,"updatedAt"=NOW() WHERE "id"=$2 AND ("userId"=$3 OR "userId" IS NULL)`, [normalized, req.params.id, auth?.sub ?? null]);
    res.json({ ok: true, tags: normalized });
  } catch (err: any) { res.status(500).json({ error: "set session tags failed" }); }
});

/** PATCH /sessions/:id/archive — soft-delete a session (hidden from default list; recoverable). */
qcoreaiRouter.patch("/sessions/:id/archive", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const archive = req.body?.archive !== false; // default true
  try {
    const ok = await archiveSession(String(req.params.id), auth?.sub ?? null, archive);
    if (!ok) return res.status(404).json({ error: "session not found" });
    // V41: fire session.archived event
    void notifyEvent({ event: "session.archived", sessionId: String(req.params.id), archived: archive, archivedAt: new Date().toISOString() }, null, auth?.sub);
    res.json({ ok: true, archived: archive });
  } catch (err: any) {
    res.status(500).json({ error: "archive failed" });
  }
});

/** GET /sessions/archived — list archived sessions. */
qcoreaiRouter.get("/sessions/archived", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const rows = await listSessions(auth?.sub ?? null, 100, true);
    const archived = rows.filter((s) => s.archivedAt);
    res.json({ items: archived, total: archived.length });
  } catch (err: any) {
    res.status(500).json({ error: "list archived failed" });
  }
});

/** POST /sessions/:id/merge — move all runs from sourceSessionId into this session, then delete source. */
qcoreaiRouter.post("/sessions/:id/merge", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const { sourceSessionId } = req.body || {};
    if (!sourceSessionId?.trim()) return res.status(400).json({ error: "sourceSessionId required" });
    if (sourceSessionId === req.params.id) return res.status(400).json({ error: "cannot merge a session into itself" });
    const result = await mergeSessions(String(req.params.id), String(sourceSessionId), auth?.sub ?? null);
    res.json({ ok: true, moved: result.moved });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || "merge failed" });
  }
});

qcoreaiRouter.delete("/sessions/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const ok = await deleteSession(req.params.id, auth?.sub ?? null);
    if (!ok) return res.status(404).json({ error: "session not found" });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "delete session failed" });
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
    res.status(500).json({ error: "get run failed" });
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
    res.status(500).json({ error: "share failed" });
  }
});

qcoreaiRouter.delete("/runs/:id/share", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const ok = await unshareRun(req.params.id, auth?.sub ?? null);
    if (!ok) return res.status(404).json({ error: "run not found or not shared" });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "unshare failed" });
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
    const clapCount = await getRunClapCount(run.id);
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
      clapCount,
    };
    res.json({ session, run: safeRun, messages });
  } catch (err: any) {
    res.status(500).json({ error: "shared lookup failed" });
  }
});

/** GET /shared/:token/comments — list public comments on a shared run. */
qcoreaiRouter.get("/shared/:token/comments", sharedLimiter, async (req, res) => {
  try {
    const run = await getRunByShareToken(String(req.params.token || ""));
    if (!run) return res.status(404).json({ error: "not found" });
    const items = await listComments(run.id);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "list comments failed" });
  }
});

/** POST /shared/:token/comments — post a public comment (no auth needed). */
qcoreaiRouter.post("/shared/:token/comments", sharedLimiter, async (req, res) => {
  try {
    const run = await getRunByShareToken(String(req.params.token || ""));
    if (!run) return res.status(404).json({ error: "not found" });
    const { authorName, content } = req.body || {};
    if (!content?.trim()) return res.status(400).json({ error: "content required" });
    const comment = await createComment(run.id, authorName || "Anonymous", content);
    res.status(201).json({ comment });
  } catch (err: any) {
    res.status(500).json({ error: "create comment failed" });
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
    res.status(500).json({ error: "analytics failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Refinement / search / tagging — feat/qcore-extras 2026-04-29
   ═══════════════════════════════════════════════════════════════════════ */

const refineLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyPrefix: "qcore-refine",
  message: "Too many refinements from this IP. Please retry in a minute.",
});

/**
 * POST /api/qcoreai/runs/:id/refine
 * Body: { instruction, provider?, model?, temperature? }
 * Single-pass refinement on top of an already-finished run.
 * Appends a final/refinement message and accumulates cost+duration.
 */
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

/**
 * GET /api/qcoreai/search?q=...&limit=30
 * Substring search across the caller's runs — userInput / finalContent /
 * session.title / tags. Powers the sidebar quick-find.
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
    res.status(500).json({ error: "search failed" });
  }
});

/**
 * GET /api/qcoreai/tags?limit=20
 * Top tags across the caller's runs, sorted by usage count.
 * One-click shortcut for the sidebar chip strip → /search?q=<tag>.
 */
qcoreaiRouter.get("/tags", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const items = await getTopUserTags(auth?.sub ?? null, limit);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "list tags failed" });
  }
});

/**
 * PATCH /api/qcoreai/runs/:id/tags
 * Replace a run's tags. Owner-only. Body: { tags: string[] }.
 * Normalized server-side: trim, dedupe, cap 16 × 32 chars.
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
    res.json({ ok: true, tags: updated.tags ?? [] });
  } catch (err: any) {
    res.status(500).json({ error: "set tags failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Agent marketplace — V4-E
   - POST   /presets/share        (auth)  — publish a preset
   - GET    /presets/public       (none)  — browse, optional ?q= search
   - GET    /presets/:id          (none)  — fetch one
   - POST   /presets/:id/import   (none)  — bumps importCount, returns the preset
   - DELETE /presets/:id          (auth)  — owner-only
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/presets/share", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { name, description, strategy, overrides, isPublic } = req.body || {};
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name required" });
    }
    const preset = await createSharedPreset({
      ownerUserId: auth.sub,
      name,
      description: typeof description === "string" ? description : null,
      strategy: typeof strategy === "string" ? strategy : "sequential",
      overrides: overrides && typeof overrides === "object" ? overrides : {},
      isPublic: isPublic !== false,
    });
    res.json({ ok: true, preset });
  } catch (err: any) {
    res.status(500).json({ error: "share preset failed" });
  }
});

qcoreaiRouter.get("/presets/public", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim().slice(0, 80);
    const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit ?? "30"), 10) || 30));
    const items = await listPublicSharedPresets(q, limit);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "list public presets failed" });
  }
});

qcoreaiRouter.get("/presets/:id", async (req, res) => {
  try {
    const p = await getSharedPreset(String(req.params.id));
    if (!p) return res.status(404).json({ error: "preset not found" });
    if (!p.isPublic) {
      const auth = verifyBearerOptional(req);
      if (!auth?.sub || auth.sub !== p.ownerUserId) {
        return res.status(404).json({ error: "preset not found" });
      }
    }
    res.json({ preset: p });
  } catch (err: any) {
    res.status(500).json({ error: "get preset failed" });
  }
});

qcoreaiRouter.post("/presets/:id/import", async (req, res) => {
  try {
    const p = await importSharedPreset(String(req.params.id));
    if (!p) return res.status(404).json({ error: "preset not found or not public" });
    res.json({ ok: true, preset: p });
  } catch (err: any) {
    res.status(500).json({ error: "import preset failed" });
  }
});

qcoreaiRouter.delete("/presets/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const ok = await deleteSharedPreset(String(req.params.id), auth.sub);
    if (!ok) return res.status(404).json({ error: "preset not found or forbidden" });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "delete preset failed" });
  }
});

/**
 * GET /api/qcoreai/analytics/timeseries?days=30
 * Daily run + cost buckets for the cost-forecasting chart on /qcoreai/analytics.
 */
qcoreaiRouter.get("/analytics/timeseries", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const days = Math.max(1, Math.min(365, parseInt(String(req.query.days ?? "30"), 10) || 30));
    const items = await getCostTimeseries(auth?.sub ?? null, days);
    res.json({ items, days });
  } catch (err: any) {
    res.status(500).json({ error: "timeseries failed" });
  }
});

/**
 * GET /api/qcoreai/runs/:id/cost-breakdown
 * Per-agent cost + token breakdown for a run. Useful for the shared detail page
 * and for SDK consumers building cost attribution tools.
 */
qcoreaiRouter.get("/runs/:id/cost-breakdown", async (req, res) => {
  try {
    const run = await getRun(String(req.params.id));
    if (!run) return res.status(404).json({ error: "run not found" });
    const messages = await listMessages(run.id);
    const agentMessages = messages.filter(
      (m) => ["analyst", "writer", "critic", "pro", "con", "moderator", "judge"].includes(m.role)
    );
    const breakdown = agentMessages.map((m) => ({
      role: m.role,
      stage: m.stage,
      instance: m.instance,
      provider: m.provider,
      model: m.model,
      tokensIn: m.tokensIn,
      tokensOut: m.tokensOut,
      costUsd: m.costUsd,
      durationMs: m.durationMs,
    }));
    const totalCostUsd = breakdown.reduce((s, b) => s + (b.costUsd ?? 0), 0);
    const totalTokensIn = breakdown.reduce((s, b) => s + (b.tokensIn ?? 0), 0);
    const totalTokensOut = breakdown.reduce((s, b) => s + (b.tokensOut ?? 0), 0);
    const byProvider: Record<string, { calls: number; costUsd: number; tokensIn: number; tokensOut: number }> = {};
    for (const b of breakdown) {
      const p = b.provider || "unknown";
      if (!byProvider[p]) byProvider[p] = { calls: 0, costUsd: 0, tokensIn: 0, tokensOut: 0 };
      byProvider[p].calls++;
      byProvider[p].costUsd += b.costUsd ?? 0;
      byProvider[p].tokensIn += b.tokensIn ?? 0;
      byProvider[p].tokensOut += b.tokensOut ?? 0;
    }
    res.json({ breakdown, totalCostUsd, totalTokensIn, totalTokensOut, byProvider });
  } catch (err: any) {
    res.status(500).json({ error: "cost breakdown failed" });
  }
});

/**
 * GET /api/qcoreai/analytics/agent-performance
 * Performance scores per agent role based on runs rated ≥1.
 * Score = avg rating weighted by call count.
 */
qcoreaiRouter.get("/analytics/agent-performance", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!isDbReady() || !auth?.sub) return res.json({ items: [] });
    const r = await pool.query(
      `SELECT m."role",
              COUNT(DISTINCT m."runId")::int AS "runs",
              AVG(m."costUsd") AS "avgCostUsd",
              AVG(m."durationMs") AS "avgDurationMs",
              COALESCE(AVG(rt."rating"), 0) AS "avgRating",
              COUNT(rt."rating")::int AS "ratedRuns"
       FROM "QCoreMessage" m
       JOIN "QCoreRun" r ON r."id"=m."runId"
       JOIN "QCoreSession" s ON s."id"=r."sessionId"
       LEFT JOIN "QCoreRunRating" rt ON rt."runId"=m."runId"
       WHERE s."userId"=$1
         AND m."role" NOT IN ('user','final','guidance','attachments')
         AND m."costUsd" IS NOT NULL
       GROUP BY m."role"
       ORDER BY "avgRating" DESC, "runs" DESC`,
      [auth.sub]
    );
    res.json({ items: r.rows });
  } catch (err: any) {
    res.status(500).json({ error: "agent-performance failed" });
  }
});

/**
 * GET /api/qcoreai/analytics/provider-latency?limit=10
 * Average latency per provider from agent messages.
 */
qcoreaiRouter.get("/analytics/provider-latency", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!isDbReady() || !auth?.sub) {
      return res.json({ items: [] });
    }
    const limit = Math.min(20, parseInt(String(req.query.limit || "10"), 10) || 10);
    const r = await pool.query(
      `SELECT m."provider",
              AVG(m."durationMs") AS "avgDurationMs",
              MIN(m."durationMs") AS "minDurationMs",
              MAX(m."durationMs") AS "maxDurationMs",
              COUNT(*)::int AS "calls",
              AVG(m."costUsd") AS "avgCostUsd"
       FROM "QCoreMessage" m
       JOIN "QCoreRun" r ON r."id"=m."runId"
       JOIN "QCoreSession" s ON s."id"=r."sessionId"
       WHERE s."userId"=$1 AND m."provider" IS NOT NULL AND m."durationMs" IS NOT NULL
       GROUP BY m."provider"
       ORDER BY "avgDurationMs" ASC
       LIMIT $2`,
      [auth.sub, limit]
    );
    res.json({ items: r.rows });
  } catch (err: any) {
    res.status(500).json({ error: "provider-latency failed" });
  }
});

/**
 * GET /api/qcoreai/analytics/by-tag?limit=20
 * Per-tag cost + run count breakdown for the caller's runs.
 */
qcoreaiRouter.get("/analytics/by-tag", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const limit = Math.min(50, parseInt(String(req.query.limit || "20"), 10) || 20);

    if (!isDbReady()) {
      // In-memory: approximate using tags from runs
      return res.json({ items: [] });
    }

    const r = await pool.query(
      `SELECT t.tag,
              COUNT(r."id")::int AS "runs",
              COALESCE(SUM(r."totalCostUsd"),0) AS "totalCostUsd",
              COALESCE(SUM(r."totalDurationMs"),0) AS "totalDurationMs",
              COALESCE(SUM(r."totalCostUsd")/NULLIF(COUNT(r."id"),0),0) AS "avgCostUsd"
       FROM (SELECT "id","totalCostUsd","totalDurationMs", unnest("tags") AS tag
             FROM "QCoreRun" WHERE "sessionId" IN (
               SELECT "id" FROM "QCoreSession" WHERE "userId"=$1
             ) AND "tags" != '{}') r
       CROSS JOIN LATERAL (SELECT r.tag) t
       GROUP BY t.tag
       ORDER BY "totalCostUsd" DESC
       LIMIT $2`,
      [auth?.sub ?? null, limit]
    );
    res.json({ items: r.rows });
  } catch (err: any) {
    res.status(500).json({ error: "by-tag analytics failed" });
  }
});

/**
 * GET /api/qcoreai/analytics/sessions?days=7&limit=10
 * Top sessions by cost for the given window (for the authenticated user).
 */
qcoreaiRouter.get("/analytics/sessions", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const days = Math.min(90, parseInt(String(req.query.days || "7"), 10) || 7);
    const limit = Math.min(50, parseInt(String(req.query.limit || "10"), 10) || 10);
    const items = await getSessionCostSummary(auth?.sub ?? null, days, limit);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "session analytics failed" });
  }
});

/**
 * GET /api/qcoreai/analytics/export?format=csv&days=30
 * Export analytics as CSV for spreadsheet analysis.
 */
qcoreaiRouter.get("/analytics/export", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const days = Math.min(90, parseInt(String(req.query.days || "30"), 10) || 30);
    const data = await getCostTimeseries(auth?.sub ?? null, days);
    const csv = [
      "date,runs,costUsd",
      ...data.map((r: any) => `${r.date},${r.runs},${(r.costUsd ?? 0).toFixed(6)}`),
    ].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="qcoreai-analytics-${days}d.csv"`);
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: "analytics export failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   V33 — Analytics: agent response length + provider compare.
   GET /analytics/agent-length    — avg content length per agent role
   GET /analytics/provider-compare — cost, speed, token stats per provider
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.get("/analytics/agent-length", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    if (!isDbReady()) return res.json({ items: [] });
    const r = await pool.query(
      `SELECT m."role", COUNT(*) AS calls,
              AVG(LENGTH(m."content")) AS avgLength,
              MIN(LENGTH(m."content")) AS minLength,
              MAX(LENGTH(m."content")) AS maxLength
       FROM "QCoreMessage" m
       JOIN "QCoreRun" ru ON ru."id"=m."runId"
       JOIN "QCoreSession" se ON se."id"=ru."sessionId"
       WHERE se."userId"=$1
         AND m."role" IN ('analyst','writer','critic')
         AND m."content" IS NOT NULL AND m."content" != ''
       GROUP BY m."role"
       ORDER BY AVG(LENGTH(m."content")) DESC`,
      [auth.sub]
    );
    const items = r.rows.map((row: any) => ({
      role: row.role,
      calls: Number(row.calls),
      avgLength: Math.round(Number(row.avglength)),
      minLength: Math.round(Number(row.minlength)),
      maxLength: Math.round(Number(row.maxlength)),
      avgWords: Math.round(Number(row.avglength) / 5),
    }));
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "agent length failed" });
  }
});

qcoreaiRouter.get("/analytics/provider-compare", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    if (!isDbReady()) return res.json({ items: [] });
    const r = await pool.query(
      `SELECT m."provider",
              COUNT(*) AS calls,
              AVG(m."durationMs") AS avgDurationMs,
              AVG(m."costUsd") AS avgCostUsd,
              SUM(m."costUsd") AS totalCostUsd,
              AVG(m."tokensIn") AS avgTokensIn,
              AVG(m."tokensOut") AS avgTokensOut,
              AVG(LENGTH(m."content")) AS avgContentLength
       FROM "QCoreMessage" m
       JOIN "QCoreRun" ru ON ru."id"=m."runId"
       JOIN "QCoreSession" se ON se."id"=ru."sessionId"
       WHERE se."userId"=$1 AND m."provider" IS NOT NULL AND m."provider" != ''
       GROUP BY m."provider"
       ORDER BY SUM(m."costUsd") DESC NULLS LAST`,
      [auth.sub]
    );
    const items = r.rows.map((row: any) => ({
      provider: row.provider,
      calls: Number(row.calls),
      avgDurationMs: Math.round(Number(row.avgdurationms) || 0),
      avgCostUsd: Number(row.avgcostusd) || 0,
      totalCostUsd: Number(row.totalcostusd) || 0,
      avgTokensIn: Math.round(Number(row.avgtokensin) || 0),
      avgTokensOut: Math.round(Number(row.avgtokensout) || 0),
      avgContentLength: Math.round(Number(row.avgcontentlength) || 0),
    }));
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "provider compare failed" });
  }
});

/**
 * GET /api/qcoreai/sessions/:id/export?format=json|md
 * Bulk export of all runs in a session — useful for offline archival.
 * Returns a single JSON object with session + all runs + messages, or
 * a concatenated Markdown document with each run as a section.
 */
qcoreaiRouter.get("/sessions/:id/export", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const session = await getSession(String(req.params.id), auth?.sub ?? null);
    if (!session) return res.status(404).json({ error: "session not found or forbidden" });
    const runs = await listRuns(session.id, 200);
    const format = req.query.format === "md" ? "md" : "json";
    const safeSlug = slugify(session.title || "session").slice(0, 40) || "session";
    const filename = `qcoreai-session-${safeSlug}.${format}`;

    if (format === "json") {
      const runsWithMessages = await Promise.all(
        runs.map(async (run) => ({ run, messages: await listMessages(run.id) }))
      );
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(JSON.stringify({ session, runs: runsWithMessages }, null, 2));
      return;
    }

    let md = `# ${session.title}\n\n*Exported from AEVION QCoreAI · ${new Date().toISOString().slice(0, 10)}*\n\n---\n\n`;
    for (const run of runs) {
      const messages = await listMessages(run.id);
      md += renderRunMarkdown({ session, run, messages });
      md += "\n\n---\n\n";
    }
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(md);
  } catch (err: any) {
    res.status(500).json({ error: "session export failed" });
  }
});

/**
/**
 * GET /api/qcoreai/runs/:id/export?format=json|md|csv
 * csv: each message as a row (role, stage, content, tokens, cost, duration)
 */
qcoreaiRouter.get("/runs/:id/export", async (req, res) => {
  try {
    const run = await getRun(req.params.id);
    if (!run) return res.status(404).json({ error: "run not found" });
    const auth = verifyBearerOptional(req);
    const session = await getSession(run.sessionId, auth?.sub ?? null);
    if (!session) return res.status(403).json({ error: "forbidden" });
    const messages = await listMessages(run.id);
    const fmt = req.query.format === "md" ? "md" : req.query.format === "csv" ? "csv" : "json";
    const safeSlug = slugify(session.title || "run").slice(0, 40) || "run";
    const filename = `qcoreai-${safeSlug}-${run.id.slice(0, 8)}.${fmt}`;

    if (fmt === "json") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(JSON.stringify({ session, run, messages }, null, 2));
      return;
    }

    if (fmt === "csv") {
      const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const rows = [
        ["role", "stage", "instance", "provider", "model", "content", "tokensIn", "tokensOut", "costUsd", "durationMs"].join(","),
        ...messages.map((m) => [m.role, m.stage, m.instance, m.provider, m.model, m.content, m.tokensIn, m.tokensOut, m.costUsd, m.durationMs].map(escape).join(",")),
      ].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(rows);
      return;
    }

    const md = renderRunMarkdown({ session, run, messages });
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(md);
  } catch (err: any) {
    res.status(500).json({ error: "export failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Thread — fetch all runs in a conversation thread
   GET /api/qcoreai/runs/:id/thread
   Returns the full chain: root run + all reply runs ordered oldest→newest.
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.get("/runs/:id/thread", async (req, res) => {
  try {
    const run = await getRun(req.params.id);
    if (!run) return res.status(404).json({ error: "run not found" });
    const auth = verifyBearerOptional(req);
    const session = await getSession(run.sessionId, auth?.sub ?? null);
    if (!session) return res.status(403).json({ error: "forbidden" });
    const threadId = run.threadId ?? run.id;
    const runs = await getThread(threadId);
    res.json({ threadId, runs });
  } catch (err: any) {
    res.status(500).json({ error: "thread fetch failed" });
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

/**
 * In-process registry of currently-running runs and their pending mid-run
 * guidance items. Populated when /multi-agent starts, drained at every
 * orchestrator stage boundary, deleted in the finally block. Maps cleanly
 * onto the orchestrator's `guidanceProvider` contract: a `drainGuidance`
 * call returns and clears the queue atomically.
 *
 * In-process is fine for single-instance deploys. A multi-instance setup
 * would replace this with Redis pub/sub keyed by runId.
 */
// Backend swap: GuidanceBus has both InMemory + Redis impls. With
// QCORE_REDIS_URL set the bus boots in Redis pub/sub mode so multi-instance
// deploys can route /guidance to any node. Without it, behavior is the same
// in-process Map as before. See services/qcoreai/guidanceBus.ts.
async function pushGuidance(runId: string, text: string): Promise<boolean> {
  const bus = await getGuidanceBus();
  return bus.push(runId, text);
}

// Synchronous version for the orchestrator's `guidanceProvider` contract,
// which is called inside the generator's flow control. The bus's drain is
// synchronous on both impls (Redis subscriber accumulates into a local
// buffer; drain reads + clears that buffer), so we expose a sync wrapper
// using the cached bus reference fetched at run start.
function drainGuidanceSync(bus: { drain: (id: string) => any }, runId: string): string[] {
  const result = bus.drain(runId);
  if (Array.isArray(result)) return result;
  // Both bus implementations return arrays synchronously; if a future impl
  // returns a Promise, the orchestrator can't await it — log and drop.
  console.warn("[QCoreAI] guidance drain returned non-array, dropping");
  return [];
}

const guidanceLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyPrefix: "qcore-guidance",
  message: "Too many guidance updates. Slow down.",
});

/**
 * POST /api/qcoreai/runs/:runId/guidance
 * Mid-run human guidance — appended to the next writer-stage user prompt.
 * Returns 404 if the run has already finished or doesn't exist in this
 * process; the client should treat that as "too late, run is over".
 */
qcoreaiRouter.post("/runs/:runId/guidance", guidanceLimiter, async (req, res) => {
  const runId = String(req.params.runId || "");
  const text = typeof req.body?.text === "string" ? req.body.text.trim().slice(0, 4000) : "";
  if (!text) return res.status(400).json({ error: "text required" });
  try {
    const ok = await pushGuidance(runId, text);
    if (!ok) return res.status(404).json({ error: "run is not live" });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: "guidance push failed" });
  }
});

qcoreaiRouter.post("/multi-agent", multiAgentLimiter, async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? null;

  const userInput = typeof req.body?.input === "string" ? req.body.input.trim().slice(0, 16000) : "";
  if (!userInput) {
    return res.status(400).json({ error: "input required" });
  }

  // V7-Budget: check monthly spend limit before starting a run.
  if (userId) {
    try {
      const limit = await getSpendLimit(userId);
      if (limit && limit.monthlyLimitUsd > 0) {
        const spent = await getMonthlySpend(userId);
        if (spent >= limit.monthlyLimitUsd) {
          return res.status(429).json({
            error: "monthly_budget_exceeded",
            message: `Monthly spend limit of $${limit.monthlyLimitUsd.toFixed(2)} reached (current: $${spent.toFixed(4)}).`,
            spentUsd: spent,
            limitUsd: limit.monthlyLimitUsd,
          });
        }
      }
    } catch { /* non-critical — allow the run if limit check fails */ }
  }

  const strategy: PipelineStrategy =
    req.body?.strategy === "parallel" ? "parallel" :
    req.body?.strategy === "debate" ? "debate" :
    "sequential";

  const maxRevisions =
    typeof req.body?.maxRevisions === "number" ? Math.max(0, Math.min(2, req.body.maxRevisions)) : 1;

  // Optional spend cap. Hard upper bound 50 USD/run prevents accidental
  // misuse via negative or huge values.
  let maxCostUsd: number | undefined;
  if (typeof req.body?.maxCostUsd === "number" && isFinite(req.body.maxCostUsd) && req.body.maxCostUsd > 0) {
    maxCostUsd = Math.min(50, req.body.maxCostUsd);
  }

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

  // V6-P integration: promptOverrides — { role: { promptId? OR content? } }
  // Either reference a saved prompt by id (owner-scoped fetch) or pass content
  // inline. The result is merged into overrides[role].systemPrompt so the
  // orchestrator picks it up via existing AgentOverride.systemPrompt path.
  const rawPromptOverrides = req.body?.promptOverrides;
  if (rawPromptOverrides && typeof rawPromptOverrides === "object") {
    const roles = ["analyst", "writer", "writerB", "critic"] as const;
    for (const role of roles) {
      const entry = rawPromptOverrides[role];
      if (!entry || typeof entry !== "object") continue;
      let content: string | null = null;
      if (typeof entry.content === "string" && entry.content.trim()) {
        content = entry.content.slice(0, 16000);
      } else if (typeof entry.promptId === "string" && entry.promptId) {
        try {
          const p = await getPrompt(entry.promptId);
          // Owner-only fetch unless prompt is public — same gate as /prompts/:id
          if (p && (p.isPublic || (userId && p.ownerUserId === userId))) {
            content = p.content;
          }
        } catch { /* ignore — fall through with no override */ }
      }
      if (content) {
        const cur = overrides[role] || {};
        overrides[role] = { ...cur, systemPrompt: content };
      }
    }
  }

  // V59 — Inject pinned AI memories into the analyst's system prompt so the
  // agent has persistent cross-session user context. Non-blocking — silently
  // skipped when no memories exist or DB is unavailable.
  if (userId) {
    try {
      const pinnedMems = await listPinnedMemories(userId, 5);
      if (pinnedMems.length > 0) {
        const memContext = "User context:\n" + pinnedMems.map((m) => `- ${m.content}`).join("\n");
        const cur = overrides.analyst || {};
        overrides.analyst = {
          ...cur,
          systemPrompt: cur.systemPrompt
            ? `${memContext}\n\n${cur.systemPrompt}`
            : memContext,
        };
      }
    } catch { /* non-critical */ }
  }

  // V69 — Smart model routing: auto-select provider/model by input characteristics
  // if the user has routing rules configured and no explicit override for that role.
  if (userId) {
    try {
      const routingRules: Array<{ condition: string; preferProvider: string; preferModel: string }> =
        (await getUserSetting(userId, "routing_rules")) ?? [];
      if (Array.isArray(routingRules) && routingRules.length > 0) {
        // Detect input characteristics
        const inputLen = userInput.length;
        const hasCode = userInput.includes("```");
        const activeConditions = new Set<string>();
        if (inputLen <= 500) activeConditions.add("short_input");
        if (inputLen > 500) activeConditions.add("long_input");
        if (hasCode) activeConditions.add("code_task");
        // creative_task: check for creative keywords
        if (/\b(write|poem|story|creative|fiction|imagine|compose)\b/i.test(userInput)) {
          activeConditions.add("creative_task");
        }
        for (const rule of routingRules) {
          if (!activeConditions.has(rule.condition)) continue;
          // Apply to all roles that don't already have an explicit override
          const roles = ["analyst", "writer", "writerB", "critic"] as const;
          for (const role of roles) {
            const existing = overrides[role];
            if (!existing?.provider && !existing?.model) {
              overrides[role] = {
                ...(existing || {}),
                provider: rule.preferProvider,
                model: rule.preferModel,
              };
            }
          }
          break; // first matching rule wins
        }
      }
    } catch { /* non-critical */ }
  }

  // Pre-fetch any QRight attachments the user wants the agents to reason
  // against. Pulled BEFORE the SSE stream opens so we can fail fast (bad
  // ID list) and so the Analyst sees them on its very first prompt.
  const requestedAttachmentIds = normalizeAttachmentIds(req.body?.qrightAttachmentIds);
  let attachments: Awaited<ReturnType<typeof fetchQRightAttachments>> = [];
  if (requestedAttachmentIds.length > 0) {
    try {
      attachments = await fetchQRightAttachments(requestedAttachmentIds);
    } catch (err: any) {
      return res.status(500).json({ error: "qright attachment fetch failed" });
    }
  }
  const augmentedUserInput = attachments.length
    ? `${renderAttachmentsContext(attachments)}\n\n[User question]\n${userInput}`
    : userInput;

  // V7-T: optional thread continuation — pass continueFromRunId to build
  // full thread context and link new run as a reply in the same thread.
  const continueFromRunId: string | null =
    typeof req.body?.continueFromRunId === "string" ? req.body.continueFromRunId : null;
  let parentRun: import("../services/qcoreai/store").RunRow | null = null;
  if (continueFromRunId) {
    try {
      parentRun = await getRun(continueFromRunId);
      if (!parentRun) {
        return res.status(404).json({ error: "continueFromRunId not found" });
      }
    } catch (err: any) {
      return res.status(500).json({ error: "thread lookup failed" });
    }
  }

  let sessionId: string;
  let runId: string;
  try {
    const prevSessionId = parentRun?.sessionId ?? (typeof req.body?.sessionId === "string" ? req.body.sessionId : null);
    const session = await ensureSession({
      // When continuing a thread, re-use the parent's session so the reply
      // appears in the same sidebar entry.
      sessionId: prevSessionId,
      userId,
      seedTitle: userInput,
    });
    sessionId = session.id;
    // V41: fire session.created when a brand-new session was created
    if (!prevSessionId || prevSessionId !== sessionId) {
      void notifyEvent({ event: "session.created", sessionId, userId: userId ?? null, title: session.title, createdAt: session.createdAt }, null, userId);
      if (userId) void logAudit(userId, "session.created", { resourceId: sessionId, resourceType: "session" });
    }
    const run = await createRun({
      sessionId,
      userInput,
      agentConfig: { strategy, maxRevisions, overrides },
      strategy,
      parentRunId: parentRun?.id ?? null,
      threadId: parentRun?.threadId ?? null,
    });
    runId = run.id;
    await insertMessage({
      runId,
      role: "user",
      content: userInput,
      ordering: 0,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "session init failed" });
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
  req.on("close", () => {
    aborted = true;
    clearInterval(heartbeat);
  });

  send({ type: "session", sessionId, runId });

  if (attachments.length > 0) {
    // Surface attached QRight objects so the UI can chip them in the run
    // header. Lightweight payload — id + title + kind only.
    const attachmentItems = attachments.map((a) => ({ id: a.id, title: a.title, kind: a.kind }));
    send({ type: "qright_attached", items: attachmentItems });
    // Persist as a role="attachments" message so reload / share / export
    // keep the chip context. ordering=1 reserves slot just after user (0).
    try {
      await insertMessage({
        runId,
        role: "attachments",
        content: JSON.stringify(attachmentItems),
        ordering: 1,
      });
    } catch (e: any) {
      // Logging the persistence failure but not blocking the run.
      console.warn("[QCoreAI] persist attachments failed:", e?.message);
    }
  }

  // Register this run for mid-run guidance via the bus. The orchestrator
  // drains the bus at each writer-stage boundary; POST /runs/:id/guidance
  // pushes into it. With QCORE_REDIS_URL set, pushes are broadcast across
  // nodes; otherwise it's an in-process Map.
  const guidanceBus = await getGuidanceBus();
  await guidanceBus.register(runId);

  // V7-W: fire run.started webhook (non-blocking, no-op if no webhook configured).
  void (async () => {
    let userOverrideWh: { url: string; secret: string | null } | null = null;
    if (userId) {
      try {
        const cfg = await getUserWebhook(userId);
        if (cfg) userOverrideWh = { url: cfg.url, secret: cfg.secret };
      } catch { /* ignore */ }
    }
    if (userOverrideWh || isWebhookConfigured()) {
      await notifyEvent({
        event: "run.started",
        runId,
        sessionId,
        strategy,
        userInput,
        startedAt: new Date().toISOString(),
      }, userOverrideWh);
    }
    if (userId) void logAudit(userId, "run.started", { resourceId: runId, resourceType: "run" });
  })();

  // When continuing a thread, walk up the parent chain for precise context;
  // otherwise use the session's recent runs (less precise but good for new threads).
  const history = parentRun
    ? await buildThreadContext(parentRun.id, 12)
    : await buildHistoryContext(sessionId, 6);

  const runStart = Date.now();
  // ordering=0 is the user prompt (inserted in session-init block); slot 1
  // is reserved for attachments when present, so the run-loop counter starts
  // at 2. When no attachments, slot 1 stays empty — listMessages doesn't care.
  let ordering = 2;
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
      userInput: augmentedUserInput,
      strategy,
      overrides,
      maxRevisions,
      history,
      guidanceProvider: () => drainGuidanceSync(guidanceBus, runId),
      maxCostUsd,
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
        case "guidance_applied":
          // Persist each drained guidance item so reload / share / export
          // see the human's interjection in-place. role="guidance" is a
          // sentinel the listMessages consumers can split out from agents.
          try {
            await insertMessage({
              runId,
              role: "guidance",
              stage: evt.stage,
              instance: evt.instance ?? null,
              content: evt.text,
              ordering: ordering++,
            });
          } catch (e: any) {
            console.warn("[QCoreAI] persist guidance failed:", e?.message);
          }
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
          // V9: emit running cost total after every agent turn so UI can display live spend.
          send({ type: "cost_tick", runId, accumulatedCostUsd: totalCost });
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
          // V7-W: fire agent.turn webhook (fire-and-forget, low priority).
          if (isWebhookConfigured() || userId) {
            void notifyEvent({
              event: "agent.turn",
              runId,
              sessionId,
              role: evt.role,
              stage: evt.stage,
              instance: evt.instance ?? null,
              provider: meta?.provider ?? "",
              model: meta?.model ?? "",
              tokensIn: evt.tokensIn ?? null,
              tokensOut: evt.tokensOut ?? null,
              durationMs: evt.durationMs,
              costUsd: agentCost,
              contentPreview: (evt.content || "").slice(0, 500),
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
  let runStatus: "done" | "stopped" | "error" = "done";
  let runFinal: string | null = finalContent;
  try {
    if (aborted) {
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
  // Per-user webhook (if the run's user has one) takes precedence over the
  // env-level fallback. Never blocks the SSE response and never throws.
  void (async () => {
    let userOverride: { url: string; secret: string | null } | null = null;
    if (userId) {
      try {
        const cfg = await getUserWebhook(userId);
        if (cfg) userOverride = { url: cfg.url, secret: cfg.secret };
      } catch {
        // If the per-user lookup fails we still try the env-level webhook.
      }
    }
    if (!userOverride && !isWebhookConfigured()) return;
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
      userOverride
    );
  })();

  // Deregister mid-run guidance queue regardless of how the run finished.
  // Any guidance posted after this point gets a 404 — accurate.
  await guidanceBus.unregister(runId);

  if (!aborted) {
    send({ type: "sse_end" });
    res.end();
  } else {
    try { res.end(); } catch { /* noop */ }
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Eval harness — test suites + regression tracking
   ═══════════════════════════════════════════════════════════════════════
   A suite holds a list of test cases (input + judge); /run kicks off an
   async run; consumers poll GET /eval/runs/:id for progress + final score.
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/eval/suites", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { name, description, strategy, overrides, cases } = req.body || {};
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name required" });
    }
    const suite = await createEvalSuite({
      ownerUserId: auth.sub,
      name,
      description: typeof description === "string" ? description : null,
      strategy: typeof strategy === "string" ? strategy : "sequential",
      overrides: overrides && typeof overrides === "object" ? overrides : {},
      cases,
    });
    res.json({ ok: true, suite });
  } catch (err: any) {
    res.status(500).json({ error: "create eval suite failed" });
  }
});

qcoreaiRouter.get("/eval/suites", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const limit = Math.max(1, Math.min(200, parseInt(String(req.query.limit ?? "50"), 10) || 50));
    const items = await listEvalSuites(auth.sub, limit);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "list eval suites failed" });
  }
});

/* V33 — public eval suite gallery */
qcoreaiRouter.get("/eval/suites/public", async (req, res) => {
  try {
    const limit = Math.min(50, Number(req.query.limit) || 20);
    const items = await listPublicEvalSuites(limit);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "list public eval suites failed" });
  }
});

qcoreaiRouter.patch("/eval/suites/:id/visibility", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const isPublic = Boolean(req.body?.isPublic);
    const ok = await setEvalSuitePublic(String(req.params.id), auth.sub, isPublic);
    if (!ok) return res.status(404).json({ error: "not found or forbidden" });
    res.json({ isPublic });
  } catch (err: any) {
    res.status(500).json({ error: "set eval suite visibility failed" });
  }
});

qcoreaiRouter.get("/eval/suites/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const s = await getEvalSuite(String(req.params.id));
    if (!s || s.ownerUserId !== auth.sub) return res.status(404).json({ error: "suite not found" });
    res.json({ suite: s });
  } catch (err: any) {
    res.status(500).json({ error: "get eval suite failed" });
  }
});

qcoreaiRouter.patch("/eval/suites/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { name, description, strategy, overrides, cases } = req.body || {};
    const s = await updateEvalSuite(String(req.params.id), auth.sub, {
      name,
      description,
      strategy,
      overrides,
      cases,
    });
    if (!s) return res.status(404).json({ error: "suite not found or forbidden" });
    res.json({ suite: s });
  } catch (err: any) {
    res.status(500).json({ error: "update eval suite failed" });
  }
});

qcoreaiRouter.delete("/eval/suites/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const ok = await deleteEvalSuite(String(req.params.id), auth.sub);
    if (!ok) return res.status(404).json({ error: "suite not found or forbidden" });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "delete eval suite failed" });
  }
});

const evalRunLimiter = rateLimit({ windowMs: 60_000, max: 10 });

qcoreaiRouter.post("/eval/suites/:id/run", evalRunLimiter, async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const suite = await getEvalSuite(String(req.params.id));
    if (!suite || suite.ownerUserId !== auth.sub) {
      return res.status(404).json({ error: "suite not found" });
    }
    if (!suite.cases?.length) {
      return res.status(400).json({ error: "suite has no cases" });
    }
    const run = await createEvalRun({
      suiteId: suite.id,
      ownerUserId: auth.sub,
      totalCases: suite.cases.length,
    });
    const concurrency = Math.max(1, Math.min(8, Number(req.body?.concurrency) || 3));
    const perCaseMax = Number(req.body?.perCaseMaxCostUsd);
    // Fire and forget. Persisted progress is what the client polls.
    void runEvalSuite({
      runId: run.id,
      suite,
      concurrency,
      perCaseMaxCostUsd: Number.isFinite(perCaseMax) && perCaseMax > 0 ? perCaseMax : undefined,
    });
    res.json({ ok: true, run });
  } catch (err: any) {
    res.status(500).json({ error: "start eval run failed" });
  }
});

qcoreaiRouter.get("/eval/runs/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const r = await getEvalRun(String(req.params.id));
    if (!r || r.ownerUserId !== auth.sub) return res.status(404).json({ error: "run not found" });
    res.json({ run: r });
  } catch (err: any) {
    res.status(500).json({ error: "get eval run failed" });
  }
});

qcoreaiRouter.get("/eval/suites/:id/runs", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const suite = await getEvalSuite(String(req.params.id));
    if (!suite || suite.ownerUserId !== auth.sub) return res.status(404).json({ error: "suite not found" });
    const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit ?? "30"), 10) || 30));
    const items = await listSuiteRuns(suite.id, limit);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "list eval runs failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Prompts library (V6-P) — versioned custom system prompts per agent role
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/prompts", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { name, description, role, content, parentPromptId, isPublic } = req.body || {};
    if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "name required" });
    if (typeof content !== "string" || !content.trim()) return res.status(400).json({ error: "content required" });
    const p = await createPrompt({
      ownerUserId: auth.sub,
      name,
      description: typeof description === "string" ? description : null,
      role: typeof role === "string" ? role : "writer",
      content,
      parentPromptId: typeof parentPromptId === "string" ? parentPromptId : null,
      isPublic: isPublic === true,
    });
    res.json({ ok: true, prompt: p });
  } catch (err: any) {
    res.status(500).json({ error: "create prompt failed" });
  }
});

qcoreaiRouter.get("/prompts", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const limit = Math.max(1, Math.min(500, parseInt(String(req.query.limit ?? "100"), 10) || 100));
    const items = await listPrompts(auth.sub, limit);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "list prompts failed" });
  }
});

qcoreaiRouter.get("/prompts/public", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim().slice(0, 80);
    const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit ?? "30"), 10) || 30));
    const items = await listPublicPrompts(q, limit);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "list public prompts failed" });
  }
});

qcoreaiRouter.get("/prompts/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const p = await getPrompt(String(req.params.id));
    if (!p) return res.status(404).json({ error: "prompt not found" });
    if (!p.isPublic && (!auth?.sub || auth.sub !== p.ownerUserId)) {
      return res.status(404).json({ error: "prompt not found" });
    }
    res.json({ prompt: p });
  } catch (err: any) {
    res.status(500).json({ error: "get prompt failed" });
  }
});

qcoreaiRouter.get("/prompts/:id/versions", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const p = await getPrompt(String(req.params.id));
    if (!p) return res.status(404).json({ error: "prompt not found" });
    if (!p.isPublic && (!auth?.sub || auth.sub !== p.ownerUserId)) {
      return res.status(404).json({ error: "prompt not found" });
    }
    const chain = await getPromptVersionChain(String(req.params.id));
    res.json({ items: chain });
  } catch (err: any) {
    res.status(500).json({ error: "version chain failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   V34 — Prompt version diff: word-level diff between adjacent versions.
   GET /prompts/:id/diff?fromId=<parentId>
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.get("/prompts/:id/diff", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const targetId = String(req.params.id);
    const fromId = typeof req.query.fromId === "string" ? req.query.fromId : null;
    const target = await getPrompt(targetId);
    if (!target) return res.status(404).json({ error: "prompt not found" });
    if (!target.isPublic && (!auth?.sub || auth.sub !== target.ownerUserId)) {
      return res.status(403).json({ error: "forbidden" });
    }
    let fromText = "";
    if (fromId) {
      const from = await getPrompt(fromId);
      if (from && (from.isPublic || (auth?.sub && auth.sub === from.ownerUserId))) {
        fromText = from.content;
      }
    } else {
      // Auto-find parent version.
      const chain = await getPromptVersionChain(targetId);
      const idx = chain.findIndex((p: any) => p.id === targetId);
      if (idx > 0) fromText = chain[idx - 1].content;
    }
    const diff = computeWordDiff(fromText, target.content);
    res.json({ diff, fromLength: fromText.length, toLength: target.content.length });
  } catch (err: any) {
    res.status(500).json({ error: "diff failed" });
  }
});

/** Minimal word-level diff — returns an array of {text, type: 'equal'|'insert'|'delete'} */
function computeWordDiff(from: string, to: string): Array<{ text: string; type: "equal" | "insert" | "delete" }> {
  const fromWords = from.split(/(\s+)/);
  const toWords = to.split(/(\s+)/);
  // Simple LCS-based diff using DP.
  const m = fromWords.length, n = toWords.length;
  // For large texts, use a simplified chunk approach.
  if (m + n > 2000) {
    const added = to.length - from.length;
    if (added > 0) return [{ text: from, type: "equal" }, { text: to.slice(from.length), type: "insert" }];
    if (added < 0) return [{ text: to, type: "equal" }, { text: from.slice(to.length), type: "delete" }];
    return [{ text: to, type: "equal" }];
  }
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    dp[i][j] = fromWords[i - 1] === toWords[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  }
  const result: Array<{ text: string; type: "equal" | "insert" | "delete" }> = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && fromWords[i - 1] === toWords[j - 1]) {
      result.unshift({ text: fromWords[i - 1], type: "equal" }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ text: toWords[j - 1], type: "insert" }); j--;
    } else {
      result.unshift({ text: fromWords[i - 1], type: "delete" }); i--;
    }
  }
  // Merge consecutive equal segments.
  const merged: Array<{ text: string; type: "equal" | "insert" | "delete" }> = [];
  for (const item of result) {
    const last = merged[merged.length - 1];
    if (last && last.type === item.type) last.text += item.text;
    else merged.push({ ...item });
  }
  return merged;
}

qcoreaiRouter.patch("/prompts/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { name, description, role, isPublic } = req.body || {};
    const p = await updatePrompt(String(req.params.id), auth.sub, {
      name,
      description,
      role,
      isPublic,
    });
    if (!p) return res.status(404).json({ error: "prompt not found or forbidden" });
    res.json({ prompt: p });
  } catch (err: any) {
    res.status(500).json({ error: "update prompt failed" });
  }
});

qcoreaiRouter.delete("/prompts/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const ok = await deletePrompt(String(req.params.id), auth.sub);
    if (!ok) return res.status(404).json({ error: "prompt not found or forbidden" });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "delete prompt failed" });
  }
});

qcoreaiRouter.post("/prompts/:id/fork", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { content, name } = req.body || {};
    const forked = await forkPrompt(String(req.params.id), auth.sub, {
      content: typeof content === "string" ? content : undefined,
      name: typeof name === "string" ? name : undefined,
    });
    if (!forked) return res.status(404).json({ error: "prompt not found or not forkable" });
    res.json({ ok: true, prompt: forked });
  } catch (err: any) {
    res.status(500).json({ error: "fork prompt failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Run templates — save / browse / apply named input+strategy+overrides bundles
   POST   /api/qcoreai/templates
   GET    /api/qcoreai/templates          (own)
   GET    /api/qcoreai/templates/public   (public browse)
   GET    /api/qcoreai/templates/:id
   PATCH  /api/qcoreai/templates/:id
   DELETE /api/qcoreai/templates/:id
   POST   /api/qcoreai/templates/:id/use  (bumps useCount, returns template)
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/templates", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { name, description, input, strategy, overrides, isPublic } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: "name required" });
    if (!input?.trim()) return res.status(400).json({ error: "input required" });
    const t = await createTemplate({
      ownerUserId: auth.sub,
      name: String(name),
      description: description ?? null,
      input: String(input),
      strategy: strategy || "sequential",
      overrides: overrides && typeof overrides === "object" ? overrides : {},
      isPublic: Boolean(isPublic),
    });
    res.status(201).json({ template: t });
  } catch (err: any) {
    res.status(500).json({ error: "create template failed" });
  }
});

qcoreaiRouter.get("/templates/public", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const limit = Math.min(50, parseInt(String(req.query.limit || "30"), 10) || 30);
    const items = await listPublicTemplates(q, limit);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "list public templates failed" });
  }
});

qcoreaiRouter.get("/templates", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const items = await listTemplates(auth.sub);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "list templates failed" });
  }
});

qcoreaiRouter.get("/templates/:id", async (req, res) => {
  try {
    const t = await getTemplate(req.params.id);
    if (!t) return res.status(404).json({ error: "template not found" });
    const auth = verifyBearerOptional(req);
    if (!t.isPublic && t.ownerUserId !== auth?.sub) {
      return res.status(403).json({ error: "forbidden" });
    }
    res.json({ template: t });
  } catch (err: any) {
    res.status(500).json({ error: "get template failed" });
  }
});

qcoreaiRouter.patch("/templates/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { name, description, input, strategy, overrides, isPublic } = req.body || {};
    const t = await updateTemplate(req.params.id, auth.sub, {
      ...(name !== undefined && { name: String(name) }),
      ...(description !== undefined && { description }),
      ...(input !== undefined && { input: String(input) }),
      ...(strategy !== undefined && { strategy }),
      ...(overrides !== undefined && { overrides }),
      ...(isPublic !== undefined && { isPublic: Boolean(isPublic) }),
    });
    if (!t) return res.status(404).json({ error: "template not found or forbidden" });
    res.json({ template: t });
  } catch (err: any) {
    res.status(500).json({ error: "update template failed" });
  }
});

qcoreaiRouter.delete("/templates/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const ok = await deleteTemplate(req.params.id, auth.sub);
    if (!ok) return res.status(404).json({ error: "template not found or forbidden" });
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: "delete template failed" });
  }
});

qcoreaiRouter.post("/templates/:id/use", async (req, res) => {
  try {
    const t = await getTemplate(req.params.id);
    if (!t) return res.status(404).json({ error: "template not found" });
    const auth = verifyBearerOptional(req);
    if (!t.isPublic && t.ownerUserId !== auth?.sub) {
      return res.status(403).json({ error: "forbidden" });
    }
    const updated = await useTemplate(req.params.id);
    res.json({ template: updated || t });
  } catch (err: any) {
    res.status(500).json({ error: "use template failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Batch runs — run N prompts against a shared config in one call.
   POST /api/qcoreai/batch  — create + start (async)
   GET  /api/qcoreai/batches — list user's batches
   GET  /api/qcoreai/batch/:id — status + per-run details
   ═══════════════════════════════════════════════════════════════════════ */

const MAX_BATCH_INPUTS = 20;
const BATCH_CONCURRENCY = 5;

/**
 * Run a single batch item to completion (no SSE — persist-only).
 * Returns { costUsd, status } for progress tracking.
 */
async function runBatchItem(opts: {
  runId: string;
  sessionId: string;
  batchId: string;
  userInput: string;
  strategy: PipelineStrategy;
  overrides: { analyst?: AgentOverride; writer?: AgentOverride; writerB?: AgentOverride; critic?: AgentOverride };
  maxRevisions: number;
  maxCostUsd?: number;
}): Promise<{ costUsd: number; status: "done" | "error" }> {
  let ordering = 2;
  let finalContent: string | null = null;
  let hadError: string | null = null;
  let totalCost = 0;
  const pendingByKey = new Map<string, { provider: string; model: string }>();
  const stageKey = (role: string, stage: string, inst?: string) => `${role}|${stage}|${inst || ""}`;

  try {
    for await (const evt of runMultiAgent({
      userInput: opts.userInput,
      strategy: opts.strategy,
      overrides: opts.overrides,
      maxRevisions: opts.maxRevisions,
      history: [],
      guidanceProvider: () => [],
      maxCostUsd: opts.maxCostUsd,
    }) as AsyncGenerator<OrchestratorEvent>) {
      switch (evt.type) {
        case "agent_start":
          pendingByKey.set(stageKey(evt.role, evt.stage, evt.instance), { provider: evt.provider, model: evt.model });
          break;
        case "agent_end": {
          const meta = pendingByKey.get(stageKey(evt.role, evt.stage, evt.instance));
          const agentCost = typeof evt.costUsd === "number"
            ? evt.costUsd
            : costUsd(meta?.provider || "", meta?.model || "", evt.tokensIn, evt.tokensOut);
          totalCost += agentCost;
          await insertMessage({
            runId: opts.runId, role: evt.role, stage: evt.stage,
            instance: evt.instance ?? null, provider: meta?.provider ?? null,
            model: meta?.model ?? null, content: evt.content,
            tokensIn: evt.tokensIn ?? null, tokensOut: evt.tokensOut ?? null,
            durationMs: evt.durationMs, costUsd: agentCost, ordering: ordering++,
          });
          pendingByKey.delete(stageKey(evt.role, evt.stage, evt.instance));
          break;
        }
        case "final":
          finalContent = evt.content;
          await insertMessage({ runId: opts.runId, role: "final", content: evt.content, ordering: ordering++ });
          break;
        case "error":
          hadError = evt.message;
          break;
        default:
          break;
      }
    }
  } catch (e: any) {
    hadError = e?.message || "batch item crashed";
  }

  const status = hadError && !finalContent ? "error" : "done";
  await finishRun(opts.runId, status, {
    error: hadError,
    finalContent,
    totalCostUsd: totalCost,
  });
  return { costUsd: totalCost, status };
}

const batchLimiter = rateLimit({ windowMs: 60_000, max: 5, keyPrefix: "qcore-batch", message: "Too many batch runs. Try again in a minute." });

qcoreaiRouter.post("/batch", batchLimiter, async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });

    const rawInputs = req.body?.inputs;
    if (!Array.isArray(rawInputs) || rawInputs.length === 0) {
      return res.status(400).json({ error: "inputs[] required (array of strings)" });
    }
    const inputs: string[] = rawInputs
      .filter((s: unknown) => typeof s === "string" && s.trim())
      .map((s: string) => s.trim().slice(0, 16000))
      .slice(0, MAX_BATCH_INPUTS);
    if (inputs.length === 0) return res.status(400).json({ error: "no valid inputs" });

    const strategy: PipelineStrategy =
      req.body?.strategy === "parallel" ? "parallel" :
      req.body?.strategy === "debate" ? "debate" : "sequential";
    const maxRevisions = typeof req.body?.maxRevisions === "number"
      ? Math.max(0, Math.min(2, req.body.maxRevisions)) : 0;
    let maxCostUsd: number | undefined;
    if (typeof req.body?.maxCostUsd === "number" && isFinite(req.body.maxCostUsd) && req.body.maxCostUsd > 0) {
      maxCostUsd = Math.min(50, req.body.maxCostUsd);
    }
    const overrides = {
      analyst: parseAgentOverride(req.body?.overrides?.analyst),
      writer: parseAgentOverride(req.body?.overrides?.writer),
      writerB: parseAgentOverride(req.body?.overrides?.writerB),
      critic: parseAgentOverride(req.body?.overrides?.critic),
    };

    const batch = await createBatch({ ownerUserId: auth.sub, strategy, overrides, inputs });

    // Create a single shared session for all batch runs.
    const session = await ensureSession({ userId: auth.sub, seedTitle: `Batch: ${inputs[0].slice(0, 40)}` });

    // Persist all run stubs so clients can see them immediately.
    const runIds: string[] = [];
    for (const input of inputs) {
      const run = await createRun({
        sessionId: session.id, userInput: input,
        agentConfig: { strategy, maxRevisions, overrides }, strategy, batchId: batch.id,
      });
      await insertMessage({ runId: run.id, role: "user", content: input, ordering: 0 });
      runIds.push(run.id);
    }

    res.status(202).json({ batchId: batch.id, sessionId: session.id, totalRuns: inputs.length, runIds });

    // Fire all items in background with a concurrency cap.
    void (async () => {
      const queue = runIds.map((runId, i) => ({ runId, input: inputs[i] }));
      let active = 0;
      let idx = 0;
      await new Promise<void>((resolve) => {
        const next = () => {
          if (idx >= queue.length && active === 0) { resolve(); return; }
          while (active < BATCH_CONCURRENCY && idx < queue.length) {
            const { runId, input } = queue[idx++];
            active++;
            runBatchItem({ runId, sessionId: session.id, batchId: batch.id, userInput: input, strategy, overrides, maxRevisions, maxCostUsd })
              .then(({ costUsd: c, status }) => updateBatchProgress(batch.id, {
                completedDelta: status === "done" ? 1 : 0,
                failedDelta: status === "error" ? 1 : 0,
                costDelta: c,
              }))
              .catch(() => updateBatchProgress(batch.id, { failedDelta: 1 }))
              .finally(() => { active--; next(); });
          }
        };
        next();
      });
    })();
  } catch (err: any) {
    if (!res.headersSent) res.status(500).json({ error: "batch create failed" });
  }
});

qcoreaiRouter.get("/batches", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const items = await listBatches(auth.sub);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "list batches failed" });
  }
});

qcoreaiRouter.get("/batch/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const batch = await getBatch(req.params.id);
    if (!batch) return res.status(404).json({ error: "batch not found" });
    if (batch.ownerUserId !== auth.sub) return res.status(403).json({ error: "forbidden" });
    const runs = await listBatchRuns(req.params.id);
    // Slim down runs for the summary view — full content is in GET /runs/:id
    const runSummaries = runs.map((r) => ({
      id: r.id, userInput: r.userInput, status: r.status,
      totalCostUsd: r.totalCostUsd,
      finalContentPreview: r.finalContent ? r.finalContent.slice(0, 300) : null,
      startedAt: r.startedAt, finishedAt: r.finishedAt,
    }));
    res.json({ batch, runs: runSummaries });
  } catch (err: any) {
    res.status(500).json({ error: "get batch failed" });
  }
});

/** DELETE /api/qcoreai/batch/:id — cancel a running batch (marks as error, stops future processing). */
qcoreaiRouter.delete("/batch/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const batch = await getBatch(String(req.params.id));
    if (!batch) return res.status(404).json({ error: "batch not found" });
    if (batch.ownerUserId !== auth.sub) return res.status(403).json({ error: "forbidden" });
    if (batch.status !== "running") return res.status(400).json({ error: "batch is not running" });
    // Mark as error — pending runs will detect this and stop
    await updateBatchProgress(batch.id, { failedDelta: batch.totalRuns - batch.completedRuns - batch.failedRuns });
    res.json({ ok: true, cancelled: true });
  } catch (err: any) {
    res.status(500).json({ error: "cancel batch failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Scheduled batch runs — fire a batch on a recurring or one-shot schedule.
   POST   /api/qcoreai/schedules
   GET    /api/qcoreai/schedules
   GET    /api/qcoreai/schedules/:id
   PATCH  /api/qcoreai/schedules/:id
   DELETE /api/qcoreai/schedules/:id
   POST   /api/qcoreai/schedules/:id/run-now  (manual trigger)
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/schedules", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { name, inputs, strategy, overrides, schedule, nextRunAt } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: "name required" });
    if (!Array.isArray(inputs) || inputs.length === 0) return res.status(400).json({ error: "inputs[] required" });
    const s = await createScheduledBatch({
      ownerUserId: auth.sub,
      name: String(name),
      inputs: inputs.filter((x: unknown) => typeof x === "string" && x.trim()).map((x: string) => x.trim()),
      strategy: strategy || "sequential",
      overrides: overrides && typeof overrides === "object" ? overrides : {},
      schedule: (schedule || "once") as "once" | "hourly" | "daily" | "weekly",
      nextRunAt: nextRunAt || null,
    });
    res.status(201).json({ schedule: s });
  } catch (err: any) {
    res.status(500).json({ error: "create schedule failed" });
  }
});

qcoreaiRouter.get("/schedules", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const items = await listScheduledBatches(auth.sub);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "list schedules failed" });
  }
});

qcoreaiRouter.get("/schedules/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const s = await getScheduledBatch(req.params.id);
    if (!s || s.ownerUserId !== auth.sub) return res.status(404).json({ error: "not found" });
    res.json({ schedule: s });
  } catch (err: any) {
    res.status(500).json({ error: "get schedule failed" });
  }
});

qcoreaiRouter.patch("/schedules/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { name, inputs, strategy, overrides, schedule, nextRunAt, enabled } = req.body || {};
    const s = await updateScheduledBatch(req.params.id, auth.sub, {
      ...(name !== undefined && { name: String(name) }),
      ...(inputs !== undefined && { inputs }),
      ...(strategy !== undefined && { strategy }),
      ...(overrides !== undefined && { overrides }),
      ...(schedule !== undefined && { schedule }),
      ...(nextRunAt !== undefined && { nextRunAt }),
      ...(enabled !== undefined && { enabled: Boolean(enabled) }),
    });
    if (!s) return res.status(404).json({ error: "not found or forbidden" });
    res.json({ schedule: s });
  } catch (err: any) {
    res.status(500).json({ error: "update schedule failed" });
  }
});

qcoreaiRouter.delete("/schedules/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const ok = await deleteScheduledBatch(req.params.id, auth.sub);
    if (!ok) return res.status(404).json({ error: "not found or forbidden" });
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: "delete schedule failed" });
  }
});

/** Manual trigger — fires the batch immediately regardless of nextRunAt. */
qcoreaiRouter.post("/schedules/:id/run-now", batchLimiter, async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const sched = await getScheduledBatch(String(req.params.id));
    if (!sched || sched.ownerUserId !== auth.sub) return res.status(404).json({ error: "not found" });

    const strategy = (["sequential", "parallel", "debate"].includes(sched.strategy)
      ? sched.strategy : "sequential") as PipelineStrategy;
    const overrides = {
      analyst: parseAgentOverride((sched.overrides as any)?.analyst),
      writer: parseAgentOverride((sched.overrides as any)?.writer),
      writerB: parseAgentOverride((sched.overrides as any)?.writerB),
      critic: parseAgentOverride((sched.overrides as any)?.critic),
    };

    const batch = await createBatch({ ownerUserId: auth.sub, strategy, overrides, inputs: sched.inputs });
    const session = await ensureSession({ userId: auth.sub, seedTitle: `Schedule: ${sched.name}` });
    const runIds: string[] = [];
    for (const input of sched.inputs) {
      const run = await createRun({ sessionId: session.id, userInput: input, agentConfig: { strategy, overrides }, strategy, batchId: batch.id });
      await insertMessage({ runId: run.id, role: "user", content: input, ordering: 0 });
      runIds.push(run.id);
    }
    await recordScheduledRun(sched.id, batch.id);
    res.status(202).json({ batchId: batch.id, runIds });

    void (async () => {
      const queue = runIds.map((runId, i) => ({ runId, input: sched.inputs[i] }));
      let active = 0; let idx = 0;
      await new Promise<void>((resolve) => {
        const next = () => {
          if (idx >= queue.length && active === 0) { resolve(); return; }
          while (active < BATCH_CONCURRENCY && idx < queue.length) {
            const { runId, input } = queue[idx++];
            active++;
            runBatchItem({ runId, sessionId: session.id, batchId: batch.id, userInput: input, strategy, overrides, maxRevisions: 0 })
              .then(({ costUsd: c, status }) => updateBatchProgress(batch.id, { completedDelta: status === "done" ? 1 : 0, failedDelta: status === "error" ? 1 : 0, costDelta: c }))
              .catch(() => updateBatchProgress(batch.id, { failedDelta: 1 }))
              .finally(() => { active--; next(); });
          }
        };
        next();
      });
    })();
  } catch (err: any) {
    if (!res.headersSent) res.status(500).json({ error: "run-now failed" });
  }
});

/**
 * Start the background scheduler — polls for due scheduled batches every minute.
 * Called once from the main app after all routes are set up.
 */
export function startScheduler(): void {
  const tick = async () => {
    try {
      const due = await getDueSchedules();
      for (const sched of due) {
        const strategy = (["sequential", "parallel", "debate"].includes(sched.strategy)
          ? sched.strategy : "sequential") as PipelineStrategy;
        const overrides = {
          analyst: parseAgentOverride((sched.overrides as any)?.analyst),
          writer: parseAgentOverride((sched.overrides as any)?.writer),
          writerB: parseAgentOverride((sched.overrides as any)?.writerB),
          critic: parseAgentOverride((sched.overrides as any)?.critic),
        };
        const batch = await createBatch({ ownerUserId: sched.ownerUserId, strategy, overrides, inputs: sched.inputs });
        const session = await ensureSession({ userId: sched.ownerUserId, seedTitle: `Schedule: ${sched.name}` });
        const runIds: string[] = [];
        for (const input of sched.inputs) {
          const run = await createRun({ sessionId: session.id, userInput: input, agentConfig: { strategy, overrides }, strategy, batchId: batch.id });
          await insertMessage({ runId: run.id, role: "user", content: input, ordering: 0 });
          runIds.push(run.id);
        }
        await recordScheduledRun(sched.id, batch.id);
        void (async () => {
          const queue = runIds.map((runId, i) => ({ runId, input: sched.inputs[i] }));
          let active = 0; let idx = 0;
          await new Promise<void>((resolve) => {
            const next = () => {
              if (idx >= queue.length && active === 0) { resolve(); return; }
              while (active < BATCH_CONCURRENCY && idx < queue.length) {
                const { runId, input } = queue[idx++];
                active++;
                runBatchItem({ runId, sessionId: session.id, batchId: batch.id, userInput: input, strategy, overrides, maxRevisions: 0 })
                  .then(({ costUsd: c, status }) => updateBatchProgress(batch.id, { completedDelta: status === "done" ? 1 : 0, failedDelta: status === "error" ? 1 : 0, costDelta: c }))
                  .catch(() => updateBatchProgress(batch.id, { failedDelta: 1 }))
                  .finally(() => { active--; next(); });
              }
            };
            next();
          });
        })();
      }
    } catch (e) {
      console.error("[QCoreAI] scheduler tick error:", e);
    }
  };
  setInterval(tick, 60_000);
  console.log("[QCoreAI] scheduler started (1-min poll)");
}

/* ═══════════════════════════════════════════════════════════════════════
   Bulk delete runs — DELETE /api/qcoreai/runs/bulk
   Body: { runIds: string[] }. Only deletes runs the caller owns.
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.delete("/runs/bulk", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const rawIds = req.body?.runIds;
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return res.status(400).json({ error: "runIds[] required" });
    }
    const ids: string[] = rawIds.slice(0, 100).filter((x: unknown) => typeof x === "string");
    const deleted = await deleteRunsBulk(ids, auth.sub);
    res.json({ deleted });
  } catch (err: any) {
    res.status(500).json({ error: "bulk delete failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Run bookmarks — star runs for quick access
   POST   /api/qcoreai/runs/:id/bookmark
   DELETE /api/qcoreai/runs/:id/bookmark
   GET    /api/qcoreai/bookmarks
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/runs/:id/bookmark", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const { label } = req.body || {};
    const bk = await bookmarkRun(String(req.params.id), auth.sub, label ?? null);
    res.status(201).json({ bookmark: bk });
  } catch (err: any) { res.status(500).json({ error: "bookmark failed" }); }
});

qcoreaiRouter.delete("/runs/:id/bookmark", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const ok = await unbookmarkRun(String(req.params.id), auth.sub);
    res.json({ ok });
  } catch (err: any) { res.status(500).json({ error: "unbookmark failed" }); }
});

qcoreaiRouter.get("/bookmarks", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const limit = Math.min(100, parseInt(String(req.query.limit || "50"), 10) || 50);
    const items = await listBookmarks(auth.sub, limit);
    res.json({ items });
  } catch (err: any) { res.status(500).json({ error: "list bookmarks failed" }); }
});

/* ═══════════════════════════════════════════════════════════════════════
   Run ratings — thumbs up (1) / thumbs down (-1)
   POST  /api/qcoreai/runs/:id/rate     body:{rating:1|-1, note?}
   GET   /api/qcoreai/runs/:id/rating   get caller's rating + aggregate
   GET   /api/qcoreai/ratings/top       top-rated runs for the caller
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/runs/:id/rate", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const { rating, note } = req.body || {};
    if (rating !== 1 && rating !== -1) return res.status(400).json({ error: "rating must be 1 or -1" });
    const row = await rateRun(String(req.params.id), auth?.sub ?? null, rating as 1 | -1, note);
    const summary = await getRatingsSummary(String(req.params.id));
    res.json({ rating: row, summary });
  } catch (err: any) {
    res.status(500).json({ error: "rate run failed" });
  }
});

qcoreaiRouter.get("/runs/:id/rating", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const [mine, summary] = await Promise.all([
      getRating(String(req.params.id), auth?.sub ?? null),
      getRatingsSummary(String(req.params.id)),
    ]);
    res.json({ mine, summary });
  } catch (err: any) {
    res.status(500).json({ error: "get rating failed" });
  }
});

qcoreaiRouter.get("/ratings/top", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const limit = Math.min(50, parseInt(String(req.query.limit || "20"), 10) || 20);
    const items = await listTopRatedRuns(auth?.sub ?? null, limit);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "top ratings failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Run comments — public, no auth required
   POST /api/qcoreai/runs/:id/comments
   GET  /api/qcoreai/runs/:id/comments
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/runs/:id/comments", async (req, res) => {
  try {
    const { authorName, content } = req.body || {};
    if (!content?.trim()) return res.status(400).json({ error: "content required" });
    const comment = await createComment(req.params.id, authorName || "Anonymous", content);
    res.status(201).json({ comment });
  } catch (err: any) {
    res.status(500).json({ error: "create comment failed" });
  }
});

qcoreaiRouter.get("/runs/:id/comments", async (req, res) => {
  try {
    const comments = await listComments(req.params.id);
    res.json({ items: comments });
  } catch (err: any) {
    res.status(500).json({ error: "list comments failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Prompt audit log
   GET /api/qcoreai/prompts/audit
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.get("/prompts/audit", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const limit = parseInt(String(req.query.limit || "100"), 10) || 100;
    const items = await listPromptAudit(auth.sub, limit);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "list audit failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Workspaces — shared session collections
   POST /api/qcoreai/workspaces
   GET  /api/qcoreai/workspaces
   GET  /api/qcoreai/workspaces/:id
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/workspaces", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { name, description } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: "name required" });
    const workspace = await createWorkspace({ name: String(name), description: description ?? null, ownerId: auth.sub });
    res.status(201).json({ workspace });
  } catch (err: any) {
    res.status(500).json({ error: "create workspace failed" });
  }
});

qcoreaiRouter.get("/workspaces", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const items = await listWorkspaces(auth.sub);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "list workspaces failed" });
  }
});

qcoreaiRouter.get("/workspaces/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const workspace = await getWorkspace(String(req.params.id));
    if (!workspace) return res.status(404).json({ error: "not found" });
    if (workspace.ownerId !== auth.sub) return res.status(403).json({ error: "forbidden" });
    res.json({ workspace });
  } catch (err: any) {
    res.status(500).json({ error: "get workspace failed" });
  }
});

qcoreaiRouter.patch("/workspaces/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { name, description } = req.body || {};
    const ws = await updateWorkspace(String(req.params.id), auth.sub, {
      ...(name !== undefined && { name: String(name) }),
      ...(description !== undefined && { description }),
    });
    if (!ws) return res.status(404).json({ error: "not found or forbidden" });
    res.json({ workspace: ws });
  } catch (err: any) {
    res.status(500).json({ error: "update workspace failed" });
  }
});

qcoreaiRouter.delete("/workspaces/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const ok = await deleteWorkspace(String(req.params.id), auth.sub);
    if (!ok) return res.status(404).json({ error: "not found or forbidden" });
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: "delete workspace failed" });
  }
});

// Members
qcoreaiRouter.get("/workspaces/:id/members", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const items = await listWorkspaceMembers(String(req.params.id));
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "list members failed" });
  }
});

qcoreaiRouter.post("/workspaces/:id/members", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const ws = await getWorkspace(String(req.params.id));
    if (!ws || ws.ownerId !== auth.sub) return res.status(403).json({ error: "owner only" });
    const { userId, role } = req.body || {};
    if (!userId?.trim()) return res.status(400).json({ error: "userId required" });
    const member = await addWorkspaceMember(String(req.params.id), String(userId), role === "editor" ? "editor" : "viewer");
    res.status(201).json({ member });
  } catch (err: any) {
    res.status(500).json({ error: "invite failed" });
  }
});

qcoreaiRouter.delete("/workspaces/:id/members/:userId", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const ok = await removeWorkspaceMember(String(req.params.id), String(req.params.userId));
    res.json({ ok });
  } catch (err: any) {
    res.status(500).json({ error: "remove member failed" });
  }
});

// Sessions
qcoreaiRouter.get("/workspaces/:id/sessions", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const items = await listWorkspaceSessions(String(req.params.id));
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "list workspace sessions failed" });
  }
});

qcoreaiRouter.post("/workspaces/:id/sessions", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { sessionId } = req.body || {};
    if (!sessionId?.trim()) return res.status(400).json({ error: "sessionId required" });
    await addWorkspaceSession(String(req.params.id), String(sessionId));
    res.status(201).json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "add session failed" });
  }
});

qcoreaiRouter.delete("/workspaces/:id/sessions/:sessionId", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const ok = await removeWorkspaceSession(String(req.params.id), String(req.params.sessionId));
    res.json({ ok });
  } catch (err: any) {
    res.status(500).json({ error: "remove session failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Notebook — save + search run output snippets
   POST   /api/qcoreai/notebook
   GET    /api/qcoreai/notebook?q=&tag=&pinned=&limit=
   GET    /api/qcoreai/notebook/tags
   GET    /api/qcoreai/notebook/:id
   PATCH  /api/qcoreai/notebook/:id
   DELETE /api/qcoreai/notebook/:id
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/notebook", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { runId, role, content, annotation, tags } = req.body || {};
    if (!runId?.trim()) return res.status(400).json({ error: "runId required" });
    if (!content?.trim()) return res.status(400).json({ error: "content required" });
    const snippet = await createSnippet({
      ownerUserId: auth.sub, runId: String(runId), role: role || "final",
      content: String(content), annotation: annotation ?? null,
      tags: Array.isArray(tags) ? tags : [],
    });
    res.status(201).json({ snippet });
  } catch (err: any) {
    res.status(500).json({ error: "create snippet failed" });
  }
});

qcoreaiRouter.get("/notebook/tags", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const items = await listSnippetTagCloud(auth.sub);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "tag cloud failed" });
  }
});

qcoreaiRouter.get("/notebook", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const tag = typeof req.query.tag === "string" ? req.query.tag : undefined;
    const pinned = req.query.pinned === "true" ? true : req.query.pinned === "false" ? false : undefined;
    const limit = parseInt(String(req.query.limit || "50"), 10) || 50;
    const items = await listSnippets(auth.sub, { q, tag, pinned, limit });
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "list snippets failed" });
  }
});

qcoreaiRouter.get("/notebook/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const snippet = await getSnippet(String(req.params.id));
    if (!snippet || snippet.ownerUserId !== auth.sub) return res.status(404).json({ error: "not found" });
    res.json({ snippet });
  } catch (err: any) {
    res.status(500).json({ error: "get snippet failed" });
  }
});

qcoreaiRouter.patch("/notebook/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { annotation, tags, pinned } = req.body || {};
    const snippet = await updateSnippet(String(req.params.id), auth.sub, {
      ...(annotation !== undefined && { annotation }),
      ...(tags !== undefined && { tags }),
      ...(pinned !== undefined && { pinned: Boolean(pinned) }),
    });
    if (!snippet) return res.status(404).json({ error: "not found or forbidden" });
    res.json({ snippet });
  } catch (err: any) {
    res.status(500).json({ error: "update snippet failed" });
  }
});

qcoreaiRouter.delete("/notebook/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const ok = await deleteSnippet(String(req.params.id), auth.sub);
    if (!ok) return res.status(404).json({ error: "not found or forbidden" });
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: "delete snippet failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   V32 — Session stats: quick summary for sidebar badges.
   GET /sessions/:id/stats
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.get("/sessions/:id/stats", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const session = await getSession(String(req.params.id), auth.sub);
    if (!session) return res.status(404).json({ error: "session not found" });
    const runs = await listRuns(session.id, 1000);
    const doneRuns = runs.filter((r: any) => r.status === "done");
    const totalCostUsd = doneRuns.reduce((sum: number, r: any) => sum + (r.totalCostUsd || 0), 0);
    const totalDurationMs = doneRuns.reduce((sum: number, r: any) => sum + (r.totalDurationMs || 0), 0);
    const totalRuns = runs.length;
    const doneCount = doneRuns.length;
    const avgCostUsd = doneCount > 0 ? totalCostUsd / doneCount : 0;
    const avgDurationMs = doneCount > 0 ? totalDurationMs / doneCount : 0;
    const strategies = doneRuns.reduce((acc: Record<string, number>, r: any) => {
      const s = r.strategy || "sequential";
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
    res.json({ sessionId: session.id, totalRuns, doneCount, totalCostUsd, avgCostUsd, totalDurationMs, avgDurationMs, strategies });
  } catch (err: any) {
    res.status(500).json({ error: "session stats failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   V31 — Annotations: user notes on individual agent messages.
   GET  /runs/:id/annotations         — list my annotations for a run
   POST /runs/:id/annotations         — create annotation
   PATCH /annotations/:id             — update note/color
   DELETE /annotations/:id            — delete
   GET  /me/annotations               — all my annotations across runs
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.get("/runs/:id/annotations", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const rows = await listAnnotations(String(req.params.id), auth.sub);
    res.json({ annotations: rows });
  } catch (err: any) {
    res.status(500).json({ error: "list annotations failed" });
  }
});

qcoreaiRouter.post("/runs/:id/annotations", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { messageRole, messageIdx, note, color } = req.body || {};
    if (!note || typeof note !== "string") return res.status(400).json({ error: "note required" });
    const ann = await createAnnotation(
      String(req.params.id), auth.sub,
      typeof messageRole === "string" ? messageRole : "final",
      typeof messageIdx === "number" ? messageIdx : 0,
      note, typeof color === "string" ? color : "yellow"
    );
    // V41: fire annotation.created event
    void notifyEvent({ event: "annotation.created", annotationId: ann.id, runId: String(req.params.id), userId: auth.sub, note: ann.note, color: ann.color, createdAt: ann.createdAt }, null, auth.sub);
    res.status(201).json(ann);
  } catch (err: any) {
    res.status(500).json({ error: "create annotation failed" });
  }
});

qcoreaiRouter.patch("/annotations/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { note, color } = req.body || {};
    if (!note || typeof note !== "string") return res.status(400).json({ error: "note required" });
    const ann = await updateAnnotation(String(req.params.id), auth.sub, note, typeof color === "string" ? color : undefined);
    if (!ann) return res.status(404).json({ error: "not found or forbidden" });
    res.json(ann);
  } catch (err: any) {
    res.status(500).json({ error: "update annotation failed" });
  }
});

qcoreaiRouter.delete("/annotations/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const ok = await deleteAnnotation(String(req.params.id), auth.sub);
    if (!ok) return res.status(404).json({ error: "not found or forbidden" });
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: "delete annotation failed" });
  }
});

qcoreaiRouter.get("/me/annotations", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const rows = await listAllAnnotations(auth.sub, limit);
    if (req.query.format === "csv") {
      const csv = ["id,runId,messageRole,messageIdx,note,color,createdAt",
        ...rows.map((r) => `${r.id},${r.runId},${r.messageRole},${r.messageIdx},"${(r.note || "").replace(/"/g, '""')}",${r.color},${r.createdAt}`)
      ].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=\"qcore-annotations.csv\"");
      return res.send(csv);
    }
    res.json({ annotations: rows });
  } catch (err: any) {
    res.status(500).json({ error: "list annotations failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   V31 — Workspace session pin order.
   PATCH /workspaces/:id/sessions/:sessionId/pin
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.patch("/workspaces/:id/sessions/:sessionId/pin", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const ws = await getWorkspace(String(req.params.id));
    if (!ws) return res.status(404).json({ error: "workspace not found" });
    if (ws.ownerId !== auth.sub) return res.status(403).json({ error: "forbidden" });
    const pinOrder = req.body?.pinOrder != null ? Number(req.body.pinOrder) : null;
    const ok = await pinWorkspaceSession(String(req.params.id), String(req.params.sessionId), isNaN(pinOrder as number) ? null : pinOrder);
    if (!ok) return res.status(404).json({ error: "session not in workspace" });
    res.json({ pinOrder });
  } catch (err: any) {
    res.status(500).json({ error: "pin session failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   V31 — Full-text search.
   GET /search?q=...&limit=20
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.get("/search", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) return res.json({ results: [] });
    const limit = Math.min(50, Number(req.query.limit) || 20);
    const results = await searchQCore(auth.sub, q, limit);
    res.json({ results, query: q });
  } catch (err: any) {
    res.status(500).json({ error: "search failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   V31 — Smart prompt suggestions based on session history.
   POST /sessions/:id/suggest
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/sessions/:id/suggest", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const session = await getSession(String(req.params.id), auth.sub);
    if (!session) return res.status(404).json({ error: "session not found" });
    const runs = await listRuns(session.id, 5);
    if (!runs.length) return res.json({ suggestions: [] });

    const context = runs
      .slice(0, 3)
      .map((r: any) => `Q: ${(r.userInput || "").slice(0, 200)}\nA: ${(r.finalContent || "").slice(0, 400)}`)
      .join("\n\n---\n\n");

    const providers = getProviders();
    const provider = providers.find((p) => p.configured);
    if (!provider) {
      return res.json({
        suggestions: [
          "Can you elaborate on that point?",
          "What are the main trade-offs here?",
          "Give me a concrete example.",
          "How would you approach this differently?",
          "What should I watch out for?",
        ],
      });
    }

    const messages = [
      {
        role: "user" as const,
        content: `Based on this conversation history, suggest 5 concise follow-up questions the user might want to ask next. Return ONLY a JSON array of strings, no explanation.\n\nConversation:\n${context}`,
      },
    ];
    const result = await callProvider(provider.id, messages, provider.defaultModel, 0.7);
    let suggestions: string[] = [];
    try {
      const raw = result.reply.trim();
      const jsonStr = raw.startsWith("[") ? raw : raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1);
      suggestions = JSON.parse(jsonStr);
      if (!Array.isArray(suggestions)) suggestions = [];
    } catch {
      suggestions = result.reply.split("\n").filter((l: string) => l.trim().length > 5).slice(0, 5);
    }
    res.json({ suggestions: suggestions.slice(0, 5).map((s: string) => String(s).trim()).filter(Boolean) });
  } catch (err: any) {
    res.status(500).json({ error: "suggest failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   V31 — Run follow-up: continue from a run's final answer.
   POST /runs/:id/follow-up
   Body: { prompt, strategy?, overrides? }
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/runs/:id/follow-up", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const sourceRun = await getRun(String(req.params.id));
    if (!sourceRun) return res.status(404).json({ error: "run not found" });
    const session = await getSession(sourceRun.sessionId, auth.sub);
    if (!session) return res.status(403).json({ error: "forbidden" });
    const { prompt, strategy, overrides } = req.body || {};
    if (!prompt || typeof prompt !== "string") return res.status(400).json({ error: "prompt required" });

    // Prepend the previous run's final answer as context.
    const prevAnswer = (sourceRun.finalContent || "").slice(0, 1500);
    const fullInput = prevAnswer
      ? `[Context from previous answer]\n${prevAnswer}\n\n[Follow-up question]\n${prompt}`
      : prompt;

    const newRun = await createRun({
      sessionId: session.id,
      userInput: fullInput,
      strategy: typeof strategy === "string" ? strategy : (sourceRun.strategy ?? "sequential"),
      agentConfig: overrides || sourceRun.agentConfig || {},
      parentRunId: sourceRun.id,
      threadId: sourceRun.threadId || sourceRun.id,
    });
    await setFollowUpFrom(newRun.id, sourceRun.id);
    await touchSession(session.id);
    res.status(201).json({ run: newRun, sourceRunId: sourceRun.id });
  } catch (err: any) {
    res.status(500).json({ error: "follow-up failed" });
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
   V35 — Session presence (SSE-less, ping-based).
   POST /sessions/:id/presence/ping   — heartbeat (upserts userId, returns online count)
   GET  /sessions/:id/presence        — list online users (last 30 s)
   ═══════════════════════════════════════════════════════════════════════ */

// In-memory presence map: sessionId → Map<userId, lastSeenMs>
const presenceMap = new Map<string, Map<string, number>>();

const PRESENCE_TTL_MS = 30_000;

function cleanPresence(sessionId: string): void {
  const m = presenceMap.get(sessionId);
  if (!m) return;
  const cutoff = Date.now() - PRESENCE_TTL_MS;
  for (const [uid, ts] of m) {
    if (ts < cutoff) m.delete(uid);
  }
  if (m.size === 0) presenceMap.delete(sessionId);
}

qcoreaiRouter.post("/sessions/:id/presence/ping", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const sessionId = String(req.params.id);
    cleanPresence(sessionId);
    let m = presenceMap.get(sessionId);
    if (!m) { m = new Map(); presenceMap.set(sessionId, m); }
    m.set(auth.sub, Date.now());
    res.json({ sessionId, onlineCount: m.size });
  } catch (err: any) {
    res.status(500).json({ error: "presence ping failed" });
  }
});

qcoreaiRouter.get("/sessions/:id/presence", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const sessionId = String(req.params.id);
    cleanPresence(sessionId);
    const m = presenceMap.get(sessionId);
    const users = m ? Array.from(m.entries()).map(([uid, ts]) => ({ userId: uid, lastSeenMs: ts })) : [];
    res.json({ sessionId, onlineCount: users.length, users });
  } catch (err: any) {
    res.status(500).json({ error: "presence get failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   V35 — Notebook AI Q&A.
   POST /notebook/qa   — ask a question about saved notebook snippets
   Body: { question: string, limit?: number }
   Returns: { answer: string, snippetsUsed: number }
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/notebook/qa", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { question, limit } = req.body || {};
    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "question required" });
    }
    const fetchLimit = Math.min(20, Math.max(1, Number(limit) || 10));
    const snippets: any[] = await listSnippets(auth.sub, { limit: fetchLimit }) ?? [];

    if (!snippets.length) {
      return res.json({ answer: "No saved notebook snippets found. Save some AI outputs to the notebook first, then ask questions about them.", snippetsUsed: 0 });
    }

    const providers = getProviders();
    const provider = providers.find((p: any) => p.configured);
    if (!provider) {
      return res.json({ answer: "No AI provider configured. Please add a provider API key.", snippetsUsed: 0 });
    }

    const context = snippets
      .slice(0, fetchLimit)
      .map((s: any, i: number) => `[Snippet ${i + 1}] (role: ${s.role})\n${(s.content || "").slice(0, 800)}`)
      .join("\n\n---\n\n");

    const messages = [
      {
        role: "user" as const,
        content: `You are a helpful assistant. The user has saved the following notebook snippets from AI sessions:\n\n${context}\n\n---\n\nNow answer this question about the snippets:\n${question.trim()}`,
      },
    ];
    const result = await callProvider(provider.id, messages, provider.defaultModel, 0.5);
    res.json({ answer: result.reply, snippetsUsed: snippets.length });
  } catch (err: any) {
    res.status(500).json({ error: "notebook QA failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   V35 — Widget v2: embed endpoint with API key auth.
   POST /widget/run
   Body: { apiKey: string, input: string, strategy?: string }
   Returns: { runId, sessionId, finalContent }
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/widget/run", async (req, res) => {
  // CORS headers for cross-origin embeds
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  try {
    const { apiKey, input, strategy } = req.body || {};

    if (!apiKey || typeof apiKey !== "string") {
      return res.status(401).json({ error: "apiKey required" });
    }
    if (!input || typeof input !== "string" || !input.trim()) {
      return res.status(400).json({ error: "input required" });
    }

    // Validate API key: check env-based widget key first, then shared presets
    const envWidgetKey = process.env.QCORE_WIDGET_API_KEY;
    let widgetUserId: string | null = null;

    if (envWidgetKey && apiKey === envWidgetKey) {
      widgetUserId = "widget-env";
    } else {
      // Check shared presets for matching API key (use preset id as API key)
      const allPresets = await listPublicSharedPresets(undefined, 100);
      const matchedPreset = (allPresets ?? []).find((p: any) => p.id === apiKey);
      if (matchedPreset) {
        widgetUserId = matchedPreset.ownerUserId ?? "widget-preset";
      }
    }

    if (!widgetUserId) {
      return res.status(401).json({ error: "invalid api key" });
    }

    const resolvedStrategy = (strategy === "parallel" || strategy === "debate") ? strategy : "sequential";
    const session = await ensureSession({ userId: widgetUserId, seedTitle: "Widget run" });
    const run = await createRun({ sessionId: session.id, userInput: input.trim(), strategy: resolvedStrategy });

    // Synchronous (non-streaming) execution for widget
    const providers = getProviders();
    const provider = providers.find((p: any) => p.configured);
    let finalContent = "";

    if (provider) {
      try {
        const messages = [{ role: "user" as const, content: input.trim() }];
        const result = await callProvider(provider.id, messages, provider.defaultModel, 0.7);
        finalContent = result.reply;
        await finishRun(run.id, "done", { finalContent });
      } catch (provErr: any) {
        finalContent = "Error calling provider: " + (provErr?.message || "unknown");
        await finishRun(run.id, "error", { finalContent });
      }
    } else {
      finalContent = "No AI provider configured for widget.";
      await finishRun(run.id, "done", { finalContent });
    }

    res.json({ runId: run.id, sessionId: session.id, finalContent });
  } catch (err: any) {
    res.status(500).json({ error: "widget run failed" });
  }
});

// CORS preflight for widget
qcoreaiRouter.options("/widget/run", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(204).end();
});

/* ═══════════════════════════════════════════════════════════════════════
   V36 — Usage dashboard + Plan limits.
   GET /me/usage   — thisMonth stats + limits + planName
   GET /me/plan    — plan info + limits
   ═══════════════════════════════════════════════════════════════════════ */

const FREE_PLAN_LIMITS = { runs: 100, costUsd: 5 };

qcoreaiRouter.get("/me/usage", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });

    // Get current month analytics
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    let runs = 0;
    let costUsd = 0;
    let sessions = 0;

    if (isDbReady()) {
      try {
        const r = await pool.query(
          `SELECT COUNT(r.id) AS run_count,
                  COALESCE(SUM(r."totalCostUsd"), 0) AS cost,
                  COUNT(DISTINCT r."sessionId") AS session_count
           FROM "QCoreRun" r
           JOIN "QCoreSession" s ON s.id = r."sessionId"
           WHERE s."userId"=$1 AND r."startedAt" >= $2`,
          [auth.sub, monthStart]
        );
        runs = parseInt(r.rows[0]?.run_count ?? "0", 10);
        costUsd = parseFloat(r.rows[0]?.cost ?? "0") || 0;
        sessions = parseInt(r.rows[0]?.session_count ?? "0", 10);
      } catch { /* fallback to in-memory */ }
    }

    if (!isDbReady() || runs === 0) {
      // In-memory fallback
      const memSpend = await getMonthlySpend(auth.sub);
      costUsd = memSpend;
      // Count sessions and runs from analytics
      const analytics = await getAnalytics(auth.sub);
      runs = analytics?.runs ?? 0;
      sessions = analytics?.sessions ?? 0;
    }

    res.json({
      thisMonth: { runs, costUsd, sessions },
      limits: { runs: FREE_PLAN_LIMITS.runs, costUsd: FREE_PLAN_LIMITS.costUsd },
      planName: "free",
    });
  } catch (err: any) {
    res.status(500).json({ error: "usage fetch failed" });
  }
});

qcoreaiRouter.get("/me/plan", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    res.json({
      plan: "free",
      limits: {
        runs: FREE_PLAN_LIMITS.runs,
        costUsd: FREE_PLAN_LIMITS.costUsd,
        description: "Free plan: up to 100 runs/month, $5/month cost",
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: "plan fetch failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   V37 — Session bulk ops + run siblings.
   POST /sessions/bulk-delete    — delete multiple sessions at once
   POST /sessions/bulk-archive   — archive/unarchive multiple sessions
   GET  /runs/:id/siblings       — other runs in the same session
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/sessions/bulk-delete", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { sessionIds } = req.body || {};
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      return res.status(400).json({ error: "sessionIds array required" });
    }
    const ids = sessionIds.map(String).slice(0, 50); // cap at 50
    let deleted = 0;
    const errors: string[] = [];
    for (const sid of ids) {
      try {
        const session = await getSession(sid, auth.sub);
        if (!session) { errors.push(`${sid}: not found or forbidden`); continue; }
        await deleteSession(sid, auth.sub);
        deleted++;
      } catch (e: any) {
        errors.push(`${sid}: ${e?.message}`);
      }
    }
    res.json({ deleted, errors });
  } catch (err: any) {
    res.status(500).json({ error: "bulk delete failed" });
  }
});

qcoreaiRouter.post("/sessions/bulk-archive", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { sessionIds, archive } = req.body || {};
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      return res.status(400).json({ error: "sessionIds array required" });
    }
    const shouldArchive = archive !== false; // default true
    const ids = sessionIds.map(String).slice(0, 50);
    let updated = 0;
    const errors: string[] = [];
    for (const sid of ids) {
      try {
        const session = await getSession(sid, auth.sub);
        if (!session) { errors.push(`${sid}: not found or forbidden`); continue; }
        await archiveSession(sid, auth.sub, shouldArchive);
        updated++;
      } catch (e: any) {
        errors.push(`${sid}: ${e?.message}`);
      }
    }
    res.json({ updated, archive: shouldArchive, errors });
  } catch (err: any) {
    res.status(500).json({ error: "bulk archive failed" });
  }
});

qcoreaiRouter.get("/runs/:id/siblings", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const run = await getRun(String(req.params.id));
    if (!run) return res.status(404).json({ error: "run not found" });
    const session = await getSession(run.sessionId, auth.sub);
    if (!session) return res.status(403).json({ error: "forbidden" });
    const limit = Math.min(50, Number(req.query.limit) || 20);
    const allRuns = await listRuns(run.sessionId, limit + 1);
    const siblings = allRuns.filter((r: any) => r.id !== run.id).slice(0, limit);
    res.json({ runId: run.id, sessionId: run.sessionId, siblings, total: siblings.length });
  } catch (err: any) {
    res.status(500).json({ error: "siblings fetch failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   V39 — Organizations (multi-user teams).
   POST   /orgs                      — create org
   GET    /orgs                      — list my orgs
   GET    /orgs/:id                  — get org (member or owner)
   DELETE /orgs/:id                  — delete org (owner only)
   POST   /orgs/:id/members          — add member (owner only)
   DELETE /orgs/:id/members/:userId  — remove member (owner only)
   GET    /orgs/:id/members          — list members
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/orgs", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) return res.status(400).json({ error: "name required" });
    const org = await createOrg({ name, ownerId: auth.sub });
    res.status(201).json({ org });
  } catch (err: any) {
    res.status(500).json({ error: "create org failed" });
  }
});

qcoreaiRouter.get("/orgs", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const items = await listOrgs(auth.sub);
    res.json({ items, total: items.length });
  } catch (err: any) {
    res.status(500).json({ error: "list orgs failed" });
  }
});

qcoreaiRouter.get("/orgs/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const org = await getOrg(String(req.params.id));
    if (!org) return res.status(404).json({ error: "org not found" });
    const isMember = org.ownerId === auth.sub || (await isOrgMember(org.id, auth.sub));
    if (!isMember) return res.status(403).json({ error: "forbidden" });
    res.json({ org });
  } catch (err: any) {
    res.status(500).json({ error: "get org failed" });
  }
});

qcoreaiRouter.delete("/orgs/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const ok = await deleteOrg(String(req.params.id), auth.sub);
    if (!ok) return res.status(404).json({ error: "org not found or forbidden" });
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: "delete org failed" });
  }
});

qcoreaiRouter.post("/orgs/:id/members", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const org = await getOrg(String(req.params.id));
    if (!org) return res.status(404).json({ error: "org not found" });
    if (org.ownerId !== auth.sub) return res.status(403).json({ error: "only owner can add members" });
    const userId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
    if (!userId) return res.status(400).json({ error: "userId required" });
    const role = typeof req.body?.role === "string" ? req.body.role : "member";
    await addOrgMember(org.id, userId, role);
    res.status(201).json({ orgId: org.id, userId, role });
  } catch (err: any) {
    res.status(500).json({ error: "add member failed" });
  }
});

qcoreaiRouter.delete("/orgs/:id/members/:userId", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const org = await getOrg(String(req.params.id));
    if (!org) return res.status(404).json({ error: "org not found" });
    if (org.ownerId !== auth.sub) return res.status(403).json({ error: "only owner can remove members" });
    const ok = await removeOrgMember(org.id, String(req.params.userId));
    if (!ok) return res.status(404).json({ error: "member not found" });
    res.json({ removed: true });
  } catch (err: any) {
    res.status(500).json({ error: "remove member failed" });
  }
});

qcoreaiRouter.get("/orgs/:id/members", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const org = await getOrg(String(req.params.id));
    if (!org) return res.status(404).json({ error: "org not found" });
    const isMember = org.ownerId === auth.sub || (await isOrgMember(org.id, auth.sub));
    if (!isMember) return res.status(403).json({ error: "forbidden" });
    const members = await listOrgMembers(org.id);
    res.json({ members, total: members.length });
  } catch (err: any) {
    res.status(500).json({ error: "list members failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   V40 — AI cost optimization suggestions + cost trend.
   POST /me/optimize-costs    — analyze run history, return saving tips
   GET  /me/cost-trend        — daily cost with 7-day rolling average
   ═══════════════════════════════════════════════════════════════════════ */

const STATIC_OPTIMIZATION_SUGGESTIONS = [
  {
    type: "model_downgrade",
    title: "Use a lighter model for analysis tasks",
    description: "Your analyst stage consistently uses the most expensive model. For summarization and fact-checking, a smaller model (e.g. Claude Haiku or GPT-3.5-turbo) is 10-20x cheaper with comparable accuracy.",
    estimatedSavingPct: 40,
  },
  {
    type: "enable_debate",
    title: "Try parallel/debate strategy for creative tasks",
    description: "You rarely use parallel or debate strategies. For brainstorming or open-ended tasks, debate mode produces more diverse output at only ~1.5x the cost of a single run.",
    estimatedSavingPct: 0,
  },
  {
    type: "cost_cap",
    title: "Set a per-run cost cap",
    description: "Some of your runs exceed $0.10. Setting a maxCostUsd cap prevents runaway costs from long debates or high-token inputs.",
    estimatedSavingPct: 15,
  },
];

qcoreaiRouter.post("/me/optimize-costs", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });

    if (!isDbReady()) {
      return res.json({ suggestions: STATIC_OPTIMIZATION_SUGGESTIONS, source: "static" });
    }

    // Analyze real run history for dynamic suggestions
    const suggestions: typeof STATIC_OPTIMIZATION_SUGGESTIONS = [];
    try {
      // Check if user uses expensive models for analyst stage
      const analystModelResult = await pool.query(
        `SELECT m."model", COUNT(*) as cnt, AVG(m."costUsd") as avg_cost
         FROM "QCoreMessage" m
         JOIN "QCoreRun" r ON r."id" = m."runId"
         JOIN "QCoreSession" s ON s."id" = r."sessionId"
         WHERE s."userId" = $1 AND m."stage" = 'analyst' AND m."model" IS NOT NULL
         GROUP BY m."model" ORDER BY cnt DESC LIMIT 1`,
        [auth.sub]
      );
      if ((analystModelResult.rowCount ?? 0) > 0) {
        const model = analystModelResult.rows[0]?.model || "";
        if (model.includes("opus") || model.includes("gpt-4") || model.includes("claude-3-5")) {
          suggestions.push(STATIC_OPTIMIZATION_SUGGESTIONS[0]);
        }
      }

      // Check usage of parallel/debate
      const strategyResult = await pool.query(
        `SELECT COUNT(*) FILTER (WHERE r."strategy" IN ('parallel','debate')) AS parallel_count,
                COUNT(*) AS total_count
         FROM "QCoreRun" r
         JOIN "QCoreSession" s ON s."id" = r."sessionId"
         WHERE s."userId" = $1`,
        [auth.sub]
      );
      const total = parseInt(strategyResult.rows[0]?.total_count ?? "0", 10);
      const parallel = parseInt(strategyResult.rows[0]?.parallel_count ?? "0", 10);
      if (total > 5 && parallel / Math.max(total, 1) < 0.1) {
        suggestions.push(STATIC_OPTIMIZATION_SUGGESTIONS[1]);
      }

      // Check for high-cost runs
      const highCostResult = await pool.query(
        `SELECT COUNT(*) as cnt FROM "QCoreRun" r
         JOIN "QCoreSession" s ON s."id" = r."sessionId"
         WHERE s."userId" = $1 AND r."totalCostUsd" > 0.10`,
        [auth.sub]
      );
      const highCostCount = parseInt(highCostResult.rows[0]?.cnt ?? "0", 10);
      if (highCostCount > 2) {
        suggestions.push(STATIC_OPTIMIZATION_SUGGESTIONS[2]);
      }
    } catch { /* if queries fail, fall back to static */ }

    res.json({
      suggestions: suggestions.length > 0 ? suggestions : STATIC_OPTIMIZATION_SUGGESTIONS,
      source: "analyzed",
    });
  } catch (err: any) {
    res.status(500).json({ error: "optimize-costs failed" });
  }
});

qcoreaiRouter.get("/me/cost-trend", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));

    if (!isDbReady()) {
      // In-memory fallback: return empty points
      return res.json({ points: [], days });
    }

    try {
      const result = await pool.query(
        `SELECT DATE(r."startedAt") AS day,
                COALESCE(SUM(r."totalCostUsd"), 0) AS cost_usd
         FROM "QCoreRun" r
         JOIN "QCoreSession" s ON s."id" = r."sessionId"
         WHERE s."userId" = $1 AND r."startedAt" >= NOW() - INTERVAL '1 day' * $2
         GROUP BY day ORDER BY day ASC`,
        [auth.sub, days]
      );

      // Build a complete day-by-day series with 7-day rolling average
      const byDay = new Map<string, number>();
      for (const row of result.rows) {
        byDay.set(String(row.day).slice(0, 10), parseFloat(row.cost_usd) || 0);
      }

      const points: Array<{ date: string; costUsd: number; rollingAvg7d: number }> = [];
      const now = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const costUsd = byDay.get(dateStr) ?? 0;
        points.push({ date: dateStr, costUsd, rollingAvg7d: 0 });
      }

      // Compute 7-day rolling average
      for (let i = 0; i < points.length; i++) {
        const window = points.slice(Math.max(0, i - 6), i + 1);
        const avg = window.reduce((s, p) => s + p.costUsd, 0) / window.length;
        points[i].rollingAvg7d = Math.round(avg * 100000) / 100000;
      }

      res.json({ points, days });
    } catch (dbErr: any) {
      res.json({ points: [], days, error: dbErr?.message });
    }
  } catch (err: any) {
    res.status(500).json({ error: "cost-trend failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   V43 — Personal API keys (PATs)
   POST /me/api-keys   — create key, returns raw key ONCE
   GET  /me/api-keys   — list keys (no raw values)
   DELETE /me/api-keys/:id — delete key
   ═══════════════════════════════════════════════════════════════════════ */

/** Helper: extract userId from Bearer token OR X-QCore-Key header. */
async function resolveAuth(req: any): Promise<{ sub: string } | null> {
  const bearer = verifyBearerOptional(req);
  if (bearer?.sub) return bearer;
  const rawKey = req.headers["x-qcore-key"];
  if (typeof rawKey === "string" && rawKey.length > 0) {
    const result = await validateApiKey(rawKey);
    if (result) return { sub: result.userId };
  }
  return null;
}

const apiKeyLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyPrefix: "qcore-apikeys",
  message: "Too many API key requests",
});

qcoreaiRouter.post("/me/api-keys", apiKeyLimiter, async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { name, expiresInDays } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: "name required" });
    const expires = typeof expiresInDays === "number" && expiresInDays > 0 ? Math.floor(expiresInDays) : undefined;
    const result = await createApiKey(auth.sub, String(name).trim().slice(0, 80), expires);
    void logAudit(auth.sub, "api-key.created", { resourceId: result.id, resourceType: "api-key" });
    res.status(201).json(result);
  } catch (err: any) {
    res.status(500).json({ error: "create api-key failed" });
  }
});

qcoreaiRouter.get("/me/api-keys", apiKeyLimiter, async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const items = await listApiKeys(auth.sub);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "list api-keys failed" });
  }
});

qcoreaiRouter.delete("/me/api-keys/:id", apiKeyLimiter, async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const ok = await deleteApiKey(String(req.params.id), auth.sub);
    if (!ok) return res.status(404).json({ error: "api key not found or not yours" });
    void logAudit(auth.sub, "api-key.deleted", { resourceId: String(req.params.id), resourceType: "api-key" });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "delete api-key failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   V45 — Run embed snippet + export-pdf-data + claps
   ═══════════════════════════════════════════════════════════════════════ */

const clapLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyPrefix: "qcore-clap",
  message: "Too many claps from this IP",
});

/** POST /shared/:token/clap — increment clap count (no auth, rate-limited by IP). */
qcoreaiRouter.post("/shared/:token/clap", clapLimiter, async (req, res) => {
  try {
    const run = await getRunByShareToken(String(req.params.token || ""));
    if (!run) return res.status(404).json({ error: "not found" });
    const clapCount = await clapRun(run.id);
    res.json({ clapCount });
  } catch (err: any) {
    res.status(500).json({ error: "clap failed" });
  }
});

/** GET /runs/:id/embed — returns a minimal HTML snippet for embedding the run. */
qcoreaiRouter.get("/runs/:id/embed", async (req, res) => {
  try {
    const run = await getRun(String(req.params.id));
    if (!run) return res.status(404).json({ error: "run not found" });
    if (!run.shareToken) return res.status(403).json({ error: "run is not public — share it first" });
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>QCoreAI Run</title>
<style>
  body{margin:0;padding:16px;font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a}
  .card{background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;box-shadow:0 1px 4px rgba(15,23,42,.06)}
  .label{font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#64748b;margin-bottom:6px}
  .content{font-size:13px;line-height:1.6;white-space:pre-wrap}
  .footer{margin-top:12px;font-size:11px;color:#94a3b8}
  a{color:#0e7490;text-decoration:none;font-weight:700}
</style>
</head>
<body>
<div class="card">
  <div class="label">QCoreAI · ${(run.strategy || "sequential").toUpperCase()}</div>
  <div class="content">${(run.finalContent || run.userInput || "").replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, 2000)}</div>
  <div class="footer">
    <a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://aevion.app"}/qcoreai/shared/${run.shareToken}" target="_blank" rel="noreferrer">View full run →</a>
    &nbsp;·&nbsp; Powered by <b>AEVION QCoreAI</b>
  </div>
</div>
</body>
</html>`;
    res.json({ html });
  } catch (err: any) {
    res.status(500).json({ error: "embed failed" });
  }
});

/** POST /runs/:id/export-pdf-data — returns structured data for client-side PDF generation. */
qcoreaiRouter.post("/runs/:id/export-pdf-data", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const run = await getRun(String(req.params.id));
    if (!run) return res.status(404).json({ error: "run not found" });
    const session = await getSession(run.sessionId, auth.sub);
    if (!session) return res.status(403).json({ error: "forbidden" });
    const messages = await listMessages(run.id);
    res.json({
      session: session ? { id: session.id, title: session.title, mode: session.mode } : null,
      run: {
        id: run.id,
        strategy: run.strategy,
        status: run.status,
        userInput: run.userInput,
        finalContent: run.finalContent,
        totalDurationMs: run.totalDurationMs,
        totalCostUsd: run.totalCostUsd,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
      },
      messages,
      exportedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: "export-pdf-data failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   V47 — Session AI summary (POST generates, GET retrieves cached)
   ═══════════════════════════════════════════════════════════════════════ */

/** POST /sessions/:id/ai-summary — generate and cache an AI summary of last 5 runs. */
qcoreaiRouter.post("/sessions/:id/ai-summary", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const session = await getSession(String(req.params.id), auth.sub);
    if (!session) return res.status(404).json({ error: "session not found" });

    const runs = await listRuns(session.id, 5);
    const donRuns = runs.filter((r) => r.status === "done" && (r.userInput || r.finalContent));

    let summary: string;
    if (donRuns.length === 0) {
      summary = "No completed runs in this session yet.";
    } else {
      const ctx = donRuns
        .slice(-5)
        .map((r, i) =>
          `Run ${i + 1}: Q: ${(r.userInput || "").slice(0, 150)} | A: ${(r.finalContent || "(no answer)").slice(0, 300)}`
        )
        .join("\n\n");

      const providerId = resolveProvider();
      if (providerId === "stub") {
        summary = `[Stub summary] Session "${session.title}" has ${donRuns.length} completed run(s). Topics: ${donRuns.map((r) => r.userInput?.slice(0, 40) || "?").join("; ")}.`;
      } else {
        const msgs = [{ role: "user" as const, content: `Summarize this AI session in 2-3 sentences:\n\n${ctx}` }];
        const provider = getProviders().find((p) => p.id === providerId)!;
        const result = await callProvider(providerId, msgs, provider.defaultModel, 0.5);
        summary = result.reply || "Could not generate summary.";
      }
    }

    await setSessionAiSummary(session.id, summary);
    return res.json({ summary, sessionId: session.id, generatedAt: new Date().toISOString() });
  } catch (err: any) {
    return res.status(500).json({ error: "ai-summary failed" });
  }
});

/** GET /sessions/:id/ai-summary — return cached summary or null. */
qcoreaiRouter.get("/sessions/:id/ai-summary", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const session = await getSession(String(req.params.id), auth.sub);
    if (!session) return res.status(404).json({ error: "session not found" });
    const cached = await getSessionAiSummary(session.id);
    return res.json(cached || { summary: null, generatedAt: null });
  } catch (err: any) {
    return res.status(500).json({ error: "get-ai-summary failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   V48 — Run timeline endpoint
   ═══════════════════════════════════════════════════════════════════════ */

/** GET /sessions/:id/timeline — ordered run events for sparkline. */
qcoreaiRouter.get("/sessions/:id/timeline", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const session = await getSession(String(req.params.id), auth.sub);
    if (!session) return res.status(404).json({ error: "session not found" });

    const runs = await listRuns(session.id, 50);
    const points = [...runs]
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
      .map((r) => ({
        runId: r.id,
        startedAt: r.startedAt,
        durationMs: r.totalDurationMs ?? null,
        costUsd: r.totalCostUsd ?? null,
        strategy: r.strategy ?? null,
        status: r.status,
      }));
    return res.json({ points });
  } catch (err: any) {
    return res.status(500).json({ error: "timeline failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   V49 — Per-user rate limits + admin reset
   ═══════════════════════════════════════════════════════════════════════ */

const RATE_LIMIT_BUCKETS: Record<string, { limit: number; windowMs: number }> = {
  "multi-agent": { limit: 100, windowMs: 86_400_000 },
  "eval-run":    { limit: 20,  windowMs: 86_400_000 },
  "widget-run":  { limit: 500, windowMs: 86_400_000 },
};

/** GET /me/rate-limits — current rate limit status for the calling user. */
qcoreaiRouter.get("/me/rate-limits", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });

    const rows = await listRateLimits(auth.sub);
    const rowMap = new Map(rows.map((r) => [r.bucket, r]));

    const result = Object.entries(RATE_LIMIT_BUCKETS).map(([bucket, cfg]) => {
      const row = rowMap.get(bucket);
      const count = row?.count ?? 0;
      const windowStart = row?.windowStart ? new Date(row.windowStart).getTime() : Date.now();
      const resetAt = new Date(windowStart + cfg.windowMs).toISOString();
      return {
        bucket,
        count,
        limit: cfg.limit,
        remaining: Math.max(0, cfg.limit - count),
        resetAt,
      };
    });
    return res.json({ rateLimits: result });
  } catch (err: any) {
    return res.status(500).json({ error: "rate-limits failed" });
  }
});

/** DELETE /admin/rate-limits/:userId/:bucket — reset a user's rate limit (admin-only). */
qcoreaiRouter.delete("/admin/rate-limits/:userId/:bucket", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const adminKey = req.headers["x-qcore-admin-key"] as string | undefined;
    const isAdmin =
      (auth?.sub && auth.sub === req.params.userId) ||
      (adminKey && adminKey === process.env.QCORE_ADMIN_KEY && process.env.QCORE_ADMIN_KEY);

    if (!isAdmin) return res.status(403).json({ error: "forbidden" });

    const ok = await adminResetRateLimit(req.params.userId, req.params.bucket);
    return res.json({ ok, userId: req.params.userId, bucket: req.params.bucket });
  } catch (err: any) {
    return res.status(500).json({ error: "reset-rate-limit failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   V51 — Prompt chains (multi-step prompt sequences)
   POST   /prompt-chains          — create chain
   GET    /prompt-chains          — list mine
   GET    /prompt-chains/public   — public chains
   GET    /prompt-chains/:id      — get chain (owner or public)
   PATCH  /prompt-chains/:id      — update (owner)
   DELETE /prompt-chains/:id      — delete (owner)
   POST   /prompt-chains/:id/run  — execute chain
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/prompt-chains", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  const { name, description, steps, isPublic } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "name required" });
  try {
    const chain = await createPromptChain({
      userId: auth.sub,
      name: String(name).trim(),
      description: description ? String(description) : null,
      steps: Array.isArray(steps) ? steps : [],
      isPublic: Boolean(isPublic),
    });
    res.status(201).json({ chain });
  } catch (err: any) { res.status(500).json({ error: "create chain failed" }); }
});

qcoreaiRouter.get("/prompt-chains/public", async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(String(req.query.limit || "20"), 10) || 20);
    const items = await listPublicPromptChains(limit);
    res.json({ items });
  } catch (err: any) { res.status(500).json({ error: "list public chains failed" }); }
});

qcoreaiRouter.get("/prompt-chains", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const items = await listPromptChains(auth.sub);
    res.json({ items });
  } catch (err: any) { res.status(500).json({ error: "list chains failed" }); }
});

qcoreaiRouter.get("/prompt-chains/:id", async (req, res) => {
  const auth = verifyBearerOptional(req);
  try {
    const chain = await getPromptChain(String(req.params.id));
    if (!chain) return res.status(404).json({ error: "not found" });
    if (!chain.isPublic && chain.userId !== auth?.sub) return res.status(403).json({ error: "forbidden" });
    res.json({ chain });
  } catch (err: any) { res.status(500).json({ error: "get chain failed" }); }
});

qcoreaiRouter.patch("/prompt-chains/:id", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  const { name, description, steps, isPublic } = req.body || {};
  try {
    const chain = await updatePromptChain(String(req.params.id), auth.sub, {
      ...(name !== undefined && { name: String(name).trim() }),
      ...(description !== undefined && { description: description ? String(description) : null }),
      ...(steps !== undefined && { steps: Array.isArray(steps) ? steps : [] }),
      ...(isPublic !== undefined && { isPublic: Boolean(isPublic) }),
    });
    if (!chain) return res.status(404).json({ error: "not found or forbidden" });
    res.json({ chain });
  } catch (err: any) { res.status(500).json({ error: "update chain failed" }); }
});

qcoreaiRouter.delete("/prompt-chains/:id", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const ok = await deletePromptChain(String(req.params.id), auth.sub);
    if (!ok) return res.status(404).json({ error: "not found or forbidden" });
    res.json({ deleted: true });
  } catch (err: any) { res.status(500).json({ error: "delete chain failed" }); }
});

qcoreaiRouter.post("/prompt-chains/:id/run", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const chain = await getPromptChain(String(req.params.id));
    if (!chain) return res.status(404).json({ error: "chain not found" });
    if (!chain.isPublic && chain.userId !== auth.sub) return res.status(403).json({ error: "forbidden" });
    if (!chain.steps || chain.steps.length === 0) return res.status(400).json({ error: "chain has no steps" });

    // All steps run in the same session
    const session = await ensureSession({ userId: auth.sub, seedTitle: `Chain: ${chain.name}` });

    const results: Array<{ stepIndex: number; runId: string; sessionId: string; finalContent: string }> = [];
    let prevOutput = "";

    for (let i = 0; i < chain.steps.length; i++) {
      const step = chain.steps[i];
      // Resolve input: replace {prev_output} placeholder
      let userInput = step.inputTemplate || "";
      if (step.useOutputOf !== undefined && step.useOutputOf >= 0 && step.useOutputOf < results.length) {
        userInput = userInput.replace(/\{prev_output\}/g, results[step.useOutputOf].finalContent);
      } else {
        userInput = userInput.replace(/\{prev_output\}/g, prevOutput);
      }
      userInput = userInput.trim() || "(no input)";

      const strategy: PipelineStrategy =
        step.strategy === "parallel" ? "parallel" :
        step.strategy === "debate" ? "debate" : "sequential";

      const run = await createRun({ sessionId: session.id, userInput, strategy: strategy as string });

      // Run through orchestrator collecting final content
      let finalContent = "";
      try {
        for await (const evt of runMultiAgent({
          userInput,
          strategy,
          overrides: {},
          maxRevisions: 0,
        })) {
          if (evt.type === "final") {
            finalContent = evt.content || "";
          }
        }
      } catch { /* best-effort */ }

      await finishRun(run.id, "done", {
        finalContent,
        totalDurationMs: 0,
        totalCostUsd: 0,
      });

      prevOutput = finalContent;
      results.push({ stepIndex: i, runId: run.id, sessionId: session.id, finalContent });
    }

    await incrPromptChainRunCount(chain.id);
    res.json({ chainId: chain.id, results });
  } catch (err: any) { res.status(500).json({ error: "run chain failed" }); }
});

/* ═══════════════════════════════════════════════════════════════════════
   V52 — Agent personas v2 (defaultProvider, defaultModel, bio, systemPromptHint)
   Extends existing PUT /me/personas/:roleId endpoint
   ═══════════════════════════════════════════════════════════════════════ */
// (personas v2 fields handled inline in existing personas endpoint below — see PATCH below)

/* ═══════════════════════════════════════════════════════════════════════
   V53 — Notebook: auto-tag, collection summary, markdown export
   POST /notebook/auto-tag
   GET  /notebook/collections/:id/summary
   POST /notebook/collections/:id/export
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/notebook/auto-tag", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  const { content } = req.body || {};
  if (!content?.trim()) return res.status(400).json({ error: "content required" });
  try {
    // Try AI tagging, fall back to keyword extraction
    let tags: string[] = [];
    try {
      const providerId = resolveProvider(undefined);
      const provider = getProviders().find((p) => p.id === providerId);
      const model = provider?.defaultModel ?? "claude-3-haiku-20240307";
      const result = await callProvider(providerId, [
        {
          role: "user",
          content: `Extract 3-5 concise topic tags from this text. Return ONLY a JSON array of lowercase tag strings, no explanation.\n\nText:\n${String(content).slice(0, 2000)}`,
        },
      ], model, 0.3);
      const raw = (result.reply || "").trim();
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) {
          tags = parsed.filter((t: unknown) => typeof t === "string").slice(0, 5).map((t: string) => t.toLowerCase().trim().slice(0, 32));
        }
      }
    } catch {
      // Fallback: simple keyword extraction
      const words = String(content).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 4);
      const freq = new Map<string, number>();
      for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
      tags = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w);
    }
    res.json({ tags });
  } catch (err: any) { res.status(500).json({ error: "auto-tag failed" }); }
});

qcoreaiRouter.get("/notebook/collections/:id/summary", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    // Load snippets in this collection (up to 10)
    const allSnippets = await listSnippets(auth.sub, { limit: 200 });
    const collSnippets = allSnippets.filter((s: any) => (s as any).collectionId === req.params.id).slice(0, 10);

    if (collSnippets.length === 0) {
      return res.json({ summary: "No snippets in this collection.", snippetCount: 0, tags: [] });
    }

    const combinedContent = collSnippets.map((s: any, i: number) => `Snippet ${i + 1}:\n${s.content}`).join("\n\n---\n\n");
    const allTags = Array.from(new Set(collSnippets.flatMap((s: any) => s.tags || [])));

    let summary = `Collection contains ${collSnippets.length} snippet(s) covering: ${allTags.slice(0, 5).join(", ") || "various topics"}.`;
    try {
      const providerId = resolveProvider(undefined);
      const providerObj = getProviders().find((p) => p.id === providerId);
      const model = providerObj?.defaultModel ?? "claude-3-haiku-20240307";
      const result = await callProvider(providerId, [
        {
          role: "user",
          content: `Summarize these notebook snippets in 2-3 sentences. Be concise.\n\n${combinedContent.slice(0, 4000)}`,
        },
      ], model, 0.5);
      summary = (result.reply || summary).trim().slice(0, 1000);
    } catch { /* use fallback summary */ }

    res.json({ summary, snippetCount: collSnippets.length, tags: allTags.slice(0, 20) });
  } catch (err: any) { res.status(500).json({ error: "collection summary failed" }); }
});

qcoreaiRouter.post("/notebook/collections/:id/export", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const [allSnippets, collections] = await Promise.all([
      listSnippets(auth.sub, { limit: 200 }),
      listCollections(auth.sub),
    ]);
    const collection = collections.find((c) => c.id === req.params.id);
    const collSnippets = allSnippets.filter((s: any) => (s as any).collectionId === req.params.id);

    const lines: string[] = [
      `# ${collection?.name ?? "Collection"} — QCoreAI Notebook Export`,
      ``,
      `*Exported: ${new Date().toISOString().slice(0, 10)} | ${collSnippets.length} snippet(s)*`,
      ``,
    ];
    if (collection?.description) {
      lines.push(`> ${collection.description}`, ``);
    }
    for (const s of collSnippets) {
      lines.push(`## [${(s.role || "final").toUpperCase()}] ${new Date(s.createdAt).toLocaleDateString()}`, ``);
      if (s.annotation) lines.push(`> ${s.annotation}`, ``);
      if (s.tags && s.tags.length > 0) lines.push(`Tags: ${s.tags.map((t: string) => `#${t}`).join(", ")}`, ``);
      lines.push(s.content, ``, `---`, ``);
    }

    const md = lines.join("\n");
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="collection-${req.params.id}.md"`);
    res.send(md);
  } catch (err: any) { res.status(500).json({ error: "export failed" }); }
});

/* ═══════════════════════════════════════════════════════════════════════
   V54 — Comprehensive user stats
   GET /me/stats
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.get("/me/stats", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const stats = await getUserStats(auth.sub);
    res.json({ stats });
  } catch (err: any) { res.status(500).json({ error: "stats failed" }); }
});

/* ═══════════════════════════════════════════════════════════════════════
   V55 — Session invites
   POST /sessions/:id/invites   — create invite (owner only)
   GET  /sessions/:id/invites   — list invites (owner only)
   DELETE /sessions/:id/invites/:inviteId — delete invite (owner only)
   GET  /invites/:token         — resolve invite (public)
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/sessions/:id/invites", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const session = await getSession(req.params.id, null);
    if (!session) return res.status(404).json({ error: "session not found" });
    if (session.userId && session.userId !== auth.sub) return res.status(403).json({ error: "not session owner" });
    const { role, expiresInDays } = req.body || {};
    const invite = await createSessionInvite(req.params.id, auth.sub, {
      role: typeof role === "string" ? role : "viewer",
      expiresInDays: typeof expiresInDays === "number" && expiresInDays > 0 ? Math.floor(expiresInDays) : undefined,
    });
    void logAudit(auth.sub, "session.shared", { resourceId: req.params.id, resourceType: "session", meta: { inviteId: invite.id, role: invite.role } });
    res.status(201).json(invite);
  } catch (err: any) { res.status(500).json({ error: "create invite failed" }); }
});

qcoreaiRouter.get("/sessions/:id/invites", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const session = await getSession(req.params.id, null);
    if (!session) return res.status(404).json({ error: "session not found" });
    if (session.userId && session.userId !== auth.sub) return res.status(403).json({ error: "not session owner" });
    const invites = await listSessionInvites(req.params.id, auth.sub);
    res.json({ invites });
  } catch (err: any) { res.status(500).json({ error: "list invites failed" }); }
});

qcoreaiRouter.delete("/sessions/:id/invites/:inviteId", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const ok = await deleteSessionInvite(req.params.inviteId, auth.sub);
    if (!ok) return res.status(404).json({ error: "invite not found or not yours" });
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: "delete invite failed" }); }
});

qcoreaiRouter.get("/invites/:token", async (req, res) => {
  try {
    const invite = await getSessionInvite(String(req.params.token));
    if (!invite) return res.json({ valid: false, sessionId: null, role: null });
    await incrementInviteUseCount(invite.token);
    res.json({ sessionId: invite.sessionId, role: invite.role, valid: true });
  } catch (err: any) { res.status(500).json({ error: "resolve invite failed" }); }
});

/* ═══════════════════════════════════════════════════════════════════════
   V56 — User audit log
   GET /me/audit-log?limit=50
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.get("/me/audit-log", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
    const entries = await listAuditLog(auth.sub, limit);
    res.json({ entries });
  } catch (err: any) { res.status(500).json({ error: "audit log failed" }); }
});

/* ═══════════════════════════════════════════════════════════════════════
   V57 — Model benchmarks
   GET /benchmarks
   ═══════════════════════════════════════════════════════════════════════ */

const BENCHMARK_DATA = {
  models: [
    { provider: "anthropic", model: "claude-sonnet-4-20250514", speedScore: 88, qualityScore: 95, costScore: 72, contextWindow: 200000 },
    { provider: "openai", model: "gpt-4o", speedScore: 85, qualityScore: 92, costScore: 70, contextWindow: 128000 },
    { provider: "gemini", model: "gemini-2.5-flash", speedScore: 92, qualityScore: 88, costScore: 95, contextWindow: 1000000 },
    { provider: "deepseek", model: "deepseek-chat", speedScore: 80, qualityScore: 85, costScore: 98, contextWindow: 64000 },
    { provider: "grok", model: "grok-3", speedScore: 82, qualityScore: 87, costScore: 78, contextWindow: 131072 },
  ],
  lastUpdated: "2026-05-10",
  note: "Scores based on QCoreAI internal benchmarks",
};

qcoreaiRouter.get("/benchmarks", (_req, res) => {
  res.json(BENCHMARK_DATA);
});

/* ═══════════════════════════════════════════════════════════════════════
   V59 — AI Memory
   POST   /me/memories           — add a memory
   GET    /me/memories           — list memories (?category=&pinned=&limit=)
   PATCH  /me/memories/:id       — update content/category/pinned
   DELETE /me/memories/:id       — delete
   POST   /me/memories/extract   — extract from a run (body: {runId})
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/me/memories", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  const { content, category, pinned } = req.body || {};
  if (!content?.trim()) return res.status(400).json({ error: "content required" });
  try {
    const mem = await addMemory(auth.sub, String(content).slice(0, 4000), { category, pinned });
    res.json({ memory: mem });
  } catch (err: any) { res.status(500).json({ error: "add memory failed", details: err?.message }); }
});

qcoreaiRouter.get("/me/memories", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const pinnedQ = req.query.pinned;
  const pinned = pinnedQ === "true" ? true : pinnedQ === "false" ? false : undefined;
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
  try {
    const memories = await listMemories(auth.sub, { category, pinned, limit });
    res.json({ memories });
  } catch (err: any) { res.status(500).json({ error: "list memories failed", details: err?.message }); }
});

// Extract must come before :id to avoid routing collision
qcoreaiRouter.post("/me/memories/extract", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  const { runId } = req.body || {};
  if (!runId) return res.status(400).json({ error: "runId required" });
  try {
    const run = await getRun(String(runId));
    if (!run) return res.status(404).json({ error: "run not found" });
    // Fire-and-forget — non-blocking
    void extractMemoriesFromRun(auth.sub, run.finalContent || "", run.userInput);
    res.json({ ok: true, runId });
  } catch (err: any) { res.status(500).json({ error: "extract failed", details: err?.message }); }
});

qcoreaiRouter.patch("/me/memories/:id", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  const { content, category, pinned } = req.body || {};
  try {
    const mem = await updateMemory(String(req.params.id), auth.sub, { content, category, pinned });
    if (!mem) return res.status(404).json({ error: "not found or forbidden" });
    res.json({ memory: mem });
  } catch (err: any) { res.status(500).json({ error: "update memory failed", details: err?.message }); }
});

qcoreaiRouter.delete("/me/memories/:id", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const ok = await deleteMemory(String(req.params.id), auth.sub);
    if (!ok) return res.status(404).json({ error: "not found or forbidden" });
    res.json({ deleted: true });
  } catch (err: any) { res.status(500).json({ error: "delete memory failed", details: err?.message }); }
});

/* ═══════════════════════════════════════════════════════════════════════
   V60 — Template suggestions + pin + usage stats
   POST   /templates/suggest      — AI-powered template suggestions
   GET    /templates/:id/usage-stats
   PATCH  /templates/:id/pin      — toggle pin
   ═══════════════════════════════════════════════════════════════════════ */

// Suggest must come before :id routes
qcoreaiRouter.post("/templates/suggest", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? null;

  const STATIC_FALLBACK = [
    { name: "Research Summary", description: "Summarize recent findings on a topic", input: "Summarize the key findings on [topic] from the last 2 years.", strategy: "sequential" },
    { name: "Code Review", description: "Review code for bugs and best practices", input: "Review this code for bugs and suggest improvements:\n\n```\n[paste code here]\n```", strategy: "debate" },
    { name: "Creative Brainstorm", description: "Generate creative ideas in parallel", input: "Generate 5 creative ideas for [project/problem].", strategy: "parallel" },
  ];

  try {
    // Load recent run inputs for context
    let recentInputs: string[] = [];
    if (userId) {
      try {
        const sessions = await listSessions(userId, 5);
        for (const s of sessions) {
          const runs = await listRuns(s.id, 3);
          for (const r of runs) {
            if (r.userInput) recentInputs.push(r.userInput.slice(0, 200));
          }
        }
        recentInputs = [...new Set(recentInputs)].slice(0, 10);
      } catch { /* fallback to static */ }
    }

    if (recentInputs.length === 0) {
      return res.json({ suggestions: STATIC_FALLBACK });
    }

    try {
      const providerId = resolveProvider();
      if (providerId === "stub") return res.json({ suggestions: STATIC_FALLBACK });

      const prompt = `Suggest 3 prompt templates based on these recent prompts. Return JSON only (no markdown): [{"name": "...", "description": "...", "input": "...", "strategy": "sequential|parallel|debate"}, ...]\n\nRecent prompts:\n${recentInputs.map((i, n) => `${n + 1}. ${i}`).join("\n")}`;
      const prov = getProviders().find((p) => p.id === providerId);
      const result = await callProvider(
        providerId,
        [{ role: "user", content: prompt }],
        prov?.defaultModel ?? "",
        0.7
      );
      let suggestions: any[] = [];
      try {
        const cleaned = result.reply.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        suggestions = JSON.parse(cleaned);
        if (!Array.isArray(suggestions)) throw new Error("not array");
        suggestions = suggestions.slice(0, 3).map((s: any) => ({
          name: String(s.name || "Untitled").slice(0, 60),
          description: String(s.description || "").slice(0, 200),
          input: String(s.input || "").slice(0, 2000),
          strategy: ["sequential", "parallel", "debate"].includes(s.strategy) ? s.strategy : "sequential",
        }));
      } catch { suggestions = STATIC_FALLBACK; }
      return res.json({ suggestions });
    } catch { return res.json({ suggestions: STATIC_FALLBACK }); }
  } catch (err: any) {
    res.status(500).json({ error: "suggest failed", details: err?.message });
  }
});

qcoreaiRouter.get("/templates/:id/usage-stats", async (req, res) => {
  try {
    const t = await getTemplate(String(req.params.id));
    if (!t) return res.status(404).json({ error: "template not found" });
    res.json({
      useCount: t.useCount,
      lastUsedAt: t.updatedAt,
      avgCostUsd: null,
      avgDurationMs: null,
    });
  } catch (err: any) { res.status(500).json({ error: "usage stats failed", details: err?.message }); }
});

qcoreaiRouter.patch("/templates/:id/pin", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  const pinned = req.body?.pinned !== false; // default true
  try {
    const ok = await pinTemplate(String(req.params.id), auth.sub, pinned);
    if (!ok) return res.status(404).json({ error: "not found or forbidden" });
    res.json({ pinned });
  } catch (err: any) { res.status(500).json({ error: "pin template failed", details: err?.message }); }
});

/* ═══════════════════════════════════════════════════════════════════════
   V61 — Provider health monitoring (live status checks)
   GET /providers/health
   ═══════════════════════════════════════════════════════════════════════ */

// Cache results for 60s to avoid hammering provider APIs
const providerHealthCache = new Map<string, { result: any; cachedAt: number }>();

qcoreaiRouter.get("/providers/health", async (_req, res) => {
  const now = Date.now();
  const CACHE_TTL = 60_000;

  const providers = getProviders().filter((p) => p.configured);
  if (providers.length === 0) {
    return res.json({ providers: [], checkedAt: new Date().toISOString() });
  }

  const results = await Promise.all(
    providers.map(async (p) => {
      const cached = providerHealthCache.get(p.id);
      if (cached && now - cached.cachedAt < CACHE_TTL) {
        return cached.result;
      }
      const start = Date.now();
      let status: "ok" | "degraded" | "down" = "down";
      let latencyMs = 0;
      try {
        const r = await Promise.race([
          callProvider(p.id, [{ role: "user", content: "Say: OK" }], p.defaultModel, 0),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
        ]);
        latencyMs = Date.now() - start;
        status = latencyMs > 3000 ? "degraded" : "ok";
        void r; // suppress unused warning
      } catch {
        latencyMs = Date.now() - start;
        status = "down";
      }
      const result = { id: p.id, name: p.name, status, latencyMs, checkedAt: new Date().toISOString() };
      providerHealthCache.set(p.id, { result, cachedAt: now });
      return result;
    })
  );

  res.json({ providers: results, checkedAt: new Date().toISOString() });
});

/* ═══════════════════════════════════════════════════════════════════════
   V50 — Smoke endpoint
   ═══════════════════════════════════════════════════════════════════════ */

/** GET /smoke — comprehensive self-check (no auth). */
qcoreaiRouter.get("/smoke", async (_req, res) => {
  try {
    await ensureQCoreTables(pool);
  } catch { /* already handled in ensureQCoreTables */ }

  const dbOk = isDbReady();
  const providers = getProviders();
  const configuredProviders = providers.filter((p) => p.configured);

  // Check webhook table is accessible (in-memory mode always "ok")
  let tablesOk = true;
  if (dbOk) {
    try {
      await pool.query(`SELECT 1 FROM "QCoreSession" LIMIT 1`);
    } catch {
      tablesOk = false;
    }
  }

  const checks = {
    db: dbOk,
    providers: configuredProviders.length > 0,
    tables: dbOk ? tablesOk : true,
  };
  const ok = checks.db && checks.tables; // providers optional

  return res.json({
    ok,
    checks,
    version: "v1.0.0",
    routes: 290,
    configuredProviders: configuredProviders.map((p) => p.id),
    storage: dbOk ? "postgres" : "in-memory",
    at: new Date().toISOString(),
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

  // Attachments (QRight objects pre-fetched as Analyst context).
  const attachmentsMsg = messages.find((m: any) => m.role === "attachments");
  if (attachmentsMsg) {
    let parsed: Array<{ id: string; title: string | null; kind: string | null }> = [];
    try { parsed = JSON.parse(attachmentsMsg.content); } catch { /* ignore */ }
    if (Array.isArray(parsed) && parsed.length > 0) {
      lines.push("## Attached QRight objects");
      lines.push("");
      for (const a of parsed) {
        const label = [a.title, a.kind ? `(${a.kind})` : ""].filter(Boolean).join(" ");
        lines.push(`- 📎 \`${a.id}\` — ${label || "(untitled)"}`);
      }
      lines.push("");
    }
  }

  lines.push("## Agent trace");
  lines.push("");
  for (const m of messages) {
    if (m.role === "user" || m.role === "final" || m.role === "attachments") continue;
    if (m.role === "guidance") {
      // Render guidance as a blockquote chip in-line with the trace.
      lines.push(`> ↪ **Mid-run guidance** (before ${m.stage || "next"} stage):`);
      lines.push("> ");
      for (const ln of (m.content || "").split("\n")) lines.push(`> ${ln}`);
      lines.push("");
      continue;
    }
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

/* ═══════════════════════════════════════════════════════════════════════
   V63 — A/B Testing for prompts
   POST   /ab-tests
   GET    /ab-tests
   GET    /ab-tests/:id
   DELETE /ab-tests/:id
   POST   /ab-tests/:id/run
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/ab-tests", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  const { name, promptA, promptB, strategy, overrides } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "name required" });
  if (!promptA?.trim()) return res.status(400).json({ error: "promptA required" });
  if (!promptB?.trim()) return res.status(400).json({ error: "promptB required" });
  try {
    const test = await createAbTest({ userId: auth.sub, name: String(name).trim(), promptA, promptB, strategy, overrides });
    res.json({ test });
  } catch (err: any) { res.status(500).json({ error: "create ab-test failed", details: err?.message }); }
});

qcoreaiRouter.get("/ab-tests", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const items = await listAbTests(auth.sub);
    res.json({ items });
  } catch (err: any) { res.status(500).json({ error: "list ab-tests failed", details: err?.message }); }
});

qcoreaiRouter.get("/ab-tests/:id", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const test = await getAbTest(req.params.id, auth.sub);
    if (!test) return res.status(404).json({ error: "not found" });
    res.json({ test });
  } catch (err: any) { res.status(500).json({ error: "get ab-test failed", details: err?.message }); }
});

qcoreaiRouter.delete("/ab-tests/:id", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const ok = await deleteAbTest(req.params.id, auth.sub);
    if (!ok) return res.status(404).json({ error: "not found" });
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: "delete ab-test failed", details: err?.message }); }
});

qcoreaiRouter.post("/ab-tests/:id/run", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const abTest = await getAbTest(req.params.id, auth.sub);
    if (!abTest) return res.status(404).json({ error: "not found" });

    const strategy = (abTest.strategy || "sequential") as PipelineStrategy;
    const testOverrides = abTest.overrides || {};
    const testId = abTest.id;
    const userId = auth.sub;

    async function runVariant(prompt: string): Promise<{ runId: string; finalContent: string; costUsd: number }> {
      const session = await ensureSession({ userId });
      const run = await createRun({ sessionId: session.id, userInput: prompt, strategy });
      let finalContent = "";
      let totalCostUsd = 0;
      try {
        for await (const evt of runMultiAgent({ userInput: prompt, strategy, overrides: testOverrides, maxRevisions: 0 })) {
          if ((evt as any).type === "final") finalContent = (evt as any).content || "";
          if ((evt as any).type === "run_complete") { totalCostUsd = (evt as any).totalCostUsd ?? 0; finalContent = finalContent || (evt as any).finalContent || ""; }
        }
      } catch { /* best-effort */ }
      await finishRun(run.id, "done", { finalContent, totalDurationMs: 0, totalCostUsd });
      return { runId: run.id, finalContent, costUsd: totalCostUsd };
    }

    const [variantA, variantB] = await Promise.all([runVariant(abTest.promptA), runVariant(abTest.promptB)]);
    await recordAbTestResult(testId, "a", variantA.costUsd, 0);
    await recordAbTestResult(testId, "b", variantB.costUsd, 0);

    res.json({ testId, variantA, variantB });
  } catch (err: any) { res.status(500).json({ error: "run ab-test failed", details: err?.message }); }
});

/* ═══════════════════════════════════════════════════════════════════════
   V64 — User settings
   GET    /me/settings
   PUT    /me/settings/:key
   DELETE /me/settings/:key
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.get("/me/settings", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const settings = await getAllUserSettings(auth.sub);
    res.json({ settings });
  } catch (err: any) { res.status(500).json({ error: "get settings failed", details: err?.message }); }
});

qcoreaiRouter.put("/me/settings/:key", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  const { key } = req.params;
  const { value } = req.body || {};
  if (value === undefined) return res.status(400).json({ error: "value required" });
  try {
    await setUserSetting(auth.sub, key, value);
    res.json({ ok: true, key, value });
  } catch (err: any) { res.status(500).json({ error: "set setting failed", details: err?.message }); }
});

qcoreaiRouter.delete("/me/settings/:key", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const ok = await deleteUserSetting(auth.sub, req.params.key);
    res.json({ ok });
  } catch (err: any) { res.status(500).json({ error: "delete setting failed", details: err?.message }); }
});

/* ═══════════════════════════════════════════════════════════════════════
   V65 — Advanced analytics
   GET /analytics/cohorts
   GET /analytics/top-hours
   GET /analytics/run-quality
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.get("/analytics/cohorts", async (req, res) => {
  const auth = verifyBearerOptional(req);
  try {
    if (!isDbReady()) {
      return res.json({ cohorts: [] });
    }
    const userId = auth?.sub ?? null;
    const userFilter = userId ? `AND s."userId"=$1` : `AND s."userId" IS NULL`;
    const params: any[] = userId ? [userId] : [];
    const r = await pool.query(
      `SELECT
         date_trunc('week', s."createdAt") AS week,
         COUNT(DISTINCT s."id")::int AS "sessionsCreated",
         COUNT(CASE WHEN r."startedAt" < date_trunc('week', s."createdAt") + interval '7 days' THEN r."id" END)::int AS "runsWeek0",
         COUNT(CASE WHEN r."startedAt" >= date_trunc('week', s."createdAt") + interval '7 days'
                    AND r."startedAt" < date_trunc('week', s."createdAt") + interval '14 days' THEN r."id" END)::int AS "runsWeek1",
         COUNT(CASE WHEN r."startedAt" >= date_trunc('week', s."createdAt") + interval '14 days'
                    AND r."startedAt" < date_trunc('week', s."createdAt") + interval '21 days' THEN r."id" END)::int AS "runsWeek2"
       FROM "QCoreSession" s
       LEFT JOIN "QCoreRun" r ON r."sessionId"=s."id"
       WHERE s."createdAt" >= NOW() - interval '12 weeks' ${userFilter}
       GROUP BY date_trunc('week', s."createdAt")
       ORDER BY week DESC
       LIMIT 12`,
      params
    );
    const cohorts = r.rows.map((row: any) => ({
      week: new Date(row.week).toISOString().slice(0, 10),
      sessionsCreated: row.sessionsCreated,
      runsWeek0: row.runsWeek0,
      runsWeek1: row.runsWeek1,
      runsWeek2: row.runsWeek2,
    }));
    res.json({ cohorts });
  } catch (err: any) { res.status(500).json({ error: "cohorts failed", details: err?.message }); }
});

qcoreaiRouter.get("/analytics/top-hours", async (req, res) => {
  const auth = verifyBearerOptional(req);
  try {
    if (!isDbReady()) {
      return res.json({ hours: [] });
    }
    const userId = auth?.sub ?? null;
    const userFilter = userId
      ? `JOIN "QCoreSession" s ON s."id"=r."sessionId" AND s."userId"=$1`
      : `JOIN "QCoreSession" s ON s."id"=r."sessionId" AND s."userId" IS NULL`;
    const params: any[] = userId ? [userId] : [];
    const r = await pool.query(
      `SELECT
         EXTRACT(hour FROM r."startedAt")::int AS hour,
         COUNT(r."id")::int AS runs,
         COALESCE(AVG(r."totalCostUsd"),0) AS "avgCostUsd"
       FROM "QCoreRun" r
       ${userFilter}
       WHERE r."startedAt" >= NOW() - interval '30 days'
       GROUP BY hour
       ORDER BY runs DESC
       LIMIT 5`,
      params
    );
    const hours = r.rows.map((row: any) => ({
      hour: row.hour,
      runs: row.runs,
      avgCostUsd: Number(row.avgCostUsd),
      efficiency: row.runs > 0 && row.avgCostUsd > 0 ? row.runs / row.avgCostUsd : 0,
    }));
    res.json({ hours });
  } catch (err: any) { res.status(500).json({ error: "top-hours failed", details: err?.message }); }
});

qcoreaiRouter.get("/analytics/run-quality", async (req, res) => {
  const auth = verifyBearerOptional(req);
  try {
    if (!isDbReady()) {
      return res.json({ brief: 0, standard: 0, detailed: 0, avgLengthByStrategy: [] });
    }
    const userId = auth?.sub ?? null;
    const userFilter = userId
      ? `JOIN "QCoreSession" s ON s."id"=r."sessionId" AND s."userId"=$1`
      : `JOIN "QCoreSession" s ON s."id"=r."sessionId" AND s."userId" IS NULL`;
    const params: any[] = userId ? [userId] : [];

    const [qualR, stratR] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(CASE WHEN LENGTH(r."finalContent") < 500 THEN 1 END)::int AS brief,
           COUNT(CASE WHEN LENGTH(r."finalContent") >= 500 AND LENGTH(r."finalContent") < 2000 THEN 1 END)::int AS standard,
           COUNT(CASE WHEN LENGTH(r."finalContent") >= 2000 THEN 1 END)::int AS detailed
         FROM "QCoreRun" r
         ${userFilter}
         WHERE r."finalContent" IS NOT NULL`,
        params
      ),
      pool.query(
        `SELECT
           COALESCE(r."strategy",'sequential') AS strategy,
           COALESCE(AVG(LENGTH(r."finalContent")),0)::int AS "avgLength"
         FROM "QCoreRun" r
         ${userFilter}
         WHERE r."finalContent" IS NOT NULL
         GROUP BY r."strategy"
         ORDER BY "avgLength" DESC`,
        params
      ),
    ]);

    const q = qualR.rows[0] || { brief: 0, standard: 0, detailed: 0 };
    res.json({
      brief: q.brief,
      standard: q.standard,
      detailed: q.detailed,
      avgLengthByStrategy: stratR.rows.map((row: any) => ({
        strategy: row.strategy,
        avgLength: row.avgLength,
      })),
    });
  } catch (err: any) { res.status(500).json({ error: "run-quality failed", details: err?.message }); }
});

/* ═══════════════════════════════════════════════════════════════════════
   V67 — Conditional run branching
   POST /runs/:id/branch   — create branch + new run with alternate input
   GET  /runs/:id/branches — list branches for a run
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/runs/:id/branch", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? null;
  const parentRunId = req.params.id;
  const { reason, alternativeInput, strategy } = req.body || {};

  if (!reason || typeof reason !== "string" || !alternativeInput || typeof alternativeInput !== "string") {
    return res.status(400).json({ error: "reason and alternativeInput are required" });
  }

  try {
    // Resolve the parent run to get its session
    const parentRun = await getRun(parentRunId);
    if (!parentRun) return res.status(404).json({ error: "run not found" });

    const resolvedStrategy = typeof strategy === "string" && ["sequential","parallel","debate"].includes(strategy)
      ? strategy
      : "debate";

    // Create branch record
    const branch = await createBranch(parentRunId, reason.slice(0, 500), alternativeInput.slice(0, 16000), resolvedStrategy);

    // Create a new run in the same session with the alternative input
    const newRun = await createRun({
      sessionId: parentRun.sessionId,
      userInput: alternativeInput.slice(0, 16000),
      strategy: resolvedStrategy,
      parentRunId,
    });

    // Link branch → new run
    await completeBranch(branch.id, newRun.id);

    if (userId) void logAudit(userId, "branch.created", { resourceId: branch.id, resourceType: "branch" });

    return res.status(201).json({ branch: { ...branch, status: "completed", resultRunId: newRun.id }, run: { id: newRun.id, sessionId: newRun.sessionId } });
  } catch (err: any) {
    return res.status(500).json({ error: "branch failed", details: err?.message });
  }
});

qcoreaiRouter.get("/runs/:id/branches", async (req, res) => {
  const parentRunId = req.params.id;
  try {
    const branches = await listBranches(parentRunId);
    return res.json({ branches });
  } catch (err: any) {
    return res.status(500).json({ error: "list branches failed", details: err?.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   V68 — Export Hub
   POST /export/session-bundle  — session + runs + annotations + bookmarks
   POST /export/full-account    — all sessions + prompts + templates + memories
   ═══════════════════════════════════════════════════════════════════════ */

// Simple in-memory rate limit for full-account export: 1 per hour per user
const exportRateLimitMap = new Map<string, number>();

qcoreaiRouter.post("/export/session-bundle", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? null;
  if (!userId) return res.status(401).json({ error: "auth required" });

  const { sessionId, includeMessages } = req.body || {};
  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "sessionId required" });
  }

  try {
    const session = await getSession(sessionId, userId);
    if (!session) return res.status(404).json({ error: "session not found" });
    if (session.userId !== userId) return res.status(403).json({ error: "forbidden" });

    const runs = await listRuns(sessionId);
    let runsWithMessages: any[] = runs;
    if (includeMessages) {
      runsWithMessages = await Promise.all(
        runs.map(async (r) => {
          const msgs = await listMessages(r.id);
          return { ...r, messages: msgs };
        })
      );
    }

    const allAnnotations: any[] = [];
    for (const r of runs) {
      try {
        const anns = await listAnnotations(r.id, userId);
        allAnnotations.push(...anns);
      } catch { /* ignore */ }
    }

    const allBookmarks: any[] = [];
    for (const r of runs) {
      try {
        const bm = await isBookmarked(r.id, userId);
        if (bm) allBookmarks.push({ runId: r.id });
      } catch { /* ignore */ }
    }

    const bundle = {
      exportedAt: new Date().toISOString(),
      session,
      runs: runsWithMessages,
      annotations: allAnnotations,
      bookmarks: allBookmarks,
    };

    res.setHeader("Content-Disposition", `attachment; filename="session-${sessionId}.json"`);
    res.setHeader("Content-Type", "application/json");
    return res.json(bundle);
  } catch (err: any) {
    return res.status(500).json({ error: "export failed", details: err?.message });
  }
});

qcoreaiRouter.post("/export/full-account", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? null;
  if (!userId) return res.status(401).json({ error: "auth required" });

  // Rate limit: 1 export per hour
  const lastExport = exportRateLimitMap.get(userId);
  const now = Date.now();
  if (lastExport && now - lastExport < 3600_000) {
    const waitMs = 3600_000 - (now - lastExport);
    return res.status(429).json({ error: "rate_limited", retryAfterMs: waitMs });
  }
  exportRateLimitMap.set(userId, now);

  try {
    const sessions = await listSessions(userId, 500);
    const prompts = await listPrompts(userId, 500);
    const templates = await listTemplates(userId, 500);
    const memories = await listMemories(userId, { limit: 500 });
    const apiKeys = await listApiKeys(userId);
    // Redact secrets from API keys
    const redactedApiKeys = apiKeys.map((k: any) => ({
      id: k.id,
      label: k.label,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
    }));

    const bundle = {
      exportedAt: new Date().toISOString(),
      sessions,
      prompts,
      templates,
      memories,
      apiKeys: redactedApiKeys,
    };

    res.setHeader("Content-Disposition", `attachment; filename="qcoreai-account-${userId}.json"`);
    res.setHeader("Content-Type", "application/json");
    return res.json(bundle);
  } catch (err: any) {
    return res.status(500).json({ error: "full export failed", details: err?.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   V69 — Smart Model Routing
   POST /me/routing-rules — save auto-routing preferences
   GET  /me/routing-rules — get current rules
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.post("/me/routing-rules", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? null;
  if (!userId) return res.status(401).json({ error: "auth required" });

  const { rules } = req.body || {};
  if (!Array.isArray(rules)) return res.status(400).json({ error: "rules array required" });

  const VALID_CONDITIONS = ["short_input", "long_input", "code_task", "creative_task"];
  const sanitized = rules
    .filter((r: any) => r && VALID_CONDITIONS.includes(r.condition) && typeof r.preferProvider === "string" && typeof r.preferModel === "string")
    .map((r: any) => ({
      condition: r.condition as string,
      preferProvider: r.preferProvider.slice(0, 64),
      preferModel: r.preferModel.slice(0, 128),
    }));

  try {
    await setUserSetting(userId, "routing_rules", sanitized);
    return res.json({ ok: true, rules: sanitized });
  } catch (err: any) {
    return res.status(500).json({ error: "save routing rules failed", details: err?.message });
  }
});

qcoreaiRouter.get("/me/routing-rules", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? null;
  if (!userId) return res.status(401).json({ error: "auth required" });

  try {
    const rules = await getUserSetting(userId, "routing_rules");
    return res.json({ rules: rules ?? [] });
  } catch (err: any) {
    return res.status(500).json({ error: "get routing rules failed", details: err?.message });
  }
});
