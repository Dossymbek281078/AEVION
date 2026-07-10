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
import { entitlementsRouter } from "./routes/entitlements";
import { requireModule } from "./lib/planGate";
import { awardsRouter } from "./routes/awards";
import { qcoreaiRouter, startScheduler } from "./routes/qcoreai";
import { agentRuntimeRouter } from "./routes/agentRuntime";
import { mcpDemoRouter } from "./routes/mcpDemo";
import { attachQCoreWebSocket } from "./services/qcoreai/wsServer";
import { attachConstitutionCollab } from "./services/constitution/collab";
import { quantumShieldRouter } from "./routes/quantum-shield";
import { pipelineRouter } from "./routes/pipeline";
import { bureauRouter } from "./routes/bureau";
import { coachRouter } from "./routes/coach";
import { pricingRouter } from "./routes/pricing";
import { checkoutRouter } from "./routes/checkout";
import { lemonSqueezyWebhookRouter } from "./routes/lemonSqueezyWebhook";
import { gumroadWebhookRouter } from "./routes/gumroadWebhook";
import { payboxWebhookRouter } from "./routes/payboxWebhook";
import { paypalWebhookRouter } from "./routes/paypalWebhook";
import { healthaiRouter } from "./routes/healthai";
import { eventsRouter } from "./routes/events";
import { projects } from "./data/projects";
import { enrichProject, enrichProjects } from "./data/moduleRuntime";
import { multichatRouter, multichatPublicRouter } from "./routes/multichat";
import { aevRouter } from "./routes/aev";
import { ecosystemRouter } from "./routes/ecosystem";
import { cyberchessRouter } from "./routes/cyberchess";
import cyberchessPuzzlesRouter from "./routes/cyberchessPuzzles";
import cyberchessTournamentsRouter from "./routes/cyberchessTournaments";
import cyberchessDailyRouter from "./routes/cyberchessDaily";
import cyberchessVoiceCoachRouter from "./routes/cyberchessVoiceCoach";
import cyberchessSpectatorRouter from "./routes/cyberchessSpectator";
import cyberchessMatchmakingRouter from "./routes/cyberchessMatchmaking";
import cyberchessAnticheatRouter from "./routes/cyberchessAnticheat";
import cyberchessOpeningRouter from "./routes/cyberchessOpening";
import { puzzlesRouter } from "./routes/puzzles";
import { buildRouter } from "./routes/build";
import { aevionHubRouter } from "./routes/aevion-hub";
import { i18nRouter } from "./routes/i18n";
import { qrightRoyaltiesRouter } from "./routes/qrightRoyalties";
import { planetPayoutsRouter } from "./routes/planetPayouts";
import { planetConstitutionRouter } from "./routes/planetConstitution";
import { constitutionAiRouter } from "./routes/constitutionAi";
import { constitutionPublicRouter } from "./routes/constitutionPublic";
import { constitutionPdfRouter } from "./routes/constitutionPdf";
import { constitutionProRouter } from "./routes/constitutionPro";
import { constitutionAdminRouter, constitutionTelemetry, constitutionBanGate } from "./routes/constitutionAdmin";
import { constitutionFunnelTrackRouter, constitutionFunnelAdminRouter } from "./routes/constitutionFunnel";
import { constitutionWaitlistRouter, constitutionWaitlistAdminRouter } from "./routes/constitutionWaitlist";
import { constitutionStatusRouter, startUptimeChecker } from "./routes/constitutionStatus";
import { constitutionCheckoutRouter } from "./routes/constitutionCheckout";
import { planetConstitutionSocialRouter } from "./routes/planetConstitutionSocial";
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
import { qmelaninRouter } from "./routes/qmelanin";
import { qrenewRouter } from "./routes/qrenew";
import { qsocialRouter } from "./routes/qsocial";
import { qnewsRouter } from "./routes/qnews";
import { qjobsRouter } from "./routes/qjobs";
import { mapRealityRouter } from "./routes/mapReality";
import { startupExchangeRouter } from "./routes/startupExchange";
import { qventureRouter } from "./routes/qventure";
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
// Gumroad pings arrive as application/x-www-form-urlencoded. express.json
// ignores that content-type, so without this parser req.rawBody is never
// populated for form posts and /api/gumroad/webhook reads an empty body
// (→ every real ping silently ignored as no_email). Same verify hook stashes
// the raw bytes for the provider's optional HMAC signature check.
app.use(express.urlencoded({
  extended: false,
  limit: "1mb",
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

// Module paywall — dormant unless the module id is listed in PAYWALL_MODULES
// (see lib/planGate.ts). qcoreai is the flagship gated module (AI compute =
// real OPEX); enforcement stays off until PAYWALL_MODULES is set on Railway.
app.use("/api/qcoreai", requireModule("qcoreai"), qcoreaiRouter);
// Our own agent runtime — a real provider tool-use loop, kept separate from
// qcoreai (owned by another work stream). Ungated: no module id in the registry.
app.use("/api/agent-runtime", agentRuntimeRouter);
// First-party MCP server (AEVION registry tools) — lets the agent-runtime MCP
// bridge prove the full runtime→bridge→MCP-server→tool path in our own zone.
app.use("/api/mcp-demo", mcpDemoRouter);
// Public share-link route mounted BEFORE the auth-gated multichat router so
// /api/multichat/shared/:token bypasses requireAuth.
app.use("/api/multichat", multichatPublicRouter);
app.use("/api/multichat", requireModule("multichat-engine"), multichatRouter);

/** OpenAPI 3.1 spec — full schemas + examples for bank-track routes,
 *  summary-only for legacy globus / qsign. See lib/openapiSpec.ts. */
app.get("/api/openapi.json", (_req, res) => {
  res.json({
    openapi: "3.1.0",
    info: {
      title: "AEVION Globus Backend",
      version: "0.8.0",
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
      "/api/revenue/health": { get: { summary: "Revenue Hub health — Gumroad (primary)/Paddle/YouTube/Twitch config status" } },
      "/api/revenue/apps": { get: { summary: "List 12 AEVION apps with monetization channels" } },
      "/api/revenue/apps/{appId}": { get: { summary: "Single app revenue config + channel stubs" } },
      "/api/revenue/overview": { get: { summary: "Global monetization overview — channel coverage, app counts" } },
      "/api/revenue/gumroad/balance": { get: { summary: "Gumroad net balance (gross - fees, USD) — live processor" } },
      "/api/revenue/gumroad/recent": { get: { summary: "Recent Gumroad sales grouped by AEVION app" } },
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
      "/api/coach/chat": {
        post: { summary: "Anthropic chat proxy — stateless coaching reply (public)", security: [] },
      },
      "/api/coach/chat/stream": {
        post: { summary: "Anthropic chat proxy — streamed SSE coaching reply (public)", security: [] },
      },
      "/api/coach/sessions": {
        get: { summary: "List user coaching sessions (Bearer required)" },
      },
      "/api/coach/sessions/start": {
        post: { summary: "Start a coaching session (Bearer required)" },
      },
      "/api/coach/sessions/{id}": {
        get: { summary: "Get a single coaching session (Bearer required)" },
      },
      "/api/coach/sessions/{id}/end": {
        post: { summary: "End an active coaching session (Bearer required)" },
      },
      "/api/coach/goals": {
        get: { summary: "List user coaching goals (Bearer required)" },
        post: { summary: "Create a coaching goal (Bearer required)" },
      },
      "/api/coach/goals/{id}/complete": {
        post: { summary: "Mark a coaching goal complete (Bearer required)" },
      },
      "/api/coach/goals/{id}": {
        delete: { summary: "Delete a coaching goal (Bearer required)" },
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
      // Universal Search
      "/api/search/health": { get: { summary: "Search service health — sources list", security: [] } },
      "/api/search": {
        get: {
          summary: "Universal Search — queries QStore/QLearn/QNews/QEvents/QJobs/QRight in parallel",
          security: [],
          parameters: [
            { name: "q", in: "query", required: true, schema: { type: "string", minLength: 2, maxLength: 100 } },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50 } },
            { name: "types", in: "query", schema: { type: "string", description: "Comma-separated: qstore,qlearn,qnews,qevents,qjobs,qright" } },
          ],
        },
      },
      // Paddle Billing v2
      "/api/paddle/health": { get: { summary: "Paddle API health — configured/sandbox/webhookConfigured/apiReachable", security: [] } },
      "/api/paddle/plans": { get: { summary: "AEVION Paddle price catalog for frontend", security: [] } },
      "/api/paddle/products": { get: { summary: "Paddle products + prices from dashboard (live mode)", security: [] } },
      "/api/paddle/transactions": { get: { summary: "Recent Paddle transactions grouped by appId", security: [] } },
      "/api/paddle/setup-guide": { get: { summary: "Step-by-step Paddle setup guide for KZ accounts", security: [] } },
      "/api/paddle/checkout": {
        post: {
          summary: "Create Paddle transaction → returns checkout URL",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { priceId: { type: "string" }, quantity: { type: "integer" }, email: { type: "string" }, tierId: { type: "string" }, appId: { type: "string" } }, required: ["priceId"] } } } },
        },
      },
      "/api/paddle/webhook": {
        post: {
          summary: "Paddle webhook — verifies Paddle-Signature HMAC, provisions subscription on transaction.completed",
          security: [],
        },
      },
      "/api/paddle/subscription/{id}": { get: { summary: "Paddle subscription status by ID" } },
      "/api/paddle/customer/{email}": { get: { summary: "Paddle customer lookup by email" } },
      // Lemon Squeezy — recurring subscription webhook
      "/api/lemonsqueezy/webhook": {
        post: {
          summary:
            "Lemon Squeezy subscription webhook — verifies x-signature (HMAC-SHA256), maps subscription_* events to plan provisioning",
          description:
            "Activation events (subscription_created, subscription_updated, subscription_resumed, subscription_unpaused) call provisionSubscription: All-Access variant → 'business' tier, any bundle variant → 'pro', unrecognised/unset variant → 'pro'. Deactivation events (subscription_cancelled, subscription_expired, subscription_paused) write a tierId:'free' downgrade record. Other subscription_* events are acknowledged but ignored. Signature is HMAC-SHA256 of the raw body keyed by LEMON_SQUEEZY_WEBHOOK_SECRET, compared to the x-signature header; when the secret is unset the route is a 200 no-op stub. Delivery is at-least-once — handler dedups on subscription id + event + timestamp.",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    meta: {
                      type: "object",
                      properties: {
                        event_name: {
                          type: "string",
                          enum: [
                            "subscription_created",
                            "subscription_updated",
                            "subscription_resumed",
                            "subscription_unpaused",
                            "subscription_cancelled",
                            "subscription_expired",
                            "subscription_paused",
                          ],
                        },
                        custom_data: {
                          type: "object",
                          properties: {
                            reference: { type: "string", example: "bundle:fintech" },
                            email: { type: "string", format: "email" },
                          },
                        },
                      },
                      required: ["event_name"],
                    },
                    data: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        attributes: {
                          type: "object",
                          properties: {
                            user_email: { type: "string", format: "email" },
                            variant_id: { type: "integer" },
                            status: { type: "string", example: "active" },
                            renews_at: { type: "string", format: "date-time", nullable: true },
                            ends_at: { type: "string", format: "date-time", nullable: true },
                          },
                        },
                      },
                    },
                  },
                  required: ["meta"],
                },
              },
            },
          },
          responses: {
            "200": {
              description:
                "Acknowledged. Body indicates the action taken: { ok, action: 'activated'|'downgraded', tierId? } | { ok, ignored } | { ok, deduped } | { ok, mode: 'stub' }",
            },
            "400": { description: "Body is not JSON, or subscription event missing user_email" },
            "401": { description: "x-signature header missing or HMAC mismatch" },
            "500": { description: "Provisioning failed — LS will retry (dedup entry released)" },
          },
        },
      },
      // Gumroad — platform-wide ping webhook (form-encoded)
      "/api/gumroad/webhook": {
        get: {
          summary: "Gumroad webhook liveness probe — returns JSON manifest (real Gumroad pings come on POST)",
          security: [],
          responses: { "200": { description: "Tiny JSON: { ok, endpoint, accepts, signed, info }" } },
        },
        post: {
          summary:
            "Gumroad ping webhook (application/x-www-form-urlencoded) — maps sale/refund/cancel to plan provisioning",
          description:
            "Gumroad sends form-encoded pings for all AEVION products. product_id is matched against GUMROAD_PRODUCT_<ID>=<reference> env to pick the tier (all-access/business → 'business', else 'pro'); unmatched falls back to constitution-pro. A paid sale calls provisionSubscription (writes subscriptions.jsonl, same store /me/plan and the Pro gates read); refunded/disputed/subscription_cancelled/subscription_failed write a tierId:'free' downgrade record. Missing email → ignored. Optional HMAC: if GUMROAD_WEBHOOK_SECRET is set, x-gumroad-signature (or a signature field) must match HMAC-SHA256 of the raw body. Dedup on sale_id + status.",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/x-www-form-urlencoded": {
                schema: {
                  type: "object",
                  properties: {
                    sale_id: { type: "string" },
                    email: { type: "string", format: "email" },
                    product_id: { type: "string" },
                    short_product_id: { type: "string" },
                    is_recurring_billing: { type: "string", example: "true" },
                    refunded: { type: "string", example: "false" },
                    disputed: { type: "string", example: "false" },
                    subscription_cancelled: { type: "string" },
                    subscription_failed: { type: "string" },
                    sale_timestamp: { type: "string", format: "date-time" },
                  },
                  required: ["email"],
                },
              },
            },
          },
          responses: {
            "200": {
              description:
                "Acknowledged: { ok, action: 'activated'|'downgraded', tierId? } | { ok, ignored } | { ok, deduped }",
            },
            "400": { description: "Webhook body could not be parsed" },
            "401": { description: "Signature mismatch (GUMROAD_WEBHOOK_SECRET set and x-gumroad-signature invalid)" },
            "500": { description: "Provisioning failed — dedup entry released for retry" },
          },
        },
      },
      // Pricing — subscription self-service
      "/api/pricing/subscription/me": {
        get: { summary: "Latest subscription for authenticated user (JWT)" },
      },
      "/api/pricing/subscriptions/purge": {
        post: {
          summary: "Admin: purge all subscriptions.jsonl records by email (GDPR / test cleanup)",
          description: "Requires X-Admin-Token. Body: { email }. Atomic .tmp+rename rewrite. Returns { ok, email, removed, remaining }.",
        },
      },
      "/api/pricing/cases": { get: { summary: "Customer case stories with ROI metrics" } },
      ...FINTECH_OPENAPI_PATHS,
      ...NEW_WAVE_OPENAPI_PATHS,
    },
    components: { schemas: { ...FINTECH_OPENAPI_SCHEMAS, ...NEW_WAVE_OPENAPI_SCHEMAS } },
    tags: [...FINTECH_OPENAPI_TAGS, ...NEW_WAVE_OPENAPI_TAGS],
  });
});

