import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 24.10.2026 00:32: сайт bf5b867a0 упал на Vercel через 2 мин сборки («use client» после import) при зелёных tsc и vitest.
 * Решение оркестратора: локальный `next build` — постоянные ворота обёртки выкатки сайта (frontend/scripts/vercel-deploy.sh),
 * ПОСЛЕ tsc и ДО `vercel deploy`; пропуск только явный (SKIP_NEXT_BUILD=1 с предупреждением), падение сборки — остановка.
 * Сторож держит ворота на месте: порядок шагов и три обязательных ветки (пропуск вслух, остановка при падении, уборка .next).
 */
const script = readFileSync(join(process.cwd(), "scripts", "vercel-deploy.sh"), "utf8");

describe("vercel-deploy.sh гоняет локальный next build перед загрузкой на Vercel", () => {
  it("ворота стоят после tsc и до vercel deploy", () => {
    const iTsc = script.indexOf('./node_modules/.bin/tsc --noEmit');
    const iBuild = script.indexOf("./node_modules/.bin/next build");
    const iDeploy = script.indexOf("npx vercel deploy --prod");
    expect(iTsc, "шаг tsc").toBeGreaterThan(-1);
    expect(iBuild, "шаг next build").toBeGreaterThan(iTsc);
    expect(iDeploy, "шаг vercel deploy").toBeGreaterThan(iBuild);
  });

  it("пропуск — только явный и вслух; падение сборки — остановка; .next убирается", () => {
    expect(script).toMatch(/SKIP_NEXT_BUILD:-0.*= "1"/);
    expect(script).toMatch(/next build ПРОПУЩЕН/);
    expect(script).toMatch(/ОСТАНОВКА: локальный next build упал/);
    expect(script.match(/rm -rf \.next/g)?.length ?? 0, "уборка .next (успех и падение)").toBeGreaterThanOrEqual(2);
  });

  it("КОНТРОЛЬ: скрипт без шага сборки сторож бы не пропустил", () => {
    const stripped = script.replace("./node_modules/.bin/next build", "./node_modules/.bin/next lint");
    expect(stripped.indexOf("./node_modules/.bin/next build")).toBe(-1);
  });
});
