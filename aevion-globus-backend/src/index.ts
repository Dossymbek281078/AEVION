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
import { statusRouter } from "./routes/status";
import { awardsRouter } from "./routes/awards";
import { qcoreaiRouter, startScheduler } from "./routes/qcoreai";
import { attachQCoreWebSocket } from "./services/qcoreai/wsServer";
import { quantumShieldRouter } from "./routes/quantum-shield";
import { pipelineRouter } from "./routes/pipeline";
import { bureauRouter } from "./routes/bureau";
import { coachRouter } from "./routes/coach";
import { pricingRouter } from "./routes/pricing";
import { checkoutRouter } from "./routes/checkout";
import { healthaiRouter } from "./routes/healthai";
import { eventsRouter } from "./routes/events";
import { projects } from "./data/projects";
import { enrichProject, enrichProjects } from "./data/moduleRuntime";
import { multichatRouter, multichatPublicRouter } from "./routes/multichat";
import { aevRouter } from "./routes/aev";
import { ecosystemRouter } from "./routes/ecosystem";
import { cyberchessRouter } from "./routes/cyberchess";
import cyberchessTournamentsRouter from "./routes/cyberchessTournaments";
import cyberchessDailyRouter from "./routes/cyberchessDaily";
import cyberchessVoiceCoachRouter from "./routes/cyberchessVoiceCoach";
import cyberchessSpectatorRouter from "./routes/cyberchessSpectator";
import cyberchessMatchmakingRouter from "./routes/cyberchessMatchmaking";
import cyberchessAnticheatRouter from "./routes/cyberchessAnticheat";
import { puzzlesRouter } from "./routes/puzzles";
import { buildRouter } from "./routes/build";
import { aevionHubRouter } from "./routes/aevion-hub";
import { qrightRoyaltiesRouter } from "./routes/qrightRoyalties";
import { planetPayoutsRouter } from "./routes/planetPayouts";
import { bankTestRouter } from "./routes/bankTest";
import { metricsRouter } from "./routes/metrics";
import { smetaTrainerRouter } from "./routes/smeta-trainer";
import { qcontractRouter } from "./routes/qcontract";
import { qfusionaiRouter } from "./routes/qfusionai";
import { veilnetxRouter } from "./routes/veilnetx";
import { shadownetRouter } from "./routes/shadownet";
import { psyappDepsRouter } from "./routes/psyappDeps";
import { lifeboxRouter } from "./routes/lifebox";
import { createPlanningStubRouter, PLANNING_MODULES } from "./routes/planningStubs";
import { mountMvpConcepts } from "./routes/mvpConcepts";
import { qpaynetRouter, startQpaynetRetryWorker } from "./routes/qpaynet";
import { qtradeOfflineRouter } from "./routes/qtradeoffline";
import { apiQuotasRouter } from "./routes/apiQuotas";
import { apiKeysRouter } from "./routes/apiKeys";
import { qgoodRouter } from "./routes/qgood";
import { qmaskcardRouter } from "./routes/qmaskcard";
import { veilnetxLedgerRouter } from "./routes/veilnetxLedger";
import { ztideRouter } from "./routes/ztide";
import { qchaingovRouter } from "./routes/qchaingov";
import { FINTECH_OPENAPI_PATHS, FINTECH_OPENAPI_SCHEMAS, FINTECH_OPENAPI_TAGS } from "./lib/openapiFintechSpec";
import { NEW_WAVE_OPENAPI_PATHS, NEW_WAVE_OPENAPI_SCHEMAS, NEW_WAVE_OPENAPI_TAGS } from "./lib/openapiNewWaveSpec";
import { isSentryEnabled, captureException } from "./lib/sentry";
import { devhubRouter } from "./routes/devhub";
import { qmediaRouter } from "./routes/qmedia";
import { paymentsRouter } from "./routes/payments";
import { qaiRouter } from "./routes/qai";
import { qstoreRouter } from "./routes/qstore";
import { qlearnRouter } from "./routes/qlearn";
import { qsocialRouter } from "./routes/qsocial";
import { qnewsRouter } from "./routes/qnews";
import { qjobsRouter } from "./routes/qjobs";
import { mapRealityRouter } from "./routes/mapReality";
import { startupExchangeRouter } from "./routes/startupExchange";
import { kidsAiContentRouter } from "./routes/kidsAiContent";
import { voiceOfEarthRouter } from "./routes/voiceOfEarth";
import { qeventsRouter } from "./routes/qevents";
import { deepSanRouter } from "./routes/deepsan";
import { qpersonaRouter } from "./routes/qpersona";
import { qlifeRouter } from "./routes/qlife";
import { revenueRouter } from "./routes/revenue";
import { paddleRouter } from "./routes/paddle";
import { searchRouter } from "./routes/search";

