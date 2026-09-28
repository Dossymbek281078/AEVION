// Бейдж обязан попадать в ЗАГРУЖАЕМУЮ копию index.html и только бесплатным тарифам,
// а файлы проекта в базе остаются как их написал человек (иначе бейдж уедет в код,
// который он скачивает). Поведение самой вставки — tests/aevionBadge.test.ts.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const маршрут = readFileSync(join(__dirname, "..", "src", "routes", "devhub.ts"), "utf8");

describe("бейдж в пути публикации", () => {
  it("маршрут зовёт проверенные функции, а не свою копию", () => {
    expect(маршрут).toContain('from "../lib/aevionBadge"');
    expect(маршрут).toContain("нуженБейдж(pagesDeployCredit.tier)");
    expect(маршрут).toContain("вставитьБейдж(");
  });

  it("вставка идёт ДО загрузки в Cloudflare", () => {
    const iБейдж = маршрут.indexOf("нуженБейдж(pagesDeployCredit.tier)");
    const iЗагрузка = маршрут.indexOf("deployViaWrangler(", iБейдж);
    expect(iБейдж).toBeGreaterThan(0);
    expect(iЗагрузка).toBeGreaterThan(iБейдж);
  });

  it("грузится ОТДЕЛЬНАЯ копия файлов, а не те же объекты из базы", () => {
    expect(маршрут).toContain("const файлыКЗагрузке = files.map(");
    const i = маршрут.indexOf("deployViaWrangler(");
    expect(маршрут.slice(i, i + 120)).toContain("файлыКЗагрузке");
  });
});
