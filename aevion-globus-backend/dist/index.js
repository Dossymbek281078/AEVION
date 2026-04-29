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
const planetPayouts_1 = require("./routes/planetPayouts");
const openapiSpec_1 = require("./lib/openapiSpec");
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
/** OpenAPI 3.1 spec — full schemas + examples for bank-track routes,
 *  summary-only for legacy globus / qsign. See lib/openapiSpec.ts. */
app.get("/api/openapi.json", (_req, res) => {
    res.json(openapiSpec_1.openapiSpec);
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
app.use("/api/planet", planetPayouts_1.planetPayoutsRouter);
app.use((err, _req, res, _next) => {
    console.error("[express]", err);
    if (res.headersSent)
        return;
    res.status(500).json({ error: "internal_error" });
});
app.listen(PORT, () => {
    console.log(`AEVION Globus Backend запущен на порту ${PORT}`);
});