// Подключаем ТОЛЬКО QRight (он реально существует)
// (qrightRouter already imported above)

// Optional Sentry. No-op when SENTRY_DSN is unset OR @sentry/node missing.
initSentry();

const app = express();
const PORT = process.env.PORT || 4001;

// Railway sits behind a reverse proxy — trust the first hop so that
// express-rate-limit reads the real client IP from X-Forwarded-For.
app.set("trust proxy", 1);

app.use(cors());
// 10mb to accommodate base64-encoded resume scans posted to /api/build/ai/parse-resume.
// Plain JSON payloads everywhere else stay tiny — limit is just a ceiling.
//
// `verify` stashes the raw bytes on req.rawBody for paths that need exact-byte
// signature verification (Stripe webhooks: /api/qpaynet/deposit/webhook,
// /api/checkout/webhook, etc.). All other handlers ignore rawBody.
app.use(express.json({
  limit: "10mb",
  verify: (req, _res, buf) => {
    (req as unknown as { rawBody?: Buffer }).rawBody = buf;
  },
}));

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
app.use("/api/status", statusRouter);

app.use("/api/qcoreai", qcoreaiRouter);
// Public share-link route mounted BEFORE the auth-gated multichat router so
// /api/multichat/shared/:token bypasses requireAuth.
app.use("/api/multichat", multichatPublicRouter);
app.use("/api/multichat", multichatRouter);

/** OpenAPI 3.1 spec — full schemas + examples for bank-track routes,
 *  summary-only for legacy globus / qsign. See lib/openapiSpec.ts. */