// ============================================================
// Platform module paywall — centralised gate registration.
//
// One source of truth mapping each monetised module's API prefix to its
// module id in MODULES_PRICING. Registered BEFORE the route mounts below so
// Express runs the gate ahead of the matching router (middleware runs in
// registration order). DORMANT by default: requireModule() is a no-op unless
// the id is listed in env PAYWALL_MODULES (see lib/planGate.ts), so this is
// safe to wire everywhere and flip on per-module from Railway.
//
// Deliberately NOT gated here: globus (free/public portal), cyberchess*,
// smeta-trainer, qbuild/build (active work in other worktrees), and
// constitution* (has its own dedicated gate in lib/constitutionGate.ts).
// qcoreai and multichat-engine are gated inline above (mounted earlier).
const MODULE_GATE_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ["/api/qfusionai", "qfusionai"],
  ["/api/qright", "qright"],
  ["/api/qsign", "qsign"], // also covers /api/qsign/v2
  ["/api/bureau", "aevion-ip-bureau"],
  ["/api/qtradeoffline", "qtradeoffline"],
  ["/api/qpaynet", "qpaynet-embedded"],
  ["/api/qmaskcard", "qmaskcard"],
  ["/api/veilnetx", "veilnetx"],
  ["/api/veilnetx-ledger", "veilnetx"],
  ["/api/healthai", "healthai"],
  ["/api/qai", "qai"],
  ["/api/qlearn", "qlearn"],
  ["/api/qnews", "qnews"],
  ["/api/qstore", "qstore"],
  ["/api/qmedia", "qmedia"],
  ["/api/qlife", "qlife"],
  ["/api/qgood", "qgood"],
  ["/api/psyapp-deps", "psyapp-deps"],
  ["/api/qpersona", "qpersona"],
  ["/api/kids-ai", "kids-ai-content"],
  ["/api/voice-of-earth", "voice-of-earth"],
  ["/api/startupx", "startup-exchange"],
  ["/api/qventure", "qventure"],
  ["/api/deepsan", "deepsan"],
  ["/api/mapreality", "mapreality"],
  ["/api/qevents", "qevents"],
  ["/api/ztide", "z-tide"],
  ["/api/qcontract", "qcontract"],
  ["/api/shadownet", "shadownet"],
  ["/api/lifebox", "lifebox"],
  ["/api/qchaingov", "qchaingov"],
];
for (const [prefix, moduleId] of MODULE_GATE_PREFIXES) {
  app.use(prefix, requireModule(moduleId));
}

