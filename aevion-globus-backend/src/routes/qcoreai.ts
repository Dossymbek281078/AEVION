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
  createEvalRun,
  createEvalSuite,
  createPrompt,
  createRun,
  createSharedPreset,
  deleteEvalSuite,
  deletePrompt,
  deleteSession,
  deleteSharedPreset,
  ensureSession,
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
  getTopUserTags,
  importSharedPreset,
  insertMessage,
  listEvalSuites,
  listMessages,
  listPrompts,
  listPublicPrompts,
  listPublicSharedPresets,
  listRuns,
  listSessions,
  listSuiteRuns,
  addSessionToWorkspace,
  addWorkspaceMember,
  createComment,
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  listComments,
  listMyWorkspaces,
  listPromptAudit,
  listWorkspaceMembers,
  listWorkspaceSessions,
  logPromptAudit,
  pinSession,
  removeSessionFromWorkspace,
  removeWorkspaceMember,
  updateWorkspace,
  renameSession,
  renameSessionIfDefault,
  searchRuns,
  setRunTags,
  shareRun,
  touchSession,
  unshareRun,
  updateEvalSuite,
  updatePrompt,
} from "../services/qcoreai/store";
import { runEvalSuite } from "../services/qcoreai/evalRunner";
import { getGuidanceBus } from "../services/qcoreai/guidanceBus";

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
  let guidanceBusKind = "memory";
  let liveRuns = 0;
  try {
    const bus = await getGuidanceBus();
    guidanceBusKind = bus.kind;
    liveRuns = bus.liveRuns().length;
  } catch { /* tolerable */ }
  res.json({
    service: "qcoreai",
    ok: true,
    configuredProviders: configured.map((p) => p.id),
    totalProviders: providers.length,
    activeProvider: resolveProvider(),
    storage: isDbReady() ? "postgres" : "in-memory",
    storageError: isDbReady() ? null : getDbError(),
    webhookConfigured: isWebhookConfigured(),
    guidanceBus: guidanceBusKind,
    liveRuns,
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
    return res.status(500).json({ error: "lookup failed", details: err?.message });
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
    return res.status(500).json({ error: "save failed", details: err?.message });
  }
});

qcoreaiRouter.delete("/me/webhook", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth required" });
  try {
    const removed = await deleteUserWebhook(auth.sub);
    return res.json({ ok: removed });
  } catch (err: any) {
    return res.status(500).json({ error: "delete failed", details: err?.message });
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
    const hasTitle = typeof req.body?.title === "string";
    const hasPinned = typeof req.body?.pinned === "boolean";
    if (!hasTitle && !hasPinned) return res.status(400).json({ error: "title or pinned required" });

    let updated = null;
    if (hasPinned) {
      updated = await pinSession(req.params.id, auth?.sub ?? null, req.body.pinned as boolean);
    }
    if (hasTitle) {
      if (!req.body.title.trim()) return res.status(400).json({ error: "title required" });
      updated = await renameSession(req.params.id, auth?.sub ?? null, req.body.title);
    }
    if (!updated) return res.status(404).json({ error: "session not found" });
    res.json({ session: updated });
  } catch (err: any) {
    res.status(500).json({ error: "patch session failed", details: err?.message });
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
    res.status(500).json({ error: "search failed", details: err?.message });
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
    res.status(500).json({ error: "list tags failed", details: err?.message });
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
    res.status(500).json({ error: "set tags failed", details: err?.message });
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
    res.status(500).json({ error: "share preset failed", details: err?.message });
  }
});

qcoreaiRouter.get("/presets/public", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim().slice(0, 80);
    const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit ?? "30"), 10) || 30));
    const items = await listPublicSharedPresets(q, limit);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "list public presets failed", details: err?.message });
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
    res.status(500).json({ error: "get preset failed", details: err?.message });
  }
});

qcoreaiRouter.post("/presets/:id/import", async (req, res) => {
  try {
    const p = await importSharedPreset(String(req.params.id));
    if (!p) return res.status(404).json({ error: "preset not found or not public" });
    res.json({ ok: true, preset: p });
  } catch (err: any) {
    res.status(500).json({ error: "import preset failed", details: err?.message });
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
    res.status(500).json({ error: "delete preset failed", details: err?.message });
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
    res.status(500).json({ error: "timeseries failed", details: err?.message });
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
    return res.status(500).json({ error: "guidance push failed", details: err?.message });
  }
});

/** Per-user sliding-window rate limit (authenticated users only). */
const userRunTimestamps = new Map<string, number[]>();
function checkUserRateLimit(userId: string, maxPerMinute = 30): boolean {
  const now = Date.now();
  const hits = (userRunTimestamps.get(userId) ?? []).filter((t) => now - t < 60_000);
  if (hits.length >= maxPerMinute) return false;
  hits.push(now);
  userRunTimestamps.set(userId, hits);
  return true;
}

