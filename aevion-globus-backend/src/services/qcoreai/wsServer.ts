/**
 * QCoreAI WebSocket transport — duplex / human-in-the-loop.
 *
 * Mirrors the SSE pipeline but adds a client→server channel for mid-run
 * guidance injection. Polled BETWEEN stages by the orchestrator (see
 * `OrchestratorInput.drainPendingGuidance`), so the model never sees the
 * guidance mid-token; it lands at the next stage's prompt boundary.
 *
 * Wire protocol (JSON over WS):
 *   client → server (first message ONLY):
 *     {
 *       type: "start",
 *       input: string,
 *       sessionId?: string,
 *       strategy?: "sequential"|"parallel"|"debate",
 *       maxRevisions?: 0|1|2,
 *       overrides?: { analyst?, writer?, writerB?, critic? },
 *       costCapUsd?: number,
 *       useQRightContext?: boolean,
 *       authBearer?: string  // optional, mirrors HTTP Authorization
 *     }
 *
 *   client → server (any time after "session" event):
 *     { type: "interject", text: string }   // queued for the NEXT stage boundary
 *     { type: "stop" }                      // close the run early
 *     { type: "ping" }                      // optional keepalive ack
 *
 *   server → client: every event the SSE route emits (session, plan, agent_*,
 *     chunk, verdict, final, cost_cap_hit, tool_context, guidance_applied,
 *     done, sse_end, error) plus { type: "pong" } and { type: "ack",
 *     for: "interject"|"stop", queued?: number }.
 */

