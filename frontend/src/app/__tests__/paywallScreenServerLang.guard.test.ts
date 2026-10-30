import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";

/**
 * Сторож: каждая СЕРВЕРНАЯ страница со стеной рисует её через
 * <ServerPaywallScreen> — с языком первого кадра, и ни один layout.tsx над ней
 * не держит force-dynamic ради языка (30.10.2026).
 *
 * ЗАЧЕМ. Стена берёт язык кадра из I18nProvider, который на сервере и до
 * гидрации держит «en». Пока провайдер не готов, стена читает язык из
 * ServerLangProvider (serverLang: кука → Accept-Language → ru). Без него SSR-HTML
 * стены для русского гостя английский, затем перерисовка — вспышка перед оплатой.
 * Первая починка (8b02151ce) ставила провайдер в layout.tsx с force-dynamic — и
 * всё поддерево уходило с CDN на рендер (smeta-trainer ~330 страниц, qcoreai ~48;
 * вычитка Продукта). ServerPaywallScreen решает язык только на ветке со стеной.
 * Клиентские страницы («use client») рисуют стену после запроса в браузере — им
 * обёртка не нужна (язык — document.lang, см. PaywallScreen).
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

function макетыСForceDynamic(pageFile: string): string[] {
  const найдено: string[] = [];
  let dir = dirname(pageFile);
  while (dir.length >= APP.length) {
    const layout = join(dir, "layout.tsx");
    if (existsSync(layout)) {
      const code = readFileSync(layout, "utf8");
      if (/ServerLangProvider/.test(code) && /force-dynamic/.test(code)) {
        найдено.push(relative(APP, layout).replace(/\\/g, "/"));
      }
    }
    if (dir === APP) break;
    dir = dirname(dir);
  }
  return найдено;
}

describe("серверные страницы со стеной отдают язык первого кадра", () => {
  const серверные = [...страницы(APP)].filter((f) => {
    const code = readFileSync(f, "utf8");
    return /<(Server)?PaywallScreen\b/.test(code) && !клиентская(code);
  });

  it("КОНТРОЛЬ: сторож видит серверные страницы со стеной", () => {
    const имена = серверные.map((f) => relative(APP, dirname(f)).replace(/\\/g, "/"));
    expect(имена).toContain("qcoreai");
    expect(имена).toContain("healthai");
    expect(имена.length).toBeGreaterThanOrEqual(8);
  });

  it("каждая рисует стену через ServerPaywallScreen, а не голый PaywallScreen", () => {
    const голые = серверные
      .filter((f) => /<PaywallScreen\b/.test(readFileSync(f, "utf8")))
      .map((f) => relative(APP, f).replace(/\\/g, "/"));
    expect(
      голые,
      "Эти серверные страницы рисуют <PaywallScreen> без серверного языка — SSR-кадр стены для русского гостя "
        + "будет английским. Замените на <ServerPaywallScreen> из @/components/ServerPaywallScreen.",
    ).toEqual([]);
  });

  it("ни один макет над ними не делает поддерево динамическим ради языка", () => {
    const макеты = [...new Set(серверные.flatMap(макетыСForceDynamic))];
    expect(
      макеты,
      "layout.tsx с ServerLangProvider и force-dynamic снимает с CDN все страницы маршрута — язык стены даёт "
        + "ServerPaywallScreen на самой странице.",
    ).toEqual([]);
  });
});
