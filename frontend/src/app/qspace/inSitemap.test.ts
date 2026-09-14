import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * /qspace обязан попадать в карту сайта.
 *
 * Сторожа карты (sitemapPathsExist и родня) отвечают на ОБРАТНЫЙ вопрос —
 * «нет ли в карте мёртвых адресов». Они зелены и когда живой страницы в
 * карте нет вовсе: отсутствие в карту не попадает и потому молчит
 * (тот же класс, что feedback_comparison_cannot_catch_absence).
 *
 * Здесь проверяется наличие. Карта собирается обходом каталогов, поэтому
 * достаточно двух условий: страница на месте и она не помечена noindex.
 * Тест не ходит в сеть — иначе он краснел бы на недоступном бэкенде, а не
 * по делу.
 */
const APP = path.resolve(__dirname, "..");

describe("/qspace в карте сайта", () => {
  it("страница существует там, где её ищет обход каталогов", () => {
    const names = readdirSync(path.join(APP, "qspace"));
    expect(names).toContain("page.tsx");
  });

  it("страница НЕ помечена noindex — иначе выпадет из карты молча", () => {
    const src = readFileSync(path.join(APP, "qspace", "page.tsx"), "utf8");
    expect(/index:\s*false/.test(src)).toBe(false);
    // и layout не должен вносить noindex за неё
    const layout = readFileSync(path.join(APP, "qspace", "layout.tsx"), "utf8");
    expect(/index:\s*false/.test(layout)).toBe(false);
  });

  it("адрес не попадает под запреты robots", async () => {
    const { DISALLOWED_PATHS } = await import("../robots");
    const blocked = DISALLOWED_PATHS.some(
      (d: string) => "/qspace" === d || "/qspace".startsWith(d),
    );
    expect(blocked, "адрес /qspace закрыт в robots — в карте ему тогда не место").toBe(false);
    // контроль прибора: заведомо закрытый адрес обязан находиться
    expect(DISALLOWED_PATHS.length).toBeGreaterThan(0);
  });

  it("canonical страницы указывает на сам /qspace, а не на чужой адрес", () => {
    const src = readFileSync(path.join(APP, "qspace", "page.tsx"), "utf8");
    const m = /canonical:\s*"([^"]+)"/.exec(src);
    expect(m, "у страницы нет canonical").not.toBeNull();
    expect(m![1]).toMatch(/\/qspace$/);
  });
});
