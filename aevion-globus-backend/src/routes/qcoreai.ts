import { Router } from "express";

import { verifyBearerOptional } from "../lib/authJwt";
import {
  callProvider,
  getProviders,
  resolveProvider,
  sanitizeMessages,
} from "../services/qcoreai/providers";
import { AgentOverride } from "../services/qcoreai/agents";
import { runMultiAgent, OrchestratorEvent } from "../services/qcoreai/orchestrator";
import {
  buildHistoryContext,
  createRun,
  deleteSession,
  ensureSession,
  finishRun,
  getRun,
  getSession,
  insertMessage,
  listMessages,
  listRuns,
  listSessions,
  renameSessionIfDefault,
  touchSession,
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
   Providers + health
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

qcoreaiRouter.post("/multi-agent", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? null;

  const userInput = typeof req.body?.input === "string" ? req.body.input.trim().slice(0, 16000) : "";
  if (!userInput) {
    return res.status(400).json({ error: "input required" });
  }

  const strategy: "sequential" | "parallel" =
    req.body?.strategy === "parallel" ? "parallel" : "sequential";

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
    // Persist the user turn as message #0 immediately.
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

  // History context for follow-up turns in the same session.
  const history = await buildHistoryContext(sessionId, 6);

  const runStart = Date.now();
  let ordering = 1; // 0 is the user message
  /**
   * In parallel mode two agents stream concurrently, so we can't use a single
   * "currentStage" slot. Key pending starts by role+stage+instance so that
   * agent_end can look up the matching provider/model.
   */
  const pendingByKey = new Map<string, { provider: string; model: string }>();
  const stageKey = (role: string, stage: string, instance?: string) =>
    `${role}|${stage}|${instance || ""}`;
  let finalContent: string | null = null;
  let hadError: string | null = null;

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

  // Persist run finalization.
  try {
    if (hadError && !finalContent) {
      await finishRun(runId, "error", { error: hadError, finalContent: null, totalDurationMs });
    } else {
      await finishRun(runId, "done", { error: hadError, finalContent, totalDurationMs });
    }
    await renameSessionIfDefault(sessionId, userInput);
    await touchSession(sessionId);
  } catch (e: any) {
    console.error("[QCoreAI] finishRun error:", e?.message);
  }

  if (!aborted) {
    send({ type: "sse_end" });
    res.end();
  } else {
    try { res.end(); } catch { /* noop */ }
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   Role defaults (for UI to pre-populate config dropdowns)
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
  // For writerB, prefer a provider *different* from the primary writer if any exist.
  const primaryWriter = resolveDefault("anthropic", "claude-sonnet-4-20250514");
  let writerBDefault: { provider: string; model: string } | null = null;
  if (primaryWriter) {
    const other = providers.find((p) => p.configured && p.id !== primaryWriter.provider);
    if (other) {
      writerBDefault = { provider: other.id, model: other.defaultModel };
    } else {
      // Same provider, different model if any.
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
        description: "Analyst → Writer → Critic → (optional) Writer revision. Classic reflection loop.",
        agents: ["analyst", "writer", "critic"],
      },
      {
        id: "parallel",
        label: "Parallel drafts",
        description:
          "Analyst → two Writers stream in parallel on different models → Judge synthesizes the final. Diversity of voice.",
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
        label: "Writer",
        description: "Drafts the final answer following the Analyst's plan.",
        default: primaryWriter,
        temperature: 0.7,
      },
      {
        id: "writerB",
        label: "Writer B",
        description:
          "Parallel mode only: second Writer with a different model/voice (concise, bottom-line first).",
        default: writerBDefault,
        temperature: 0.7,
      },
      {
        id: "critic",
        label: "Critic / Judge",
        description:
          "Sequential: approves draft or requests revisions. Parallel: picks or merges the two drafts.",
        default: resolveDefault("anthropic", "claude-haiku-4-5-20251001"),
        temperature: 0.2,
      },
    ],
  });
});
