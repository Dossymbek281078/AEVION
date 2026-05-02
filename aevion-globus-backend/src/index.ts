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
import { authOauthRouter } from "./routes/authOauth";
import { planetComplianceRouter } from "./routes/planetCompliance";
import { modulesRouter } from "./routes/modules";
import { awardsRouter } from "./routes/awards";
import { qcoreaiRouter } from "./routes/qcoreai";
import { attachQCoreWebSocket } from "./services/qcoreai/wsServer";
import { quantumShieldRouter } from "./routes/quantum-shield";
import { pipelineRouter } from "./routes/pipeline";
import { bureauRouter } from "./routes/bureau";
import { coachRouter } from "./routes/coach";
import { pricingRouter } from "./routes/pricing";
import { checkoutRouter } from "./routes/checkout";
import { eventsRouter } from "./routes/events";
import { projects } from "./data/projects";
import { enrichProject, enrichProjects } from "./data/moduleRuntime";
import { multichatRouter } from "./routes/multichat";
import { aevRouter } from "./routes/aev";
import { ecosystemRouter } from "./routes/ecosystem";
import { cyberchessRouter } from "./routes/cyberchess";
import { buildRouter } from "./routes/build";
import { aevionHubRouter } from "./routes/aevion-hub";
import { qrightRoyaltiesRouter } from "./routes/qrightRoyalties";
import { planetPayoutsRouter } from "./routes/planetPayouts";
import { bankTestRouter } from "./routes/bankTest";
import { metricsRouter } from "./routes/metrics";
import { isSentryEnabled, captureException } from "./lib/sentry";

// Подключаем ТОЛЬКО QRight (он реально существует)
// (qrightRouter already imported above)

// Optional Sentry. No-op when SENTRY_DSN is unset OR @sentry/node missing.
initSentry();

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors());
// 10mb to accommodate base64-encoded resume scans posted to /api/build/ai/parse-resume.
// Plain JSON payloads everywhere else stay tiny — limit is just a ceiling.
app.use(express.json({ limit: "10mb" }));

// Health-check. Both /health (legacy) and /api/health (the path the
// frontend + diagnostics page have always probed against) return the
// same shape so existing callers don't break.
function healthPayload() {
  return {
    status: "ok",
    service: "AEVION Globus Backend",
    timestamp: new Date().toISOString(),
  };
}
app.get("/health", (_req, res) => res.json(healthPayload()));
app.get("/api/health", (_req, res) => res.json(healthPayload()));