// ==========================
// QRight — патентирование
// ==========================
app.use("/api/qtrade", qtradeRouter);
app.use("/api/aev", aevRouter);
app.use("/api/qright", qrightRouter);
app.use("/api/qright", qrightRoyaltiesRouter);
app.use("/api/ecosystem", ecosystemRouter);
app.use("/api/cyberchess", cyberchessRouter);
app.use("/api/cyberchess-puzzles", cyberchessPuzzlesRouter);
app.use("/api/cyberchess-tournaments", cyberchessTournamentsRouter);
app.use("/api/cyberchess-daily", cyberchessDailyRouter);
app.use("/api/cyberchess-voice-coach", cyberchessVoiceCoachRouter);
app.use("/api/cyberchess-spectator", cyberchessSpectatorRouter);
app.use("/api/cyberchess/matchmaking", cyberchessMatchmakingRouter);
app.use("/api/cyberchess-anticheat", cyberchessAnticheatRouter);
app.use("/api/cyberchess-opening", cyberchessOpeningRouter);
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
// Platform entitlements + paywall policy (GET /api/me/entitlements, /api/paywall/policy)
app.use("/api", entitlementsRouter);
app.use("/api/keys", apiKeysRouter);
app.use("/api/qgood", qgoodRouter);
app.use("/api/qmaskcard", qmaskcardRouter);
app.use("/api/veilnetx-ledger", veilnetxLedgerRouter);
app.use("/api/ztide", ztideRouter);
app.use("/api/qchaingov", qchaingovRouter);
app.use("/api/pricing/events", eventsRouter);
app.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter);
app.use("/api/gumroad", gumroadWebhookRouter);
app.use("/api/paybox", payboxWebhookRouter);
app.use("/api/paypal", paypalWebhookRouter);
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
// Telemetry + ban-gate cover the entire constitution surface
app.use(["/api/constitution", "/api/planet/constitution-artifacts"], constitutionTelemetry);
app.use(["/api/constitution", "/api/planet/constitution-artifacts"], constitutionBanGate);
app.use("/api/admin/constitution", constitutionAdminRouter);
app.use("/api/admin/constitution/funnel", constitutionFunnelAdminRouter);
app.use("/api/constitution/funnel", constitutionFunnelTrackRouter);
app.use("/api/constitution/waitlist", constitutionWaitlistRouter);
app.use("/api/admin/constitution/waitlist", constitutionWaitlistAdminRouter);
app.use("/api/constitution/status", constitutionStatusRouter);
app.use("/api/constitution/checkout", constitutionCheckoutRouter);
app.use("/api/planet/constitution-artifacts", planetConstitutionRouter);
app.use("/api/constitution", constitutionAiRouter);
app.use("/api/constitution", constitutionPdfRouter);
app.use("/api/constitution", constitutionProRouter);
app.use("/api/constitution/public", constitutionPublicRouter);
app.use("/api/planet/constitution-artifacts", planetConstitutionSocialRouter);
app.use("/api/awards", awardsRouter);