qcoreaiRouter.post("/multi-agent", multiAgentLimiter, async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? null;

  if (userId && !checkUserRateLimit(userId)) {
    return res.status(429).json({ error: "Too many runs. Please wait before starting another." });
  }

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

  // Pre-fetch any QRight attachments the user wants the agents to reason
  // against. Pulled BEFORE the SSE stream opens so we can fail fast (bad
  // ID list) and so the Analyst sees them on its very first prompt.
  const requestedAttachmentIds = normalizeAttachmentIds(req.body?.qrightAttachmentIds);
  let attachments: Awaited<ReturnType<typeof fetchQRightAttachments>> = [];
  if (requestedAttachmentIds.length > 0) {
    try {
      attachments = await fetchQRightAttachments(requestedAttachmentIds);
    } catch (err: any) {
      return res.status(500).json({ error: "qright attachment fetch failed", details: err?.message });
    }
  }
  const augmentedUserInput = attachments.length
    ? `${renderAttachmentsContext(attachments)}\n\n[User question]\n${userInput}`
    : userInput;

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

  const history = await buildHistoryContext(sessionId, 6);

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
    res.status(500).json({ error: "create eval suite failed", details: err?.message });
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
    res.status(500).json({ error: "list eval suites failed", details: err?.message });
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
    res.status(500).json({ error: "get eval suite failed", details: err?.message });
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
    res.status(500).json({ error: "update eval suite failed", details: err?.message });
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
    res.status(500).json({ error: "delete eval suite failed", details: err?.message });
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
    res.status(500).json({ error: "start eval run failed", details: err?.message });
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
    res.status(500).json({ error: "get eval run failed", details: err?.message });
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
    res.status(500).json({ error: "list eval runs failed", details: err?.message });
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
    logPromptAudit(auth.sub, p.id, p.name, "create").catch(() => {});
    res.json({ ok: true, prompt: p });
  } catch (err: any) {
    res.status(500).json({ error: "create prompt failed", details: err?.message });
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
    res.status(500).json({ error: "list prompts failed", details: err?.message });
  }
});

qcoreaiRouter.get("/prompts/public", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim().slice(0, 80);
    const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit ?? "30"), 10) || 30));
    const items = await listPublicPrompts(q, limit);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "list public prompts failed", details: err?.message });
  }
});

qcoreaiRouter.get("/prompts/audit", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const limit = Math.max(1, Math.min(500, parseInt(String(req.query.limit ?? "100"), 10) || 100));
    const items = await listPromptAudit(auth.sub, limit);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "list audit failed", details: err?.message });
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
    res.status(500).json({ error: "get prompt failed", details: err?.message });
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
    res.status(500).json({ error: "version chain failed", details: err?.message });
  }
});

qcoreaiRouter.patch("/prompts/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { name, description, role, isPublic } = req.body || {};
    const changed = [name && "name", description !== undefined && "description", role && "role", isPublic !== undefined && "isPublic"].filter(Boolean).join(",");
    const p = await updatePrompt(String(req.params.id), auth.sub, {
      name,
      description,
      role,
      isPublic,
    });
    if (!p) return res.status(404).json({ error: "prompt not found or forbidden" });
    logPromptAudit(auth.sub, p.id, p.name, "update", changed || undefined).catch(() => {});
    res.json({ prompt: p });
  } catch (err: any) {
    res.status(500).json({ error: "update prompt failed", details: err?.message });
  }
});

qcoreaiRouter.delete("/prompts/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const toDelete = await getPrompt(String(req.params.id));
    const ok = await deletePrompt(String(req.params.id), auth.sub);
    if (!ok) return res.status(404).json({ error: "prompt not found or forbidden" });
    if (toDelete) logPromptAudit(auth.sub, toDelete.id, toDelete.name, "delete").catch(() => {});
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "delete prompt failed", details: err?.message });
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
    res.status(500).json({ error: "fork prompt failed", details: err?.message });
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
   Public run comments (no auth required to post)
   GET  /api/qcoreai/shared/:token/comments
   POST /api/qcoreai/shared/:token/comments
   ═══════════════════════════════════════════════════════════════════════ */

qcoreaiRouter.get("/shared/:token/comments", sharedLimiter, async (req, res) => {
  try {
    const run = await getRunByShareToken(String(req.params.token || ""));
    if (!run) return res.status(404).json({ error: "not found" });
    const items = await listComments(run.id);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "list comments failed", details: err?.message });
  }
});

