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
