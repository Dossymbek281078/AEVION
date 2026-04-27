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
      "/api/pipeline/protect": { post: { summary: "One-click IP protection (QRight → QSign → Shield → Certificate). Body: { title, description, kind?, authorName? | ownerName?, authorEmail? | ownerEmail?, country?, city?, contentHash? (64-hex SHA-256 if caller pre-hashed a file) }" } },
      "/api/pipeline/protect-batch": { post: { summary: "Batch IP protection — same crypto as /protect, runs sequentially over items[] (max 25). Returns 207 Multi-Status if any item fails. Body: { items: ProtectInput[] }" } },
      "/api/pipeline/verify/{certId}": { get: { summary: "Public verification of an IP certificate" } },
      "/api/pipeline/verify/{certId}/log": { get: { summary: "Recent verify events for a cert (PII-safe IP hash + UA, newest first, default limit 100, max 500)" } },
      "/api/pipeline/certificates": { get: { summary: "Public registry — supports ?q, ?kind, ?sort (recent|popular|az), ?limit" } },
      "/api/pipeline/certificates.csv": { get: { summary: "Public registry as CSV (same filters as /certificates)" } },
      "/api/pipeline/certificate/{certId}/pdf": { get: { summary: "Printable PDF certificate with QR code" } },
      "/api/pipeline/bureau/stats": { get: { summary: "Aggregated Bureau dashboard: totals, by-kind, by-country, 30-day growth, latest" } },
      "/api/pipeline/bureau/anchor": { get: { summary: "Merkle root over all active certificate hashes — tamper-evident registry anchor" } },
      "/api/pipeline/bureau/proof/{certId}": { get: { summary: "Merkle inclusion proof for a certificate (leaf + path + root)" } },
      "/api/pipeline/bureau/snapshot.json": { get: { summary: "Full audit-friendly registry snapshot (certificates + anchor)" } },
      "/api/pipeline/lookup/{hash}": { get: { summary: "Reverse lookup — is this SHA-256 already protected in the AEVION registry?" } },
      "/api/pipeline/badge/{certId}": { get: { summary: "Embeddable SVG 'Protected by AEVION' badge" } },
      "/api/pipeline/health": { get: { summary: "Pipeline health & enabled crypto/legal steps" } },
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
