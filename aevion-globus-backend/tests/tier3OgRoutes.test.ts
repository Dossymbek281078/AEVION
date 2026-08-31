import { describe, it, expect, vi, beforeAll } from "vitest";

// 60 с вместо общих 30. Первый случай здесь динамически импортирует
// `src/routes/modules`, а тот тянет весь реестр модулей и `opentimestamps` —
// на холодном кэше Vite это самая тяжёлая трансформация во всём наборе.
// Замеры 10–11.08.2026: файл в одиночку проходит за 1.4 с, а в общем прогоне
// сразу после правки конфигов (то есть на сброшенном кэше) дважды упёрся в
// 30 с и покраснел. Ограничение воркеров это ослабило, но не убрало.
//
// Это цена честного импорта настоящего роутера, а не мока, — и платить её
// правильнее временем, чем красным набором, который перестают читать.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

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
 */

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
  /*
   * ⚠️ 31.08.2026: загрузка роутеров вынесена в ОДИН разогрев.
   *
   * Раньше каждый случай делал свой `await import(...)` — семь раз тянул
   * граф зависимостей роутера. Под нагрузкой (на машине бывает под 170
   * процессов node от всех вкладок) первая такая загрузка не укладывалась в
   * предел, и файл падал по таймауту 60 с. В одиночку он проходит — то есть
   * красное здесь описывало занятость машины, а не маршруты.
   *
   * Поднимать предел не стали: это уже делали у соседнего теста дважды и не
   * помогло, потому что лечили не причину. Цена загрузки платится один раз,
   * случаи после этого мгновенные.
   *
   * Разогреву дан свой запас времени: он делает всю тяжёлую работу файла.
   */
  const роутеры: Record<string, any> = {};

  beforeAll(async () => {
    роутеры["modulesRouter"] = (await import("../src/routes/modules")).modulesRouter;
    роутеры["bureauRouter"] = (await import("../src/routes/bureau")).bureauRouter;
    роутеры["awardsRouter"] = (await import("../src/routes/awards")).awardsRouter;
    роутеры["pipelineRouter"] = (await import("../src/routes/pipeline")).pipelineRouter;
    роутеры["quantumShieldRouter"] = (await import("../src/routes/quantum-shield")).quantumShieldRouter;
    роутеры["qrightRouter"] = (await import("../src/routes/qright")).qrightRouter;
    роутеры["planetComplianceRouter"] = (await import("../src/routes/planetCompliance")).planetComplianceRouter;
    роутеры["aevionHubRouter"] = (await import("../src/routes/aevion-hub")).aevionHubRouter;

    // Контроль охвата: пустой разогрев сделал бы все случаи зелёными на
    // пустых списках маршрутов — то есть проверка молчала бы о чём угодно.
    expect(Object.keys(роутеры).length, "разогрев не загрузил роутеры").toBe(8);
  }, 120_000);


  it("modulesRouter exposes registry OG/sitemap + per-module OG/badge", async () => {
    const modulesRouter = роутеры["modulesRouter"];
    expectRegistered(modulesRouter, [
      "/og.svg",
      "/sitemap.xml",
      "/:id/og.svg",
      "/:id/badge.svg",
    ]);
  });

  it("bureauRouter exposes index OG/sitemap + per-cert OG/badge", async () => {
    const bureauRouter = роутеры["bureauRouter"];
    expectRegistered(bureauRouter, [
      "/og.svg",
      "/sitemap.xml",
      "/cert/:certId/og.svg",
      "/cert/:certId/badge.svg",
    ]);
  });

  it("awardsRouter exposes index OG/sitemap + per-entry OG/badge", async () => {
    const awardsRouter = роутеры["awardsRouter"];
    expectRegistered(awardsRouter, [
      "/og.svg",
      "/sitemap.xml",
      "/entries/:entryId/og.svg",
      "/entries/:entryId/badge.svg",
    ]);
  });

  it("pipelineRouter exposes index OG/sitemap + per-cert OG", async () => {
    const pipelineRouter = роутеры["pipelineRouter"];
    expectRegistered(pipelineRouter, [
      "/og.svg",
      "/sitemap.xml",
      "/certificate/:certId/og.svg",
    ]);
  });

  it("quantumShieldRouter exposes index OG/sitemap + per-shield OG", async () => {
    const quantumShieldRouter = роутеры["quantumShieldRouter"];
    expectRegistered(quantumShieldRouter, [
      "/og.svg",
      "/sitemap.xml",
      "/:id/og.svg",
    ]);
  });

  it("qrightRouter exposes index OG/sitemap + per-object badge", async () => {
    const qrightRouter = роутеры["qrightRouter"];
    expectRegistered(qrightRouter, [
      "/og.svg",
      "/sitemap.xml",
      "/badge/:id.svg",
    ]);
  });

  it("planetComplianceRouter exposes index OG/sitemap + per-cert OG/badge", async () => {
    const planetComplianceRouter = роутеры["planetComplianceRouter"];
    expectRegistered(planetComplianceRouter, [
      "/og.svg",
      "/sitemap.xml",
      "/certificates/:certId/og.svg",
      "/certificates/:certId/badge.svg",
    ]);
  });

  it("aevionHubRouter exposes platform-wide sitemap", async () => {
    const aevionHubRouter = роутеры["aevionHubRouter"];
    expectRegistered(aevionHubRouter, ["/sitemap.xml"]);
  });
});