// Deep health: aggregates ops-relevant counts so /bank/diagnostics +
// oncall don't have to compose multiple endpoints. No auth — counts
// only, no per-user data. If you need access control, gate via your
// load balancer or use METRICS_TOKEN on /api/metrics for richer detail.
const STARTED_AT = Date.now();
app.get("/api/health/deep", async (_req, res) => {
  // Lazy imports so this module's load order doesn't fight with
  // ecosystem persistence. Errors are caught and surfaced.
  try {
    const { getQtradeMetrics } = await import("./routes/qtrade");
    const { getEcosystemMetrics, ensureEcosystemLoaded } = await import("./routes/ecosystem");
    await ensureEcosystemLoaded();
    const q = getQtradeMetrics();
    const e = getEcosystemMetrics();
    const mem = process.memoryUsage();
    res.json({
      status: "ok",
      service: "AEVION Globus Backend",
      timestamp: new Date().toISOString(),
      uptimeSec: Math.floor((Date.now() - STARTED_AT) / 1000),
      sentry: isSentryEnabled(),
      ledger: {
        accounts: q.accounts,
        transfers: q.transfers,
        operations: q.operations,
        idempotencyCacheSize: q.idemCache,
        royaltyEvents: e.royaltyEvents,
        chessPrizes: e.chessPrizes,
        planetCerts: e.planetCerts,
        backend: e.backend,
      },
      memory: {
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        rssMb: Math.round(mem.rss / 1024 / 1024),
      },
      env: {
        nodeEnv: process.env.NODE_ENV || "development",
        bankDailyTopupCap: Number(process.env.BANK_DAILY_TOPUP_CAP || 5000),
        bankDailyTransferCap: Number(process.env.BANK_DAILY_TRANSFER_CAP || 2000),
        corsRestricted: !!process.env.CORS_ALLOWED_ORIGINS,
        metricsTokenSet: !!process.env.METRICS_TOKEN,
      },
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err instanceof Error ? err.message : "deep health failed",
    });
  }
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
app.use("/api/multichat", multichatRouter);

/** OpenAPI 3.1 spec — full schemas + examples for bank-track routes,
 *  summary-only for legacy globus / qsign. See lib/openapiSpec.ts. */
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
      "/api/pricing": { get: { summary: "Full pricing payload (tiers + modules + bundles)" } },
      "/api/pricing/tiers": { get: { summary: "List pricing tiers" } },
      "/api/pricing/tiers/{id}": { get: { summary: "Single tier detail" } },
      "/api/pricing/modules": { get: { summary: "Per-module add-on prices" } },
      "/api/pricing/modules/{id}": { get: { summary: "Single module pricing" } },
      "/api/pricing/bundles": { get: { summary: "Bundled module suites" } },
      "/api/pricing/quote": {
        post: { summary: "Build a price quote: tier + modules + seats + period" },
      },
      "/api/pricing/lead": {
        post: { summary: "Submit a sales lead (Enterprise / industry contact form)" },
      },
      "/api/pricing/leads/count": {
        get: { summary: "Total leads count (no content exposed)" },
      },
      "/api/pricing/checkout/session": {
        post: { summary: "Create Stripe Checkout session (or stub if no STRIPE_SECRET_KEY)" },
      },
      "/api/pricing/checkout/webhook": {
        post: { summary: "Stripe webhook receiver (verifies stripe-signature in real mode)" },
      },
      "/api/pricing/checkout/healthz": {
        get: { summary: "Checkout mode probe: real/stub + webhook readiness" },
      },
      "/api/pricing/events": {
        post: { summary: "Ingest analytics event (page_view, cta_click, etc)" },
      },
      "/api/pricing/events/summary": {
        get: { summary: "Aggregated metrics — admin token required" },
      },
      "/api/pricing/events/recent": {
        get: { summary: "Last N events — admin token required" },
      },
      "/api/pricing/leads": {
        get: { summary: "List recent leads — admin token required" },
      },
      "/api/pricing/promo": {
        get: { summary: "Public list of active promo codes" },
      },
      "/api/pricing/promo/validate": {
        post: { summary: "Validate a promo code against a tier (no charge)" },
      },
      "/api/pricing/testimonials": {
        get: { summary: "Public customer testimonials (filterable)" },
      },
      "/api/pricing/trust": {
        get: { summary: "Trust signals: numbers + compliance badges" },
      },
      "/api/pricing/newsletter": {
        post: { summary: "Newsletter signup (email only)" },
      },
      "/api/pricing/newsletter/count": {
        get: { summary: "Total newsletter subscribers count" },
      },
      "/api/pricing/checkout/subscriptions/count": {
        get: { summary: "Total provisioned subscriptions count" },
      },
      "/api/pricing/roadmap": {
        get: { summary: "Public roadmap for all 27 modules with phases and progress" },
      },
    },
  });
});

// ==========================
// QRight — патентирование
// ==========================
app.use("/api/qtrade", qtradeRouter);
app.use("/api/aev", aevRouter);
app.use("/api/qright", qrightRouter);
app.use("/api/qright", qrightRoyaltiesRouter);
app.use("/api/ecosystem", ecosystemRouter);
app.use("/api/cyberchess", cyberchessRouter);

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
app.use("/api/build", buildRouter);
app.use("/api/coach", coachRouter);

// ==========================
// Pricing / GTM
// ==========================
app.use("/api/pricing", pricingRouter);
app.use("/api/pricing/checkout", checkoutRouter);
app.use("/api/pricing/events", eventsRouter);
// ==========================
// Auth
// ==========================
app.use("/api/auth", authRouter);
app.use("/api/auth/oauth", authOauthRouter);

// ==========================
// Planet / Compliance / Evidence / Certificate
// ==========================
app.use("/api/planet", planetComplianceRouter);
app.use("/api/planet", planetPayoutsRouter);
app.use("/api/awards", awardsRouter);

// ==========================
// AEVION Hub — composite cross-product health + OpenAPI index
// ==========================
app.use("/api/aevion", aevionHubRouter);

// Internal: synthetic webhook dispatcher used by /bank/diagnostics.
app.use("/api/bank", bankTestRouter);

// Prometheus metrics. Public unless METRICS_TOKEN is set in env.
app.use("/api/metrics", metricsRouter);

app.use(
  (
    err: unknown,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("[express]", err);
    captureException(err, {
      url: req.originalUrl ?? req.url,
      method: req.method,
      ip: req.ip,
    });
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
