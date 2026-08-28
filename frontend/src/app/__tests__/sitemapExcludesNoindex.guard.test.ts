import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sitemap from "../sitemap";

/**
 * Страница с `robots: { index: false }` не должна попадать в карту сайта.
 *
 * Карта говорит Google «индексируй этот адрес», а страница — «не индексируй».
 * Два наших источника противоречат друг другу; какой победит, решает Google, и
 * решение это не в нашу пользу ни в одном из случаев.
 *
 * Замер 28.08.2026: таких было 23 — /acquire, почти весь личный кабинет /bank
 * (audit-log, income, settings, statement, notifications...), /pitch/print,
 * /pricing/affiliate-dashboard, /qmaskcard/dashboard.
 *
 * Решение по ним НЕ требовалось: его уже принял тот, кто написал
 * `index: false`. Карта просто про это не знала — фильтр был только по
 * DISALLOWED_PATHS из robots.ts, а он про каталоги, не про страницы.
 *
 * ПРОВЕРКА СКВОЗНАЯ: вызываем настоящую `sitemap()` и смотрим, что она вернула.
 * Разбор исходника доказывал бы только наличие строки фильтра, а не то, что
 * фильтр работает.
 */

const here = dirname(fileURLToPath(import.meta.url));
const APP = join(here, "..");

/** Страницы с `index: false` — у себя или у любого макета вверх по дереву. */
function noIndexRoutes(): string[] {
  const out: string[] = [];
  const declares = (f: string) => existsSync(f) && /index:\s*false/.test(readFileSync(f, "utf8"));
  const walk = (dir: string, segs: string[]) => {
    let names: string[];
    try { names = readdirSync(dir); } catch { return; }
    if (names.includes("page.tsx")) {
      const hit =
        declares(join(dir, "page.tsx")) ||
        segs.some((_, i) => declares(join(APP, ...segs.slice(0, i + 1), "layout.tsx"))) ||
        declares(join(APP, "layout.tsx"));
      if (hit) out.push("/" + segs.join("/"));
    }
    for (const n of names) {
      if (n === "node_modules" || n.startsWith(".") || n === "__tests__") continue;
      const p = join(dir, n);
      let st; try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) walk(p, [...segs, n]);
    }
  };
  walk(APP, []);
  return out;
}

describe("карта сайта не подаёт страницы, помеченные noindex", () => {
  // Обход каталога страниц делается ОДИН раз и вне it(). Под параллельной
  // нагрузкой (на машине бывает под 170 процессов node) он занимал 43 с при
  // пределе 30 и ронял сторожа — а сторож, который краснеет случайно, рано
  // или поздно отключают. Предел поднят здесь ОСОЗНАННО и только для сбора
  // данных; сами проверки остаются мгновенными.
  let entries: Awaited<ReturnType<typeof sitemap>> = [];
  let noindex: string[] = [];
  beforeAll(async () => {
    entries = await sitemap();
    noindex = noIndexRoutes();
  }, 180_000);

  it("проверка не пуста — иначе она ничего не доказывает", async () => {
    expect(entries.length, "карта пуста — обход сломан").toBeGreaterThan(100);
    expect(noindex.length, "не нашёл ни одной noindex-страницы — разбор сломан").toBeGreaterThan(5);
  });

  it("ни один noindex-адрес не попал в карту", async () => {
    const inMap = new Set(
      entries.map((e) => e.url.replace(/^https?:\/\/[^/]+/, "").replace(/\/+$/, "") || "/"),
    );
    const leaked = noindex
      .map((r) => r.replace(/\/+$/, "") || "/")
      .filter((r) => inMap.has(r));
    expect(leaked, `в карте оказались noindex-страницы: ${leaked.slice(0, 8).join(", ")}`).toEqual([]);
  });
});