app.get("/api/openapi.json", (_req, res) => {
  res.json({
    openapi: "3.1.0",
    info: {
      title: "AEVION Globus Backend",
      version: "0.7.1",
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
        get: { summary: "Last N events — admin token required (CSV filters: source,type,tier,industry,sid)" },
      },
      "/api/pricing/events/aggregate": {
        get: { summary: "Time-bucketed counts (period=hour|day, groupBy=source|type|tier|industry) — admin token required" },
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
      "/api/pricing/provisioning/history": {
        get: { summary: "Subscription history by email (?email=...) — masked PII, capped at 100" },
      },
      "/api/pricing/provisioning/stats": {
        get: { summary: "Aggregate provisioning stats: total, byTier, last7d, trialsActive, recent" },
      },
      "/api/pricing/provisioning/healthz": {
        get: { summary: "Provisioning subsystem health: storage path, email mode" },
      },
      // Revenue Hub
      "/api/revenue/health": { get: { summary: "Revenue Hub health — Stripe/YouTube/Twitch config status" } },
      "/api/revenue/apps": { get: { summary: "List 12 AEVION apps with monetization channels" } },
      "/api/revenue/apps/{appId}": { get: { summary: "Single app revenue config + channel stubs" } },
      "/api/revenue/overview": { get: { summary: "Global monetization overview — channel coverage, app counts" } },
      "/api/revenue/stripe/balance": { get: { summary: "Stripe balance (KZT + USD)" } },
      "/api/revenue/stripe/recent": { get: { summary: "Recent Stripe payments grouped by AEVION app" } },
      "/api/revenue/youtube/{channelId}": { get: { summary: "YouTube AdSense stats for channel" } },
      "/api/revenue/twitch/{login}": { get: { summary: "Twitch affiliate stats for streamer" } },
      "/api/revenue/env-guide": { get: { summary: "Setup guide for Revenue Hub env vars" } },
      // QLearn — courses + quizzes + progress
      "/api/qlearn/health": { get: { summary: "QLearn health probe", security: [] } },
      "/api/qlearn/courses": {
        get: { summary: "List published courses (filter by category, level, lang)", security: [] },
      },
      "/api/qlearn/courses/{id}": {
        get: { summary: "Get single course with modules + quizzes", security: [] },
      },
      "/api/qlearn/progress": {
        get: { summary: "User course progress (Bearer required)" },
      },
      // QEvents — events platform
      "/api/qevents/health": { get: { summary: "QEvents health + service marker", security: [] } },
      "/api/qevents/events": {
        get: { summary: "List events (filter by category, when, location)", security: [] },
        post: { summary: "Create event (Bearer required)" },
      },
      "/api/qevents/events/{id}": {
        get: { summary: "Single event with attendee count", security: [] },
      },
      "/api/qevents/categories": {
        get: { summary: "List event categories", security: [] },
      },
      // QMedia — music + video + playlists
      "/api/qmedia/health": { get: { summary: "QMedia health + table count", security: [] } },
      "/api/qmedia/tracks": {
        get: { summary: "List music tracks", security: [] },
        post: { summary: "Upload track (Bearer required)" },
      },
      "/api/qmedia/videos": {
        get: { summary: "List videos", security: [] },
      },
      "/api/qmedia/playlists": {
        get: { summary: "List playlists", security: [] },
      },
      // QAI — universal AI assistant (personas + sessions + chat)
      "/api/qai/health": { get: { summary: "QAI health + session count", security: [] } },
      "/api/qai/personas": {
        get: { summary: "List built-in personas (id, name, emoji, description)", security: [] },
      },
      "/api/qai/sessions": {
        get: { summary: "List user chat sessions (Bearer required)" },
      },
      "/api/qai/chat": {
        post: { summary: "Send a chat message (Bearer required)" },
      },
      // QJobs — job board
      "/api/qjobs/health": { get: { summary: "QJobs health + service marker", security: [] } },
      "/api/qjobs/jobs": {
        get: { summary: "List job postings (filter by type, location)", security: [] },
        post: { summary: "Create job posting (Bearer required)" },
      },
      "/api/qjobs/jobs/{id}": {
        get: { summary: "Single job posting with application count", security: [] },
      },
      "/api/qjobs/stats": {
        get: { summary: "Aggregate stats — postings, applications, by type", security: [] },
      },
      // QNews — news aggregator
      "/api/qnews/health": { get: { summary: "QNews health + service marker", security: [] } },
      "/api/qnews/articles": {
        get: { summary: "List news articles (filter by category, since)", security: [] },
        post: { summary: "Create article (Bearer required)" },
      },
      "/api/qnews/articles/{id}": {
        get: { summary: "Single article with full body + comments", security: [] },
      },
      "/api/qnews/categories": {
        get: { summary: "Categories with counts (id + count)", security: [] },
      },
      "/api/qnews/rss": {
        get: { summary: "RSS 2.0 feed for the news catalog (application/rss+xml)", security: [] },
      },
      // Coach — AI coaching / goal-tracking
      "/api/coach/health": { get: { summary: "Coach health + provider config", security: [] } },
      "/api/coach/sessions": {
        get: { summary: "List user coaching sessions (Bearer required)" },
        post: { summary: "Create new session with goal (Bearer required)" },
      },
      "/api/coach/sessions/{id}": {
        get: { summary: "Get session with conversation history (Bearer required)" },
      },
      // Multichat — multi-agent chat (fully Bearer-gated on prod)
      "/api/multichat/health": { get: { summary: "Multichat health (Bearer required)" } },
      "/api/multichat/rooms": {
        get: { summary: "List user chat rooms (Bearer required)" },
        post: { summary: "Create new room (Bearer required)" },
      },
      "/api/multichat/rooms/{id}/messages": {
        get: { summary: "Get room message history (Bearer required)" },
        post: { summary: "Post message to room (Bearer required)" },
      },
      // DevHub — code snippets + tooling
      "/api/devhub/health": { get: { summary: "DevHub health + DB status", security: [] } },
      "/api/devhub/snippets": {
        get: { summary: "List code snippets (filter by lang, tag)", security: [] },
        post: { summary: "Create snippet (Bearer required)" },
      },
      "/api/devhub/snippets/{id}": {
        get: { summary: "Single snippet with code + metadata", security: [] },
      },
      "/api/devhub/snippets/{id}/star": {
        post: { summary: "Toggle star on snippet (Bearer required)" },
      },
      // QFusionAI — multi-model fusion orchestrator
      "/api/qfusionai/health": { get: { summary: "QFusionAI health + model count", security: [] } },
      "/api/qfusionai/stats": {
        get: { summary: "Fusion stats — runs, by-model, totals", security: [] },
      },
      "/api/qfusionai/fusions": {
        get: { summary: "List fusion runs", security: [] },
        post: { summary: "Create fusion run (Bearer required)" },
      },
      // QPersona — persona profile pages (with waitlist + unsubscribe)
      "/api/qpersona/health": { get: { summary: "QPersona health + persona count", security: [] } },
      "/api/qpersona/personas": {
        get: { summary: "List public personas", security: [] },
      },
      "/api/qpersona/personas/{slug}": {
        get: { summary: "Single persona by slug — public profile", security: [] },
      },
      "/api/qpersona/waitlist": {
        post: { summary: "Join early-access waitlist (HMAC unsubscribe link emailed)", security: [] },
      },
      "/api/qpersona/unsubscribe": {
        get: { summary: "Unsubscribe via signed HMAC token from email link", security: [] },
      },
      // QLife — life-prompts catalog
      "/api/qlife/health": { get: { summary: "QLife health + prompt count", security: [] } },
      "/api/qlife/prompts": {
        get: { summary: "List daily life prompts (filter by mood, category)", security: [] },
      },
      "/api/qlife/prompts/{id}": {
        get: { summary: "Single prompt with full content", security: [] },
      },
      // LifeBox — time-capsule messages to future-self
      "/api/lifebox/health": { get: { summary: "LifeBox health + capsule count", security: [] } },
      "/api/lifebox/capsules": {
        get: { summary: "List public capsules (filter by year, theme)", security: [] },
        post: { summary: "Create capsule (Bearer required)" },
      },
      "/api/lifebox/capsules/{id}": {
        get: { summary: "Single capsule (public or owner only)", security: [] },
      },
      // ShadowNet — anonymous threat/whistleblower posts
      "/api/shadownet/health": { get: { summary: "ShadowNet health + post count", security: [] } },
      "/api/shadownet/posts": {
        get: { summary: "List anonymous posts (filter by category)", security: [] },
        post: { summary: "Submit anonymous post (no auth — by design)", security: [] },
      },
      "/api/shadownet/posts/{id}": {
        get: { summary: "Single post with comments", security: [] },
      },
      // DeepSan — long-running deep-sanity AI runs
      "/api/deepsan/health": { get: { summary: "DeepSan health + run count", security: [] } },
      "/api/deepsan/runs": {
        get: { summary: "List deep-sanity runs", security: [] },
        post: { summary: "Start new run (Bearer required)" },
      },
      "/api/deepsan/runs/{id}": {
        get: { summary: "Single run with output + timing", security: [] },
      },
      // PsyApp-Deps — addiction-recovery streak + assessments
      "/api/psyapp-deps/health": { get: { summary: "PsyApp-Deps health + assessment count", security: [] } },
      "/api/psyapp-deps/assessments": {
        get: { summary: "List standard assessments (PHQ-9, GAD-7, etc.)", security: [] },
      },
      "/api/psyapp-deps/assessments/{id}": {
        get: { summary: "Single assessment with questions", security: [] },
      },
      // AEVION Hub — central registry + SDK presence + ecosystem stats
      "/api/aevion/version": { get: { summary: "Hub service version + uptime + node version", security: [] } },
      "/api/aevion/stats": {
        get: { summary: "Registry stats: total modules, byTier, coverage matrix, recent activity", security: [] },
      },
      "/api/aevion/catalog": {
        get: { summary: "Unified module catalog with health/openapi/badges links", security: [] },
      },
      "/api/aevion/catalog/{id}": {
        get: { summary: "Single module catalog entry with health probe + related modules", security: [] },
      },
      "/api/aevion/registry-stats": {
        get: { summary: "Lightweight registry stats (count + tier breakdown only)", security: [] },
      },
      "/api/aevion/badges/{moduleId}.svg": {
        get: { summary: "SVG status badge for embedding (image/svg+xml)", security: [] },
      },
      "/api/aevion/module-of-the-day": {
        get: { summary: "Deterministic daily module rotation + related + tomorrow preview", security: [] },
      },
      "/api/aevion/sdks": {
        get: { summary: "Published AEVION npm SDK packages (4 packages with versions, install commands, npmjs registry URLs)", security: [] },
      },
      "/api/aevion/openapi.json": {
        get: { summary: "Composite OpenAPI spec aggregating sub-module specs", security: [] },
      },
      "/api/aevion/sitemap.xml": {
        get: { summary: "XML sitemap of all live module endpoints (application/xml)", security: [] },
      },
      // QTradeOffline
      "/api/qtradeoffline/health": { get: { summary: "QTradeOffline health + wallet/transfer counts" } },
      "/api/qtradeoffline/wallet/register": { post: { summary: "Register ECDSA P-256 wallet — 100 AEV airdrop on first call" } },
      "/api/qtradeoffline/wallet/{id}": { get: { summary: "Wallet balance" } },
      "/api/qtradeoffline/history/{id}": { get: { summary: "Wallet ledger history" } },
      "/api/qtradeoffline/leaderboard": { get: { summary: "Top 10 wallets by balance" } },
      "/api/qtradeoffline/stats": { get: { summary: "Global stats — wallets, totalSupply, transfers, volume" } },
      "/api/qtradeoffline/sync": { post: { summary: "Batch-apply offline-signed transfers (atomic, idempotent via nonce)" } },
      // QStore enhanced
      "/api/qstore/products": {
        get: { summary: "List marketplace products" },
      },
      "/api/qstore/products/{id}/purchase": {
        post: { summary: "Purchase product — returns Stripe Checkout URL if Stripe configured, else direct" },
      },
      // QMaskCard
      "/api/qmaskcard/health": { get: { summary: "QMaskCard health" } },
      "/api/qmaskcard/stats": { get: { summary: "Global stats — active masks, authorized charges, volume" } },
      "/api/qmaskcard/masks": {
        get: { summary: "List user virtual cards (Bearer required)" },
        post: { summary: "Issue new virtual card with spend limits (Bearer required)" },
      },
      "/api/qmaskcard/charges": {
        get: { summary: "List charges for user's masks (Bearer required)" },
        post: { summary: "Authorize a charge against a mask (Bearer required)" },
      },
      // HealthAI
      "/api/healthai/health": { get: { summary: "HealthAI health — persistence mode + profile count" } },
      "/api/healthai/profile": { post: { summary: "Create/update health profile" } },
      "/api/healthai/profile/{id}": { get: { summary: "Get health profile" } },
      "/api/healthai/log": { post: { summary: "Daily wellness log (sleep, mood, weight, water, exercise)" } },
      "/api/healthai/plan/{profileId}": {
        get: { summary: "Generate AI wellness plan — rule-based + LLM-enhanced (Anthropic/OpenAI/Gemini chain)" },
      },
      "/api/healthai/check": { post: { summary: "Symptom check + rule-based advice" } },
      ...FINTECH_OPENAPI_PATHS,
      ...NEW_WAVE_OPENAPI_PATHS,
    },
    components: { schemas: { ...FINTECH_OPENAPI_SCHEMAS, ...NEW_WAVE_OPENAPI_SCHEMAS } },
    tags: [...FINTECH_OPENAPI_TAGS, ...NEW_WAVE_OPENAPI_TAGS],
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
app.use("/api/cyberchess-tournaments", cyberchessTournamentsRouter);
app.use("/api/cyberchess-daily", cyberchessDailyRouter);
app.use("/api/cyberchess-voice-coach", cyberchessVoiceCoachRouter);
app.use("/api/cyberchess-spectator", cyberchessSpectatorRouter);
app.use("/api/cyberchess/matchmaking", cyberchessMatchmakingRouter);
app.use("/api/cyberchess-anticheat", cyberchessAnticheatRouter);
app.use("/api/puzzles", puzzlesRouter);

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
app.use("/api/healthai", healthaiRouter);

// ==========================
// Pricing / GTM
// ==========================
app.use("/api/pricing", pricingRouter);
app.use("/api/pricing/checkout", checkoutRouter);
app.use("/api/quotas", apiQuotasRouter);
app.use("/api/keys", apiKeysRouter);
app.use("/api/qgood", qgoodRouter);
app.use("/api/qmaskcard", qmaskcardRouter);
app.use("/api/veilnetx-ledger", veilnetxLedgerRouter);
app.use("/api/ztide", ztideRouter);
app.use("/api/qchaingov", qchaingovRouter);
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

// Smeta Trainer — progress sync + LMS webhook
app.use("/api/smeta-trainer", smetaTrainerRouter);

// QContract — self-destruct smart documents
app.use("/api/qcontract", qcontractRouter);

// HealthAI — personal AI doctor
app.use("/api/healthai", healthaiRouter);

// QFusionAI — smart multi-provider LLM router
app.use("/api/qfusionai", qfusionaiRouter);

// VeilNetX — privacy proxy pre-launch status + waitlist
app.use("/api/veilnetx", veilnetxRouter);

// ShadowNet — alternative private internet concept simulator.
// Mounted BEFORE the generic planning stubs loop (which would also create
// /api/shadownet) so the dedicated endpoints win.
app.use("/api/shadownet", shadownetRouter);
app.use("/api/psyapp-deps", psyappDepsRouter);
app.use("/api/lifebox", lifeboxRouter);
// Wave 1/3/4 MVPs — mount BEFORE planning stubs so dedicated routes win.
app.use("/api/mapreality", mapRealityRouter);
app.use("/api/voice-of-earth", voiceOfEarthRouter);
app.use("/api/deepsan", deepSanRouter);
app.use("/api/qpersona", qpersonaRouter);
app.use("/api/qlife", qlifeRouter);

// MVP concept routers (per `routes/mvpConcepts.ts`) MUST mount BEFORE
// the generic planning stubs so module-specific paths (e.g.
// `/api/startup-exchange/listings`) take precedence and unknown paths
// still fall through to /health, /waitlist on the planning stub.
mountMvpConcepts(app);

// Planning-stage modules — shared status + waitlist surface
for (const cfg of PLANNING_MODULES) {
  app.use(`/api/${cfg.id}`, createPlanningStubRouter(cfg));
}

// DevHub — AI-powered developer platform
app.use("/api/devhub", devhubRouter);
// QMedia — music, video and creative tools
app.use("/api/qmedia", qmediaRouter);
// Payments — Stripe + PayBox KZ unified gateway
app.use("/api/payments", paymentsRouter);
// QAI — universal public AI assistant
app.use("/api/qai", qaiRouter);
// QStore — digital marketplace
app.use("/api/qstore", qstoreRouter);
// QLearn — learning platform
app.use("/api/qlearn", qlearnRouter);
// QNews — standalone product #30
app.use("/api/qnews", qnewsRouter);
// MapReality — civic signals map (MVP: signals + supports)
app.use("/api/mapreality", mapRealityRouter);
// StartupX — startup ideas marketplace + investor interest
app.use("/api/startupx", startupExchangeRouter);
// Kids AI Content — multilang lesson catalog + AI tutor
app.use("/api/kids-ai", kidsAiContentRouter);
// Voice of Earth — multilang music tracks + voting
app.use("/api/voice-of-earth", voiceOfEarthRouter);
// QJobs → QBuild social hiring layer. Canonical: /api/build/jobs, legacy: /api/qjobs
app.use("/api/build/jobs", qjobsRouter);
app.use("/api/qjobs", qjobsRouter);
// QSocial → QBuild social layer. Canonical: /api/build/social, legacy: /api/qsocial
app.use("/api/build/social", qsocialRouter);
app.use("/api/qsocial", qsocialRouter);
// QEvents — events platform (RSVP, create, attend)
app.use("/api/qevents", qeventsRouter);

// Revenue Hub — centralized monetization: Paddle + YouTube + Twitch per app
app.use("/api/revenue", revenueRouter);
// Paddle Billing — payment processor for KZ + international (MoR model)
app.use("/api/paddle", paddleRouter);
// Universal Search — /api/search?q=<query> across QStore/QLearn/QNews/QEvents/QJobs/QRight
app.use("/api/search", searchRouter);

// DeepSan — anti-chaos productivity (tasks, focus sessions, stats)
app.use("/api/deepsan", deepSanRouter);
// QPersona — digital avatar profiles (persona CRUD, AI bio, public gallery)
app.use("/api/qpersona", qpersonaRouter);
// QLife — longevity & anti-aging (biomarker log, trends, AI plan)
app.use("/api/qlife", qlifeRouter);

// QPayNet — embedded payment infrastructure
app.use("/api/qpaynet", qpaynetRouter);
startQpaynetRetryWorker();

// QTradeOffline — offline-first P2P AEV payments (ECDSA P-256, /sync batch)
app.use("/api/qtradeoffline", qtradeOfflineRouter);

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

// QCoreAI scheduler — polls for due scheduled batches every minute.
startScheduler();
