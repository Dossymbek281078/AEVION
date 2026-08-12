import { describe, it, expect } from "vitest";
import { modulesRouter } from "../src/routes/modules";
import { bureauRouter } from "../src/routes/bureau";
import { awardsRouter } from "../src/routes/awards";
import { pipelineRouter } from "../src/routes/pipeline";
import { quantumShieldRouter } from "../src/routes/quantum-shield";
import { qrightRouter } from "../src/routes/qright";
import { planetComplianceRouter } from "../src/routes/planetCompliance";
import { aevionHubRouter } from "../src/routes/aevion-hub";

/*
 * Роутеры импортируются статически, а не через `await import()` внутри теста.
 *
 * В полном прогоне этот файл регулярно падал первым тестом с «Test timed out in
 * 10000ms» — не на проверке, а на самом импорте: холодная загрузка роутера под
 * нагрузкой сотни других файлов не влезает в таймаут теста, и стоимость загрузки
 * записывалась тесту. При статическом импорте она уходит в фазу трансформации.
 *
 * Та же болезнь и то же лекарство: checkoutZeroPrice (3fb80dc7d), tiktok
 * publisher, и мои шахматные наборы за 12.08. Красный набор, который краснеет
 * не по делу, перестают читать — а с ним перестают замечать и настоящие
 * падения.
 */

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
  it("modulesRouter exposes registry OG/sitemap + per-module OG/badge", async () => {
    expectRegistered(modulesRouter, [
      "/og.svg",
      "/sitemap.xml",
      "/:id/og.svg",
      "/:id/badge.svg",
    ]);
  });

  it("bureauRouter exposes index OG/sitemap + per-cert OG/badge", async () => {
    expectRegistered(bureauRouter, [
      "/og.svg",
      "/sitemap.xml",
      "/cert/:certId/og.svg",
      "/cert/:certId/badge.svg",
    ]);
  });

  it("awardsRouter exposes index OG/sitemap + per-entry OG/badge", async () => {
    expectRegistered(awardsRouter, [
      "/og.svg",
      "/sitemap.xml",
      "/entries/:entryId/og.svg",
      "/entries/:entryId/badge.svg",
    ]);
  });

  it("pipelineRouter exposes index OG/sitemap + per-cert OG", async () => {
    expectRegistered(pipelineRouter, [
      "/og.svg",
      "/sitemap.xml",
      "/certificate/:certId/og.svg",
    ]);
  });

  it("quantumShieldRouter exposes index OG/sitemap + per-shield OG", async () => {
    expectRegistered(quantumShieldRouter, [
      "/og.svg",
      "/sitemap.xml",
      "/:id/og.svg",
    ]);
  });

  it("qrightRouter exposes index OG/sitemap + per-object badge", async () => {
    expectRegistered(qrightRouter, [
      "/og.svg",
      "/sitemap.xml",
      "/badge/:id.svg",
    ]);
  });

  it("planetComplianceRouter exposes index OG/sitemap + per-cert OG/badge", async () => {
    expectRegistered(planetComplianceRouter, [
      "/og.svg",
      "/sitemap.xml",
      "/certificates/:certId/og.svg",
      "/certificates/:certId/badge.svg",
    ]);
  });

  it("aevionHubRouter exposes platform-wide sitemap", async () => {
    expectRegistered(aevionHubRouter, ["/sitemap.xml"]);
  });
});
