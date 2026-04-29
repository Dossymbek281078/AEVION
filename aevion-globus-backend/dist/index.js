"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const qright_1 = require("./routes/qright");
const qsign_1 = require("./routes/qsign");
const qtrade_1 = require("./routes/qtrade");
const auth_1 = require("./routes/auth");
const planetCompliance_1 = require("./routes/planetCompliance");
const modules_1 = require("./routes/modules");
const qcoreai_1 = require("./routes/qcoreai");
const quantum_shield_1 = require("./routes/quantum-shield");
const pipeline_1 = require("./routes/pipeline");
const coach_1 = require("./routes/coach");
const ecosystem_1 = require("./routes/ecosystem");
const qrightRoyalties_1 = require("./routes/qrightRoyalties");
const cyberchess_1 = require("./routes/cyberchess");
const projects_1 = require("./data/projects");
const moduleRuntime_1 = require("./data/moduleRuntime");
// Подключаем ТОЛЬКО QRight (он реально существует)
// (qrightRouter already imported above)
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
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
    const items = (0, moduleRuntime_1.enrichProjects)(projects_1.projects);
    res.json({
        items,
        total: items.length,
    });
});
app.get("/api/globus/projects/:id", (req, res) => {
    const project = projects_1.projects.find((p) => p.id === req.params.id);
    if (!project) {
        return res.status(404).json({ error: "Project not found" });
    }
    res.json((0, moduleRuntime_1.enrichProject)(project));
});
app.use("/api/modules", modules_1.modulesRouter);
app.use("/api/qcoreai", qcoreai_1.qcoreaiRouter);
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
                    summary: "Recent certified artifact versions (optional productKeyPrefix, artifactType, limit 1..50, sort=created|rating|votes)",
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
            "/api/qtrade/accounts/lookup": { get: { summary: "Resolve email → primary accountId (auth)" } },
            "/api/ecosystem/earnings": { get: { summary: "Aggregated earnings across qright/cyberchess/planet (auth)" } },
            "/api/qright/royalties": { get: { summary: "Paid royalties for caller (auth)" } },
            "/api/qright/royalties/verify-webhook": { post: { summary: "External rights body webhook (X-QRight-Secret)" } },
            "/api/cyberchess/results": { get: { summary: "Recent tournament prize wins for caller (auth)" } },
            "/api/cyberchess/upcoming": { get: { summary: "Public list of upcoming tournaments" } },
            "/api/cyberchess/tournament-finalized": { post: { summary: "Tournament finalized webhook (X-CyberChess-Secret)" } },
        },
    });
});
// ==========================
// QRight — патентирование
// ==========================
app.use("/api/qtrade", qtrade_1.qtradeRouter);
app.use("/api/qright", qright_1.qrightRouter);
// Royalties live alongside QRight authorship endpoints under /api/qright/*.
app.use("/api/qright", qrightRoyalties_1.qrightRoyaltiesRouter);
app.use("/api/ecosystem", ecosystem_1.ecosystemRouter);
app.use("/api/cyberchess", cyberchess_1.cyberchessRouter);
// ==========================
app.use("/api/qsign", qsign_1.qsignRouter);
// ==========================
// Quantum Shield
// ==========================
app.use("/api/quantum-shield", quantum_shield_1.quantumShieldRouter);
app.use("/api/pipeline", pipeline_1.pipelineRouter);
app.use("/api/coach", coach_1.coachRouter);
// ==========================
// Auth
// ==========================
app.use("/api/auth", auth_1.authRouter);
// ==========================
// Planet / Compliance / Evidence / Certificate
// ==========================
app.use("/api/planet", planetCompliance_1.planetComplianceRouter);
app.use((err, _req, res, _next) => {
    console.error("[express]", err);
    if (res.headersSent)
        return;
    res.status(500).json({ error: "internal_error" });
});
app.listen(PORT, () => {
    console.log(`AEVION Globus Backend запущен на порту ${PORT}`);
});
