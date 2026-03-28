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
        },
    });
});
// ==========================
// QRight — патентирование
// ==========================
app.use("/api/qtrade", qtrade_1.qtradeRouter);
app.use("/api/qright", qright_1.qrightRouter);
// ==========================
app.use("/api/qsign", qsign_1.qsignRouter);
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