// ==========================
// AEVION Hub — composite cross-product health + OpenAPI index
// ==========================
app.use("/api/aevion", aevionHubRouter);
app.use("/api/i18n", i18nRouter);

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
// QMelanin — anti-graying engine (deterministic, DB-free)
app.use("/api/qmelanin", qmelaninRouter);
// QRenew — cellular-renewal program (biological age + tiered stack)
app.use("/api/qrenew", qrenewRouter);
// QNews — standalone product #30
app.use("/api/qnews", qnewsRouter);
// MapReality — civic signals map (MVP: signals + supports)
app.use("/api/mapreality", mapRealityRouter);
// StartupX — startup ideas marketplace + investor interest
app.use("/api/startupx", startupExchangeRouter);
// QVenture — AI investment analyst: quant score + 4-role council + entry strategy
app.use("/api/qventure", qventureRouter);
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

// Last-resort process-level backstops. Express 5 auto-forwards async request-
// handler rejections to the error middleware, but a throw inside a setInterval/
// timer callback (e.g. the 3s matchmaking pairing scan) or a stray unhandled
// promise rejection bypasses Express entirely — without these, one such throw
// terminates the whole backend and takes every AEVION module down with it.
// Policy: log + capture, NEVER exit. A single bad tick must not kill the process.
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  try { captureException(err, { where: "uncaughtException" }); } catch { /* never throw from the backstop */ }
});
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
  try {
    captureException(reason instanceof Error ? reason : new Error(String(reason)), { where: "unhandledRejection" });
  } catch { /* never throw from the backstop */ }
});

// QCoreAI duplex transport — same orchestrator as POST /multi-agent (SSE)
// but lets clients interject mid-run guidance on the same connection.
attachQCoreWebSocket(httpServer, "/api/qcoreai/ws");
attachConstitutionCollab(httpServer, "/api/constitution/collab");
startUptimeChecker(PORT);

// QCoreAI scheduler — polls for due scheduled batches every minute.
startScheduler();