import type { IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";

import { verifyBearerToken } from "../../lib/authJwt";
import { AgentOverride } from "./agents";
import {
  runMultiAgent,
  OrchestratorEvent,
  PipelineStrategy,
} from "./orchestrator";
import { costUsd } from "./pricing";
import { fetchQRightContext } from "./qrightContext";
import {
  buildHistoryContext,
  createRun,
  ensureSession,
  finishRun,
  getUserWebhookForRun,
  insertMessage,
  renameSessionIfDefault,
  touchSession,
} from "./store";
import { isWebhookConfigured, notifyRunCompleted } from "../../lib/qcoreWebhook";

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

function parseEnvCap(): number | null {
  const raw = process.env.QCORE_HARD_CAP_USD;
  if (!raw) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function safeSend(ws: WebSocket, data: any): void {
  if (ws.readyState !== ws.OPEN) return;
  try {
    ws.send(JSON.stringify(data));
  } catch {
    /* socket likely closing */
  }
}

/** Very simple per-IP token bucket for WS upgrades. Mirrors the HTTP limiter. */
const wsBuckets = new Map<string, { count: number; resetAt: number }>();
const WS_WINDOW_MS = 60_000;
const WS_MAX = 30; // upgrades per minute per IP

function ipFromReq(req: IncomingMessage): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

function checkUpgradeRate(ip: string): boolean {
  const now = Date.now();
  const b = wsBuckets.get(ip);
  if (!b || b.resetAt < now) {
    wsBuckets.set(ip, { count: 1, resetAt: now + WS_WINDOW_MS });
    return true;
  }
  if (b.count >= WS_MAX) return false;
  b.count++;
  return true;
}

async function handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
  // Pull bearer from Sec-WebSocket-Protocol or query (?token=...) — browsers
  // can't set Authorization headers on WS. We accept either.
  let auth: { sub: string; email: string } | null = null;
  try {
    const url = new URL(req.url || "/", "http://localhost");
    const queryToken = url.searchParams.get("token");
    if (queryToken) {
      auth = verifyBearerToken(queryToken);
    }
  } catch { /* ignore */ }

  let started = false;
  let aborted = false;
  let capped = false;

  // Guidance queue — drain-on-poll semantics. We collect everything the user
  // sends, then squash to a single newline-joined string when the orchestrator
  // asks for it. Cleared on each drain.
  const guidanceQueue: string[] = [];
  const drainGuidance = (): string | null => {
    if (guidanceQueue.length === 0) return null;
    const text = guidanceQueue.join("\n\n").trim();
    guidanceQueue.length = 0;
    return text || null;
  };

  ws.on("close", () => {
    aborted = true;
  });
  ws.on("error", () => {
    aborted = true;
  });

  ws.on("message", async (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      safeSend(ws, { type: "error", message: "invalid JSON" });
      return;
    }

    if (msg?.type === "ping") {
      safeSend(ws, { type: "pong" });
      return;
    }

    if (msg?.type === "interject") {
      if (typeof msg.text !== "string" || !msg.text.trim()) {
        safeSend(ws, { type: "error", message: "interject.text required" });
        return;
      }
      // Cap the queue depth so a runaway client can't OOM us.
      if (guidanceQueue.length >= 8) {
        safeSend(ws, { type: "error", message: "guidance queue full (8 pending)" });
        return;
      }
      guidanceQueue.push(msg.text.slice(0, 4000));
      safeSend(ws, { type: "ack", for: "interject", queued: guidanceQueue.length });
      return;
    }

    if (msg?.type === "stop") {
      aborted = true;
      safeSend(ws, { type: "ack", for: "stop" });
      try { ws.close(1000, "client_stop"); } catch { /* noop */ }
      return;
    }

    if (msg?.type !== "start") {
      safeSend(ws, { type: "error", message: "unknown message type" });
      return;
    }

    if (started) {
      safeSend(ws, { type: "error", message: "already started" });
      return;
    }
    started = true;

    // Allow auth via start message too (for clients that prefer body to query).
    if (!auth && typeof msg.authBearer === "string" && msg.authBearer) {
      try { auth = verifyBearerToken(msg.authBearer); } catch { /* ignore */ }
    }
    const userId = auth?.sub ?? null;

    const userInput =
      typeof msg.input === "string" ? msg.input.trim().slice(0, 16000) : "";
    if (!userInput) {
      safeSend(ws, { type: "error", message: "input required" });
      try { ws.close(1003, "bad input"); } catch { /* noop */ }
      return;
    }

    const strategy: PipelineStrategy =
      msg.strategy === "parallel" ? "parallel" :
      msg.strategy === "debate" ? "debate" :
      "sequential";

    const maxRevisions =
      typeof msg.maxRevisions === "number" ? Math.max(0, Math.min(2, msg.maxRevisions)) : 1;

    const overrides = {
      analyst: parseAgentOverride(msg.overrides?.analyst),
      writer: parseAgentOverride(msg.overrides?.writer),
      writerB: parseAgentOverride(msg.overrides?.writerB),
      critic: parseAgentOverride(msg.overrides?.critic),
    };

    const envCap = parseEnvCap();
    const requestedCap =
      typeof msg.costCapUsd === "number" && msg.costCapUsd > 0 ? msg.costCapUsd : null;
    const costCapUsd: number | null = requestedCap ?? envCap;

    let qrightContextBlock = "";
    if (msg.useQRightContext === true && auth?.sub) {
      qrightContextBlock = await fetchQRightContext(auth.sub, auth.email ?? null);
    }
    const orchestratorInput = qrightContextBlock
      ? `${qrightContextBlock}\n---\n\n## User question\n\n${userInput}`
      : userInput;

    let sessionId: string;
    let runId: string;
    try {
      const session = await ensureSession({
        sessionId: typeof msg.sessionId === "string" ? msg.sessionId : null,
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
      await insertMessage({ runId, role: "user", content: userInput, ordering: 0 });
    } catch (err: any) {
      safeSend(ws, { type: "error", message: `session init failed: ${err?.message || err}` });
      try { ws.close(1011, "init"); } catch { /* noop */ }
      return;
    }

    safeSend(ws, { type: "session", sessionId, runId });
    if (costCapUsd != null) safeSend(ws, { type: "cost_cap_set", costCapUsd });
    if (qrightContextBlock) {
      safeSend(ws, { type: "tool_context", source: "qright", chars: qrightContextBlock.length });
    }

    const history = await buildHistoryContext(sessionId, 6);

    const runStart = Date.now();
    let ordering = 1;
    const pendingByKey = new Map<string, { provider: string; model: string }>();
    const stageKey = (role: string, stage: string, instance?: string) =>
      `${role}|${stage}|${instance || ""}`;
    let finalContent: string | null = null;
    let hadError: string | null = null;
    let lastAgentContent: string | null = null;
    let totalCost = 0;

    try {
      for await (const evt of runMultiAgent({
        userInput: orchestratorInput,
        strategy,
        overrides,
        maxRevisions,
        history,
        drainPendingGuidance: drainGuidance,
      }) as AsyncGenerator<OrchestratorEvent>) {
        if (aborted) break;
        safeSend(ws, evt);

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
              safeSend(ws, {
                type: "cost_cap_hit",
                costCapUsd,
                totalCostUsd: totalCost,
                message: `Cost cap reached: $${totalCost.toFixed(4)} ≥ $${costCapUsd.toFixed(4)}.`,
              });
            }
            break;
          }
          case "final":
            finalContent = evt.content;
            await insertMessage({ runId, role: "final", content: evt.content, ordering: ordering++ });
            break;
          case "error":
            hadError = evt.message;
            break;
          case "guidance_applied":
            // Persist the user's guidance as a synthetic message so it shows
            // up in the run trace and exports.
            await insertMessage({
              runId,
              role: "user",
              stage: "guidance",
              content: `[mid-run guidance for ${evt.nextRole}/${evt.nextStage}]\n\n${evt.text}`,
              ordering: ordering++,
            });
            break;
          default:
            break;
        }
        if (capped) break;
      }
    } catch (err: any) {
      hadError = err?.message || "orchestrator crashed";
      safeSend(ws, { type: "error", message: hadError });
    }

    const totalDurationMs = Date.now() - runStart;

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
      console.error("[QCoreAI WS] finishRun error:", e?.message);
    }

    void (async () => {
      const extraTargets = [];
      try {
        const userHook = await getUserWebhookForRun(runId);
        if (userHook?.url) {
          extraTargets.push({ url: userHook.url, secret: userHook.secret, origin: "user" as const });
        }
      } catch { /* swallow */ }
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

    safeSend(ws, { type: "sse_end" });
    try { ws.close(1000, "done"); } catch { /* noop */ }
  });
}

/** Attach the QCoreAI WS handler to an existing HTTP server. */
export function attachQCoreWebSocket(server: any, path = "/api/qcoreai/ws"): WebSocketServer {
  const wss = new WebSocketServer({ server, path, maxPayload: 64 * 1024 });

  wss.on("connection", (ws, req) => {
    const ip = ipFromReq(req);
    if (!checkUpgradeRate(ip)) {
      safeSend(ws, {
        type: "error",
        message: "WS upgrade rate limit reached (30/min/IP). Retry shortly.",
      });
      try { ws.close(1008, "rate_limit"); } catch { /* noop */ }
      return;
    }
    handleConnection(ws, req).catch((e) => {
      console.error("[QCoreAI WS] connection error:", e?.message || e);
      try { ws.close(1011, "internal"); } catch { /* noop */ }
    });
  });

  console.log(`[QCoreAI WS] listening on ${path}`);
  return wss;
}
