import { describe, it, expect } from "vitest";

/**
 * Smoke-tests for Tier 3 amplifier endpoints (OG cards, sitemap, RSS, public
 * JSON, badges) across all 7 platform surfaces. We don't hit them — we just
 * confirm that the Express router has registered the expected paths so that
 * a stray refactor doesn't silently delete a public crawler-facing route.
 *
 * Each surface has a similar shape:
 *   GET /og.svg                 — index OG card (1200x630)
 *   GET /<id>/og.svg or /:certId/og.svg etc — per-entity OG card
 *   GET /sitemap.xml            — XML sitemap
 *   GET /<id>/badge.svg         — embeddable badge (when applicable)
 *
 * ⏱ Почему у тестов явный таймаут. Проверки почти ничего не делают — читают
 * `router.stack`. Но каждая начинается с `await import()` роутера, а тот тянет
 * половину графа модулей (Prisma-клиент, пул Postgres, обвязку). На загруженной
 * машине этот ИМПОРТ и съедает дефолтные 5 секунд: замерено 2026-07-26 — файл
 * шёл 20.3 с и ронял тест, при этом в изоляции проходит за 1.5 с, 8/8 дважды
 * подряд. То есть красный тест означал «машина занята», а не «роут потерян» —
 * самый вредный вид ложной тревоги. 30 секунд с запасом; если файл упрётся и в
 * них, проблема будет уже настоящей.
 */

const IMPORT_TIMEOUT_MS = 30_000;

type Layer = { route?: { path?: string } };
function paths(router: any): string[] {
  const stack = (router.stack ?? []) as Layer[];
  return stack
    .filter((l) => l.route?.path)
    .map((l) => l.route!.path!)
    .filter(Boolean);
}

function expectRegistered(router: any, requiredPaths: string[]) {
  const registered = paths(router);
  for (const p of requiredPaths) {
    expect(registered, `missing route: ${p}`).toContain(p);
  }
}

describe("Tier 3 amplifier endpoints — router shape", () => {
  it("modulesRouter exposes registry OG/sitemap + per-module OG/badge", async () => {
    const { modulesRouter } = await import("../src/routes/modules");
    expectRegistered(modulesRouter, [
      "/og.svg",
      "/sitemap.xml",
      "/:id/og.svg",
      "/:id/badge.svg",
    ]);
  }, IMPORT_TIMEOUT_MS);

  it("bureauRouter exposes index OG/sitemap + per-cert OG/badge", async () => {
    const { bureauRouter } = await import("../src/routes/bureau");
    expectRegistered(bureauRouter, [
      "/og.svg",
      "/sitemap.xml",
      "/cert/:certId/og.svg",
      "/cert/:certId/badge.svg",
    ]);
  }, IMPORT_TIMEOUT_MS);

  it("awardsRouter exposes index OG/sitemap + per-entry OG/badge", async () => {
    const { awardsRouter } = await import("../src/routes/awards");
    expectRegistered(awardsRouter, [
      "/og.svg",
      "/sitemap.xml",
      "/entries/:entryId/og.svg",
      "/entries/:entryId/badge.svg",
    ]);
  }, IMPORT_TIMEOUT_MS);

  it("pipelineRouter exposes index OG/sitemap + per-cert OG", async () => {
    const { pipelineRouter } = await import("../src/routes/pipeline");
    expectRegistered(pipelineRouter, [
      "/og.svg",
      "/sitemap.xml",
      "/certificate/:certId/og.svg",
    ]);
  }, IMPORT_TIMEOUT_MS);

  it("quantumShieldRouter exposes index OG/sitemap + per-shield OG", async () => {
    const { quantumShieldRouter } = await import("../src/routes/quantum-shield");
    expectRegistered(quantumShieldRouter, [
      "/og.svg",
      "/sitemap.xml",
      "/:id/og.svg",
    ]);
  }, IMPORT_TIMEOUT_MS);

  it("qrightRouter exposes index OG/sitemap + per-object badge", async () => {
    const { qrightRouter } = await import("../src/routes/qright");
    expectRegistered(qrightRouter, [
      "/og.svg",
      "/sitemap.xml",
      "/badge/:id.svg",
    ]);
  }, IMPORT_TIMEOUT_MS);

  it("planetComplianceRouter exposes index OG/sitemap + per-cert OG/badge", async () => {
    const { planetComplianceRouter } = await import("../src/routes/planetCompliance");
    expectRegistered(planetComplianceRouter, [
      "/og.svg",
      "/sitemap.xml",
      "/certificates/:certId/og.svg",
      "/certificates/:certId/badge.svg",
    ]);
  }, IMPORT_TIMEOUT_MS);

  it("aevionHubRouter exposes platform-wide sitemap", async () => {
    const { aevionHubRouter } = await import("../src/routes/aevion-hub");
    expectRegistered(aevionHubRouter, ["/sitemap.xml"]);
  }, IMPORT_TIMEOUT_MS);
});
