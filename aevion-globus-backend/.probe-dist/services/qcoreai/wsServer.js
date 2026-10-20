"use strict";
/**
 * QCoreAI WebSocket duplex transport (V4-W).
 *
 * Same orchestrator pipeline as POST /api/qcoreai/multi-agent (SSE), but
 * over WS so the client can `interject` mid-run guidance and receive
 * stream events on the SAME connection — no separate POST /guidance call,
 * no SSE-parsing in the SDK.
 *
 * Wire protocol (JSON over WS):
 *   client → server:
 *     { type: "start", input, strategy?, overrides?, maxRevisions?, sessionId?, maxCostUsd? }
 *     { type: "interject", text }
 *     { type: "stop" }
 *     { type: "ping" }
 *   server → client:
 *     { type: "ack", what, ...details }
 *     { type: "session", sessionId, runId }
 *     // ... all OrchestratorEvent payloads (same shape as SSE)
 *     { type: "guidance_applied", nextRole, nextStage, text }
 *     { type: "cost_cap_set", capUsd }
 *     { type: "cost_cap_hit", spentUsd, capUsd }
 *     { type: "run_complete", finalContent, status, totalDurationMs, totalCostUsd }
 *     { type: "error", message }
 *     { type: "pong" }
 *     { type: "ws_end", reason }
 *
 * Auth: optional `?token=<JWT>` query param. When set + valid, run is
 * owner-scoped (matches HTTP behaviour).
 *
 * Limits:
 *   - 30 upgrades / minute / IP (in-memory token bucket)
 *   - 64 KB max message size
 *   - 8 pending guidance entries × 4 KB
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachQCoreWebSocket = attachQCoreWebSocket;
const ws_1 = require("ws");
const url_1 = require("url");
const authJwt_1 = require("../../lib/authJwt");
const qcoreQuota_1 = require("../../lib/qcoreQuota");
const orchestrator_1 = require("./orchestrator");
const providers_1 = require("./providers");
const store_1 = require("./store");
const rateLimit_1 = require("../../lib/rateLimit");
const MAX_PAYLOAD_BYTES = 64 * 1024;
const GUIDANCE_QUEUE_MAX = 8;
const GUIDANCE_TEXT_MAX = 4000;
const UPGRADES_PER_MIN = 30;
const upgradeBuckets = new Map();
function rateLimitUpgrade(ip) {
    const now = Date.now();
    const bucket = upgradeBuckets.get(ip);
    if (!bucket || bucket.resetAt < now) {
        upgradeBuckets.set(ip, { count: 1, resetAt: now + 60000 });
        return true;
    }
    if (bucket.count >= UPGRADES_PER_MIN)
        return false;
    bucket.count += 1;
    return true;
}
function safeSend(ws, payload) {
    if (ws.readyState !== ws_1.WebSocket.OPEN)
        return;
    try {
        ws.send(JSON.stringify(payload));
    }
    catch { /* ignore */ }
}
function parseStrategy(s) {
    if (s === "parallel" || s === "debate")
        return s;
    return "sequential";
}
/**
 * Attach the QCoreAI WebSocket server to an existing http.Server at the
 * given path. Idempotent — calling twice on the same server adds two
 * listeners; the caller should call this exactly once after `app.listen()`.
 */
