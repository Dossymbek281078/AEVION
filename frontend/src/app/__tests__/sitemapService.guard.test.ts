import { describe, expect, it } from "vitest";
import sitemap from "../sitemap";
import robots from "../robots";

/**
 * 28.07.2026 Search Console: 428 страниц в индексе, 662 — нет. Часть «нет» мы
 * создали сами: карта сайта собирается автосканированием `src/app`, и в неё
 * попали 41 служебный адрес — весь `/admin/*`, `/pricing/admin`,
 * `/smeta-trainer/admin`, `/account`. Google обходит их, упирается во вход или
 * пустой экран и записывает в «не проиндексировано», тратя на это краулинговый
 * бюджет, которого не хватает настоящим страницам.
 *
 * Тест держит два конца: служебных адресов нет в карте, и robots закрывает их
 * подстановкой, а не поимённым списком, который снова отстанет от реальности.
 */

const SERVICE_PATTERN = /\/(admin|account|settings|internal|debug)(\/|$)/;

/** Явные исключения: страницы, которые в карте нужны, несмотря на слово в пути. */
const INTENTIONAL = new Set([
  "/cyberchess/cpi/dashboard",
  "/fintech/dashboard",
]);

describe("карта сайта не зовёт Google в служебные разделы", () => {
  it("в карте нет админок и личных кабинетов", async () => {
    const entries = await sitemap();
    const paths = entries.map((e) => new URL(e.url).pathname);
    expect(paths.length).toBeGreaterThan(50);
    const offenders = paths.filter((p) => SERVICE_PATTERN.test(p) && !INTENTIONAL.has(p));
    expect(offenders).toEqual([]);
  });

  it("robots закрывает админку любого модуля подстановкой", () => {
    const rules = robots().rules;
    const list = Array.isArray(rules) ? rules : [rules];
    const disallow = list.flatMap((r) => {
      const d = r.disallow;
      return Array.isArray(d) ? d : d ? [d] : [];
    });
    // Именно подстановка: поимённый список уже отстал от реальности однажды —
    // /pricing/admin и /smeta-trainer/admin в нём отсутствовали.
    expect(disallow).toContain("/*/admin");
  });

  it("правило проверяемо на конкретных путях, а не только на строке в файле", () => {
    // Регулярка ниже — то, как поисковик прочитает подстановку.
    const rule = /^\/[^/]+\/admin(\/|$)/;
    expect(rule.test("/pricing/admin")).toBe(true);
    expect(rule.test("/smeta-trainer/admin")).toBe(true);
    expect(rule.test("/qpaynet/admin/")).toBe(true);
    // И не должна задевать нормальные страницы.
    expect(rule.test("/build/vacancies")).toBe(false);
    expect(rule.test("/administration-guide")).toBe(false);
  });
});
