import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import { qrightRouter } from "./routes/qright";
import { qsignRouter } from "./routes/qsign";
import { qtradeRouter } from "./routes/qtrade";
import { authRouter } from "./routes/auth";
import { planetComplianceRouter } from "./routes/planetCompliance";
import { modulesRouter } from "./routes/modules";
import { qcoreaiRouter } from "./routes/qcoreai";
import { quantumShieldRouter } from "./routes/quantum-shield";
import { pipelineRouter } from "./routes/pipeline";
import { coachRouter } from "./routes/coach";
import { pricingRouter } from "./routes/pricing";
import { checkoutRouter } from "./routes/checkout";
import { eventsRouter } from "./routes/events";
import { projects } from "./data/projects";
import { enrichProject, enrichProjects } from "./data/moduleRuntime";

// Подключаем ТОЛЬКО QRight (он реально существует)
// (qrightRouter already imported above)

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors());
app.use(express.json());

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
      version: "0.2.0",
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
      "/api/qsign/sign": { post: { summary: "Sign payload" } },
      "/api/qsign/verify": { post: { summary: "Verify signature" } },
      "/api/auth/register": { post: {} },
      "/api/auth/login": { post: {} },
      "/api/auth/me": { get: {} },
      "/api/qcoreai/chat": { post: { summary: "Chat (OpenAI or stub)" } },
      "/api/qcoreai/health": { get: { summary: "QCoreAI config probe" } },
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
    },
  });
});

// ==========================
// QRight — патентирование
// ==========================
app.use("/api/qtrade", qtradeRouter);
app.use("/api/qright", qrightRouter);

// ==========================
app.use("/api/qsign", qsignRouter);

// ==========================
// Quantum Shield
// ==========================
app.use("/api/quantum-shield", quantumShieldRouter);
app.use("/api/pipeline", pipelineRouter);
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

// ==========================
// Planet / Compliance / Evidence / Certificate
// ==========================
app.use("/api/planet", planetComplianceRouter);

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

app.listen(PORT, () => {
  console.log(`AEVION Globus Backend запущен на порту ${PORT}`);
});
