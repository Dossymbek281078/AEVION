import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import { qrightRouter } from "./routes/qright";
import { qsignRouter } from "./routes/qsign";
import { qsignV2Router } from "./routes/qsignV2";
import { startWebhookWorker } from "./lib/qsignV2/webhooks";
import { initSentry } from "./lib/qsignV2/sentry";
import { qtradeRouter } from "./routes/qtrade";
import { authRouter } from "./routes/auth";
import { planetComplianceRouter } from "./routes/planetCompliance";
import { modulesRouter } from "./routes/modules";
import { awardsRouter } from "./routes/awards";
import { qcoreaiRouter, startScheduler } from "./routes/qcoreai";
import { attachQCoreWebSocket } from "./services/qcoreai/wsServer";
import { quantumShieldRouter } from "./routes/quantum-shield";
import { pipelineRouter } from "./routes/pipeline";
import { bureauRouter } from "./routes/bureau";
import { coachRouter } from "./routes/coach";
import { aevRouter } from "./routes/aev";
import { aevionHubRouter } from "./routes/aevion-hub";
import { projects } from "./data/projects";
import { enrichProject, enrichProjects } from "./data/moduleRuntime";

// Подключаем ТОЛЬКО QRight (он реально существует)
// (qrightRouter already imported above)

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Health-check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "AEVION Globus Backend",
    timestamp: new Date().toISOString(),
  });
});

// Проверка соединения
app.get("/api/globus/ping", (_req, res) => {
  res.json({
    message: "AEVION Globus is online",
  });
});

// ==========================
// Globus Projects
// ==========================

app.get("/api/globus/projects", (_req, res) => {
  const items = enrichProjects(projects);
  res.json({
    items,
    total: items.length,
  });
});

app.get("/api/globus/projects/:id", (req, res) => {
  const project = projects.find((p) => p.id === req.params.id);

  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  res.json(enrichProject(project));
});

app.use("/api/modules", modulesRouter);

app.use("/api/qcoreai", qcoreaiRouter);