function attachQCoreWebSocket(server, path = "/api/qcoreai/ws") {
    const wss = new ws_1.WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD_BYTES });
    server.on("upgrade", (req, socket, head) => {
        try {
            const reqUrl = new url_1.URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
            if (reqUrl.pathname !== path)
                return; // not our ws — let other handlers (or default) deal with it.
            // Ключ ограничителя апгрейда: левый элемент заголовка пишет клиент.
            const ip = (0, rateLimit_1.clientIp)(req);
            if (!rateLimitUpgrade(ip)) {
                socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
                socket.destroy();
                return;
            }
            wss.handleUpgrade(req, socket, head, (ws) => {
                wss.emit("connection", ws, req, reqUrl);
            });
        }
        catch (err) {
            try {
                socket.destroy();
            }
            catch { /* ignore */ }
        }
    });
    wss.on("connection", (ws, req, reqUrl) => {
        const auth = (0, authJwt_1.verifyBearerToken)(reqUrl.searchParams.get("token"));
        const userId = auth?.sub ?? null;
        const premiumGate = (0, qcoreQuota_1.premiumQuotaGateForPayload)(auth);
        let runActive = false;
        let abortRequested = false;
        let activeRunId = null;
        const guidance = [];
        const onClose = () => {
            abortRequested = true;
            activeRunId = null;
        };
        ws.on("close", onClose);
        ws.on("message", async (raw) => {
            let msg;
            try {
                msg = JSON.parse(raw.toString("utf8"));
            }
            catch {
                safeSend(ws, { type: "error", message: "invalid JSON" });
                return;
            }
            if (msg.type === "ping") {
                safeSend(ws, { type: "pong", at: Date.now() });
                return;
            }
            if (msg.type === "stop") {
                abortRequested = true;
                safeSend(ws, { type: "ack", what: "stop" });
                return;
            }
            if (msg.type === "interject") {
                const text = (msg.text || "").trim().slice(0, GUIDANCE_TEXT_MAX);
                if (!text) {
                    safeSend(ws, { type: "error", message: "interject text required" });
                    return;
                }
                if (!runActive) {
                    safeSend(ws, { type: "error", message: "no active run" });
                    return;
                }
                if (guidance.length >= GUIDANCE_QUEUE_MAX) {
                    safeSend(ws, { type: "error", message: "guidance queue full" });
                    return;
                }
                guidance.push(text);
                safeSend(ws, { type: "ack", what: "interject", queued: guidance.length });
                return;
            }
            if (msg.type !== "start") {
                safeSend(ws, { type: "error", message: `unknown message type: ${msg.type}` });
                return;
            }
            // === START ===
            if (runActive) {
                safeSend(ws, { type: "error", message: "run already active on this connection" });
                return;
            }
            const userInput = typeof msg.input === "string" ? msg.input.trim().slice(0, 16000) : "";
            if (!userInput) {
                safeSend(ws, { type: "error", message: "input required" });
                return;
            }
            const providerId = (0, providers_1.resolveProvider)();
            if (providerId === "stub") {
                safeSend(ws, { type: "error", message: "no AI provider configured on the server" });
                return;
            }
            const strategy = parseStrategy(msg.strategy);
            const overrides = (msg.overrides && typeof msg.overrides === "object")
                ? msg.overrides
                : {};
            const maxRevisions = typeof msg.maxRevisions === "number" ? Math.max(0, Math.min(2, msg.maxRevisions)) : 0;
            const maxCostUsd = typeof msg.maxCostUsd === "number" && msg.maxCostUsd > 0 ? msg.maxCostUsd : undefined;
            runActive = true;
            try {
                const session = await (0, store_1.ensureSession)({ sessionId: msg.sessionId, userId, seedTitle: userInput });
                const run = await (0, store_1.createRun)({
                    sessionId: session.id,
                    userInput,
                    agentConfig: { strategy, overrides, maxRevisions },
                    strategy,
                });
                activeRunId = run.id;
                safeSend(ws, { type: "session", sessionId: session.id, runId: run.id });
                await (0, store_1.insertMessage)({
                    runId: run.id,
                    role: "user",
                    content: userInput,
                    ordering: 0,
                });
                if (maxCostUsd != null) {
                    safeSend(ws, { type: "cost_cap_set", capUsd: maxCostUsd });
                }
                const history = await (0, store_1.buildHistoryContext)(session.id, 6);
                let ordering = 2;
                let finalContent = null;
                let lastAgentContent = null;
                let totalCost = 0;
                const runStart = Date.now();
                // Persisted finishRun statuses are limited to done|stopped|error.
                let status = "done";
                let budgetCapped = false;
                try {
                    for await (const evt of (0, orchestrator_1.runMultiAgent)({
                        userInput,
                        strategy,
                        overrides,
                        maxRevisions,
                        history,
                        guidanceProvider: () => {
                            if (guidance.length === 0)
                                return [];
                            const out = guidance.slice();
                            guidance.length = 0;
                            return out;
                        },
                        maxCostUsd,
                        premiumGate,
                    })) {
                        if (abortRequested) {
                            status = "stopped";
                            break;
                        }
                        safeSend(ws, evt);
                        if (evt.type === "agent_end") {
                            try {
                                lastAgentContent = evt.content || lastAgentContent;
                                if (typeof evt.costUsd === "number")
                                    totalCost += evt.costUsd;
                                await (0, store_1.insertMessage)({
                                    runId: run.id,
                                    role: evt.role,
                                    stage: evt.stage,
                                    instance: evt.instance,
                                    provider: undefined,
                                    model: undefined,
                                    content: evt.content,
                                    tokensIn: evt.tokensIn ?? null,
                                    tokensOut: evt.tokensOut ?? null,
                                    durationMs: evt.durationMs,
                                    costUsd: evt.costUsd ?? null,
                                    ordering: ordering++,
                                });
                            }
                            catch { /* persistence best-effort */ }
                        }
                        if (evt.type === "final") {
                            finalContent = evt.content || finalContent;
                        }
                        if (evt.type === "budget_exceeded") {
                            budgetCapped = true;
                        }
                        if (evt.type === "error") {
                            status = "error";
                            break;
                        }
                        if (evt.type === "done") {
                            break;
                        }
                    }
                }
                catch (err) {
                    status = "error";
                    safeSend(ws, { type: "error", message: err?.message || "orchestrator failed" });
                }
                const totalDurationMs = Date.now() - runStart;
                try {
                    await (0, store_1.finishRun)(run.id, status, {
                        finalContent: finalContent ?? lastAgentContent ?? null,
                        totalDurationMs,
                        totalCostUsd: totalCost,
                    });
                    await (0, store_1.renameSessionIfDefault)(session.id, userInput);
                    await (0, store_1.touchSession)(session.id);
                }
                catch { /* persistence best-effort */ }
                runActive = false;
                activeRunId = null;
                const reason = budgetCapped ? "budget_capped" : status;
                safeSend(ws, { type: "ws_end", reason });
                try {
                    ws.close(1000, reason);
                }
                catch { /* ignore */ }
            }
            catch (err) {
                runActive = false;
                activeRunId = null;
                safeSend(ws, { type: "error", message: err?.message || "start failed" });
                try {
                    ws.close(1011, "start failed");
                }
                catch { /* ignore */ }
            }
        });
    });
    return wss;
}
