import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";

/**
 * Сторож: у каждой СЕРВЕРНОЙ страницы, рисующей <PaywallScreen>, в цепочке
 * макетов маршрута есть ServerLangProvider (30.10.2026).
 *
 * ЗАЧЕМ. Стена берёт язык кадра из I18nProvider, который на сервере и до
 * гидрации держит «en». Пока провайдер не готов, стена читает язык серверного
 * макета (ServerLangProvider ← serverLang: кука → Accept-Language → ru). Без
 * макета SSR-HTML стены для русского гостя английский, затем перерисовка —
 * вспышка перед оплатой (замечание Продукта к fix/paywall-screen-lang-3010,
 * страницы healthai, longevity, multichat-engine, qcoreai, qmelanin, qrenew,
 * qskyway, smeta-trainer). Клиентские страницы («use client») стену рисуют
 * после запроса в браузере — язык к тому моменту определён, им макет не нужен.
 */

const APP = join(__dirname, "..");

function* страницы(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === "__tests__" || name === "node_modules") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* страницы(full);
    else if (name === "page.tsx") yield full;
  }
}

function клиентская(code: string): boolean {
  return /^\s*["']use client["']/m.test(code.slice(0, 400));
}

function макетыДают(pageFile: string): boolean {
  let dir = dirname(pageFile);
  while (dir.length >= APP.length) {
    const layout = join(dir, "layout.tsx");
    if (existsSync(layout) && /ServerLangProvider/.test(readFileSync(layout, "utf8"))) return true;
    if (dir === APP) break;
    dir = dirname(dir);
  }
  return false;
}

describe("серверные страницы со стеной отдают язык первого кадра", () => {
  const серверные = [...страницы(APP)].filter((f) => {
    const code = readFileSync(f, "utf8");
    return /<PaywallScreen\b/.test(code) && !клиентская(code);
  });

  it("КОНТРОЛЬ: сторож видит серверные страницы со стеной", () => {
    const имена = серверные.map((f) => relative(APP, dirname(f)).replace(/\\/g, "/"));
    expect(имена).toContain("qcoreai");
    expect(имена).toContain("healthai");
    expect(имена.length).toBeGreaterThanOrEqual(8);
  });

  it("у каждой — ServerLangProvider в макете маршрута", () => {
    const без = серверные
      .filter((f) => !макетыДают(f))
      .map((f) => relative(APP, f).replace(/\\/g, "/"));
    expect(
      без,
      "Эти серверные страницы рисуют <PaywallScreen>, но ни один layout.tsx над ними не даёт ServerLangProvider — "
        + "SSR-кадр стены для русского гостя будет английским. Образец: app/longevity/layout.tsx.",
    ).toEqual([]);
  });
});
