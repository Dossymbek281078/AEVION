import { Router } from "express";
import { projects } from "../data/projects";
import {
  enrichProjects,
  getModuleRuntime,
  MODULE_RUNTIME,
} from "../data/moduleRuntime";

export const modulesRouter = Router();

/** Сводка по всем модулям + метаданные для дашбордов и ИИ-агентов */
modulesRouter.get("/status", (_req, res) => {
  const enriched = enrichProjects(projects);
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
modulesRouter.get("/:id/health", (req, res) => {
  const id = req.params.id;
  const known = MODULE_RUNTIME[id];
  if (!known) {
    return res.status(404).json({ ok: false, error: "unknown module id", id });
  }
  const openai = !!process.env.OPENAI_API_KEY?.trim();
  let message = "Registry entry healthy";
  if (id === "qcoreai") {
    message = openai ? "QCoreAI ready (OpenAI)" : "QCoreAI stub mode (no OPENAI_API_KEY)";
  } else if (id === "multichat-engine") {
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
modulesRouter.get("/:id/meta", (req, res) => {
  const id = req.params.id;
  if (!MODULE_RUNTIME[id]) {
    return res.status(404).json({ error: "unknown module", id });
  }
  res.json({ id, ...getModuleRuntime(id) });
});