qcoreaiRouter.post("/shared/:token/comments", sharedLimiter, async (req, res) => {
  try {
    const run = await getRunByShareToken(String(req.params.token || ""));
    if (!run) return res.status(404).json({ error: "not found" });
    const authorName = typeof req.body?.authorName === "string" ? req.body.authorName : "Anonymous";
    const content = typeof req.body?.content === "string" ? req.body.content : "";
    const comment = await createComment(run.id, authorName, content);
    res.status(201).json({ comment });
  } catch (err: any) {
    const msg = err?.message || "comment failed";
    res.status(msg.includes("required") ? 400 : 500).json({ error: msg });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Workspaces
   ═══════════════════════════════════════════════════════════════════════ */

const workspaceLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyPrefix: "qcore-workspace",
  message: "Too many workspace requests. Please slow down.",
});

qcoreaiRouter.post("/workspaces", workspaceLimiter, async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { name, description } = req.body || {};
    if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "name required" });
    const ws = await createWorkspace({ ownerId: auth.sub, name, description: typeof description === "string" ? description : null });
    res.status(201).json({ workspace: ws });
  } catch (err: any) {
    res.status(500).json({ error: "create workspace failed", details: err?.message });
  }
});

qcoreaiRouter.get("/workspaces", workspaceLimiter, async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const items = await listMyWorkspaces(auth.sub);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "list workspaces failed", details: err?.message });
  }
});

qcoreaiRouter.patch("/workspaces/:id", workspaceLimiter, async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { name, description } = req.body || {};
    const ws = await getWorkspace(req.params.id, auth.sub);
    if (name === undefined && description === undefined) return res.status(400).json({ error: "name or description required" });
    const updated = await updateWorkspace(req.params.id, auth.sub, {
      name: typeof name === "string" ? name : undefined,
      description: description !== undefined ? (typeof description === "string" ? description : null) : undefined,
    });
    if (!updated) return res.status(404).json({ error: "workspace not found or forbidden" });
    res.json({ workspace: updated });
  } catch (err: any) {
    res.status(500).json({ error: "patch workspace failed", details: err?.message });
  }
});

qcoreaiRouter.get("/workspaces/:id", workspaceLimiter, async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const ws = await getWorkspace(String(req.params.id), auth.sub);
    if (!ws) return res.status(404).json({ error: "workspace not found" });
    const members = await listWorkspaceMembers(String(req.params.id), auth.sub);
    res.json({ workspace: ws, members });
  } catch (err: any) {
    res.status(500).json({ error: "get workspace failed", details: err?.message });
  }
});

qcoreaiRouter.delete("/workspaces/:id", workspaceLimiter, async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const ok = await deleteWorkspace(String(req.params.id), auth.sub);
    if (!ok) return res.status(404).json({ error: "workspace not found or forbidden" });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "delete workspace failed", details: err?.message });
  }
});

qcoreaiRouter.get("/workspaces/:id/members", workspaceLimiter, async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const items = await listWorkspaceMembers(String(req.params.id), auth.sub);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "list members failed", details: err?.message });
  }
});

qcoreaiRouter.post("/workspaces/:id/members", workspaceLimiter, async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { userId, role } = req.body || {};
    if (typeof userId !== "string" || !userId.trim()) return res.status(400).json({ error: "userId required" });
    const memberRole = role === "editor" ? "editor" : "viewer";
    const member = await addWorkspaceMember(String(req.params.id), userId.trim(), memberRole, auth.sub);
    if (!member) return res.status(403).json({ error: "forbidden — only the owner can invite members" });
    res.status(201).json({ member });
  } catch (err: any) {
    res.status(500).json({ error: "add member failed", details: err?.message });
  }
});

qcoreaiRouter.delete("/workspaces/:id/members/:userId", workspaceLimiter, async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const ok = await removeWorkspaceMember(String(req.params.id), String(req.params.userId), auth.sub);
    if (!ok) return res.status(404).json({ error: "member not found or forbidden" });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "remove member failed", details: err?.message });
  }
});

qcoreaiRouter.get("/workspaces/:id/sessions", workspaceLimiter, async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const items = await listWorkspaceSessions(String(req.params.id), auth.sub);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: "list workspace sessions failed", details: err?.message });
  }
});

qcoreaiRouter.post("/workspaces/:id/sessions", workspaceLimiter, async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { sessionId } = req.body || {};
    if (typeof sessionId !== "string" || !sessionId.trim()) return res.status(400).json({ error: "sessionId required" });
    const ok = await addSessionToWorkspace(String(req.params.id), sessionId.trim(), auth.sub);
    if (!ok) return res.status(403).json({ error: "forbidden or workspace not found" });
    res.status(201).json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "add session failed", details: err?.message });
  }
});

qcoreaiRouter.delete("/workspaces/:id/sessions/:sessionId", workspaceLimiter, async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const ok = await removeSessionFromWorkspace(String(req.params.id), String(req.params.sessionId), auth.sub);
    if (!ok) return res.status(404).json({ error: "session not in workspace or forbidden" });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "remove session failed", details: err?.message });
  }
});