/** Минимальная машиночитаемая карта API для ускорения интеграций */
app.get("/api/openapi.json", (_req, res) => {
  res.json({
    openapi: "3.1.0",
    info: {
      title: "AEVION Globus Backend",
      version: "0.5.0",
    },
    paths: {
      "/health": { get: { summary: "Service health" } },
      "/api/globus/projects": { get: { summary: "All Globus projects + runtime" } },
      "/api/globus/projects/{id}": { get: { summary: "Single project + runtime" } },
      "/api/modules/status": { get: { summary: "Modules dashboard payload" } },
      "/api/modules/{id}/health": { get: { summary: "Per-module health stub" } },
      "/api/qright/objects": {
        get: { summary: "List QRight (optional ?mine=1 + Bearer)" },
        post: { summary: "Create QRight object" },
      },
      "/api/qright/objects/{id}": { get: { summary: "Get one QRight object (ETag/304)" } },
      "/api/qright/objects/{id}/stats": {
        get: { summary: "Owner-only fetch counter + revoke metadata (Bearer required)" },
      },
      "/api/qright/objects.csv": { get: { summary: "Download QRight registry as CSV" } },
      "/api/qright/objects/search": {
        get: { summary: "Search by title (ILIKE), optional ?kind, ?limit≤50" },
      },
      "/api/qright/embed/{id}": {
        get: { summary: "Public sanitized JSON for embeds (CORS, ETag/304)" },
      },
      "/api/qright/badge/{id}.svg": {
        get: { summary: "Embeddable SVG trust badge — ?theme=dark|light, red on revoke" },
      },
      "/api/qright/revoke/{id}": {
        post: { summary: "Revoke a QRight object (owner only, Bearer required)" },
      },
      "/api/qright/admin/objects": {
        get: { summary: "Admin: list all (filters: status, q, limit)" },
      },
      "/api/qright/admin/revoke/{id}": {
        post: { summary: "Admin: force-revoke any object regardless of ownership" },
      },
      "/api/qright/admin/whoami": {
        get: { summary: "Probe — returns isAdmin for the current Bearer" },
      },
      "/api/qright/transparency": {
        get: { summary: "Public aggregate counts (totals, by-reason-code, by-kind) — no PII" },
      },
      "/api/qsign/sign": { post: { summary: "[v1] Sign payload (HMAC, no persistence)" } },
      "/api/qsign/verify": { post: { summary: "[v1] Stateless verify" } },
      "/api/qsign/v2/health": { get: { summary: "[v2] QSign health + active kids" } },
      "/api/qsign/v2/stats": {
        get: {
          summary:
            "[v2] Public aggregate metrics (totals, last 24h, unique issuers, top countries, keys by status)",
        },
      },
      "/api/qsign/v2/recent": {
        get: {
          summary:
            "[v2] Sanitized recent signatures feed (id, kids, country, createdAt, revoked) · ?limit=1..20",
        },
      },
      "/api/qsign/v2/sign": {
        post: {
          summary: "[v2] Sign payload (HMAC+Ed25519, RFC 8785, persisted, Bearer required)",
        },
      },
      "/api/qsign/v2/verify": { post: { summary: "[v2] Stateless verify by canonical payload" } },
      "/api/qsign/v2/verify/{id}": { get: { summary: "[v2] Verify persisted signature by id" } },
      "/api/qsign/v2/{id}/public": { get: { summary: "[v2] Public shareable JSON view" } },
      "/api/qsign/v2/keys": { get: { summary: "[v2] Key registry (JWKS-like; no secret material)" } },
      "/api/qsign/v2/keys/{kid}": { get: { summary: "[v2] Single key detail by kid" } },
      "/api/qsign/v2/keys/rotate": {
        post: { summary: "[v2] Rotate active key for algo (admin only, overlap window)" },
      },
      "/api/qsign/v2/revoke/{id}": {
        post: { summary: "[v2] Revoke signature (issuer or admin, causal link optional)" },
      },
      "/api/auth/register": { post: {} },
      "/api/auth/login": { post: {} },
      "/api/auth/me": { get: {} },
      "/api/qcoreai/chat": { post: { summary: "Single-shot chat (one provider)" } },
      "/api/qcoreai/providers": { get: { summary: "List LLM providers + configured flag" } },
      "/api/qcoreai/health": { get: { summary: "QCoreAI config probe" } },
      "/api/qcoreai/agents": { get: { summary: "Multi-agent role defaults" } },
      "/api/qcoreai/multi-agent": {
        post: {
          summary: "Multi-agent pipeline (Analyst+Writer+Critic), SSE stream",
        },
      },
      "/api/qcoreai/sessions": {
        get: { summary: "List sessions (mine if Bearer, else anonymous)" },
      },
      "/api/qcoreai/sessions/{id}": {
        get: { summary: "Session + all runs" },
        delete: { summary: "Delete session and its runs" },
      },
      "/api/qcoreai/runs/{id}": {
        get: { summary: "Run + all agent messages in order" },
      },
      "/api/planet/stats": {
        get: {
          summary: "Planet public stats (participants Y, votes, optional productKeyPrefix scope)",
        },
      },
      "/api/planet/artifacts/recent": {
        get: {
          summary:
            "Recent certified artifact versions (optional productKeyPrefix, artifactType, limit 1..50, sort=created|rating|votes)",
        },
      },
      "/api/planet/artifacts/{artifactVersionId}/public": {
        get: { summary: "Public artifact + votes + voteStatsByCategory" },
      },
      "/api/qtrade/accounts": {
        get: { summary: "List accounts (persisted)" },
        post: { summary: "Create account" },
      },
      "/api/qtrade/accounts.csv": { get: { summary: "Download accounts snapshot as CSV" } },
      "/api/qtrade/transfers": { get: { summary: "Transfer history" } },
      "/api/qtrade/transfers.csv": { get: { summary: "Download transfer history as CSV" } },
      "/api/qtrade/operations": { get: { summary: "Operation history (topup + transfer)" } },
      "/api/qtrade/operations.csv": { get: { summary: "Download operation history as CSV" } },
      "/api/qtrade/summary": { get: { summary: "QTrade summary metrics" } },
      "/api/qtrade/topup": { post: { summary: "Top up balance" } },
      "/api/qtrade/transfer": { post: { summary: "P2P transfer" } },
      "/api/aev/wallet/{deviceId}": { get: { summary: "AEV wallet snapshot" } },
      "/api/aev/wallet/{deviceId}/sync": { post: { summary: "Idempotent wallet upsert (last-writer-wins on balance, max() on lifetime counters)" } },
      "/api/aev/wallet/{deviceId}/mint": { post: { summary: "Append mint entry, debit cap, credit balance + lifetimeMined" } },
      "/api/aev/wallet/{deviceId}/spend": { post: { summary: "Append spend entry, debit balance, credit lifetimeSpent" } },
      "/api/aev/ledger/{deviceId}": { get: { summary: "Append-only ledger tail (?limit=1..1000, default 100, newest first)" } },
      "/api/aev/stats": { get: { summary: "Global AEV aggregates (wallets, totalMined/Spent/Balance, capRemaining of 21M)" } },
    },
  });
});

// ==========================
// QRight — патентирование
// ==========================
app.use("/api/qtrade", qtradeRouter);
app.use("/api/aev", aevRouter);
app.use("/api/qright", qrightRouter);

// ==========================
// QSign — v1 (legacy) + v2 (RFC 8785, persisted, multi-algo)
// ==========================
app.use("/api/qsign/v2", qsignV2Router);
app.use("/api/qsign", qsignRouter);

// ==========================
// Quantum Shield
// ==========================
app.use("/api/quantum-shield", quantumShieldRouter);
app.use("/api/pipeline", pipelineRouter);
app.use("/api/bureau", bureauRouter);
app.use("/api/coach", coachRouter);
// ==========================
// Auth
// ==========================
app.use("/api/auth", authRouter);

// ==========================
// Planet / Compliance / Evidence / Certificate
// ==========================
app.use("/api/planet", planetComplianceRouter);
app.use("/api/awards", awardsRouter);

// ==========================
// AEVION Hub — composite cross-product health + OpenAPI index
// ==========================
app.use("/api/aevion", aevionHubRouter);

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("[express]", err);
    if (res.headersSent) return;
    res.status(500).json({ error: "internal_error" });
  },
);

// QSign v2 — Sentry init (no-op when SENTRY_DSN unset). Must run before
// the listener binds so any startup failures are captured too.
initSentry();

const httpServer = app.listen(PORT, () => {
  console.log(`AEVION Globus Backend запущен на порту ${PORT}`);
  // QSign v2 — DB-backed webhook delivery queue. Survives restarts.
  startWebhookWorker();
});

// QCoreAI duplex transport — same orchestrator as POST /multi-agent (SSE)
// but lets clients interject mid-run guidance on the same connection.
attachQCoreWebSocket(httpServer, "/api/qcoreai/ws");

// QCoreAI scheduler — polls for due scheduled batches every minute.
startScheduler();
