"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.modulesRouter = void 0;
const express_1 = require("express");
const projects_1 = require("../data/projects");
const moduleRuntime_1 = require("../data/moduleRuntime");
exports.modulesRouter = (0, express_1.Router)();
/** Сводка по всем модулям + метаданные для дашбордов и ИИ-агентов */
exports.modulesRouter.get("/status", (_req, res) => {
    const enriched = (0, moduleRuntime_1.enrichProjects)(projects_1.projects);
    const byTier = {
        mvp_live: enriched.filter((x) => x.runtime.tier === "mvp_live").length,
        platform_api: enriched.filter((x) => x.runtime.tier === "platform_api").length,
        portal_only: enriched.filter((x) => x.runtime.tier === "portal_only").length,
    };
    res.json({
        generatedAt: new Date().toISOString(),
        total: enriched.length,
        byTier,
        items: enriched,
    });
});
/** Быстрый health одного модуля (без нагрузки на БД — для оркестрации) */
exports.modulesRouter.get("/:id/health", (req, res) => {
    const id = req.params.id;
    const known = moduleRuntime_1.MODULE_RUNTIME[id];
    if (!known) {
        return res.status(404).json({ ok: false, error: "unknown module id", id });
    }
    const openai = !!process.env.OPENAI_API_KEY?.trim();
    let message = "Registry entry healthy";
    if (id === "qcoreai") {
        message = openai ? "QCoreAI ready (OpenAI)" : "QCoreAI stub mode (no OPENAI_API_KEY)";
    }
    else if (id === "multichat-engine") {
        message = "UI bridge; chat via POST /api/qcoreai/chat";
    }
    res.json({
        ok: true,
        id,
        tier: known.tier,
        primaryPath: known.primaryPath,
        stub: false,
        openaiConfigured: id === "qcoreai" || id === "multichat-engine" ? openai : undefined,
        message,
        checkedAt: new Date().toISOString(),
    });
});
/** На случай опечатки в пути — дублируем по registry id */
exports.modulesRouter.get("/:id/meta", (req, res) => {
    const id = req.params.id;
    if (!moduleRuntime_1.MODULE_RUNTIME[id]) {
        return res.status(404).json({ error: "unknown module", id });
    }
    res.json({ id, ...(0, moduleRuntime_1.getModuleRuntime)(id) });
});
