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
import { ecosystemRouter } from "./routes/ecosystem";
import { qrightRoyaltiesRouter } from "./routes/qrightRoyalties";
import { cyberchessRouter } from "./routes/cyberchess";
import { planetPayoutsRouter } from "./routes/planetPayouts";
import { bankTestRouter } from "./routes/bankTest";
import { metricsRouter } from "./routes/metrics";
import { initSentry, captureException, isSentryEnabled } from "./lib/sentry";
import { openapiSpec } from "./lib/openapiSpec";
import { projects } from "./data/projects";
import { enrichProject, enrichProjects } from "./data/moduleRuntime";

// Подключаем ТОЛЬКО QRight (он реально существует)
// (qrightRouter already imported above)

// Optional Sentry. No-op when SENTRY_DSN is unset OR @sentry/node missing.
initSentry();

const app = express();
const PORT = process.env.PORT || 4001;

// CORS: if CORS_ALLOWED_ORIGINS is set (comma-separated), only those
// origins can call. Otherwise we keep the test-net default of fully
// permissive CORS so dev + investor demos work without env wiring.
function buildCorsOptions(): cors.CorsOptions {
  const raw = process.env.CORS_ALLOWED_ORIGINS;
  if (!raw || !raw.trim()) return {};
  const allowed = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // same-origin / curl / server-to-server
      if (allowed.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not in CORS_ALLOWED_ORIGINS`));
    },
    credentials: true,
  };
}

const corsOptions = buildCorsOptions();
app.use(cors(corsOptions));
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

/** OpenAPI 3.1 spec — full schemas + examples for bank-track routes,
 *  summary-only for legacy globus / qsign. See lib/openapiSpec.ts. */
app.get("/api/openapi.json", (_req, res) => {
  res.json(openapiSpec);
});

// ==========================
// QRight — патентирование
// ==========================
app.use("/api/qtrade", qtradeRouter);
app.use("/api/qright", qrightRouter);
// Royalties live alongside QRight authorship endpoints under /api/qright/*.
app.use("/api/qright", qrightRoyaltiesRouter);
app.use("/api/ecosystem", ecosystemRouter);
app.use("/api/cyberchess", cyberchessRouter);

// ==========================
app.use("/api/qsign", qsignRouter);

// ==========================
// Quantum Shield
// ==========================
app.use("/api/quantum-shield", quantumShieldRouter);
app.use("/api/pipeline", pipelineRouter);
app.use("/api/coach", coachRouter);
// ==========================
// Auth
// ==========================
app.use("/api/auth", authRouter);

// ==========================
// Planet / Compliance / Evidence / Certificate
// ==========================
app.use("/api/planet", planetComplianceRouter);
app.use("/api/planet", planetPayoutsRouter);

// Internal: synthetic webhook dispatcher used by /bank/diagnostics.
// Every route is requireAuth + scopes the synthesized event to the caller.
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

app.listen(PORT, () => {
  const corsNote = process.env.CORS_ALLOWED_ORIGINS
    ? ` (cors restricted)`
    : ` (cors open)`;
  console.log(
    `AEVION Globus Backend запущен на порту ${PORT}` +
      (isSentryEnabled() ? " (sentry on)" : "") +
      corsNote,
  );
});
