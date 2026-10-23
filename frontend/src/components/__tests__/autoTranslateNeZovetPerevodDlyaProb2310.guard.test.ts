import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isProbeVisit } from "../AutoTranslate";

/**
 * 23.10.2026: наши прогоны Playwright по en/kk-страницам с холодным кэшем перевода жгли вызовы Claude
 * (сводка бэка unknown=659 за 4 часа). Проба — не человек: живой перевод ей не нужен.
 * Признаки только явные: navigator.webdriver и метка ?c=probe-*.
 */
describe("AutoTranslate не зовёт живой перевод для наших проб", () => {
  it("isProbeVisit: webdriver → проба; ?c=probe-* → проба; обычный заход с меткой канала → нет", () => {
    expect(isProbeVisit({ webdriver: true }, "")).toBe(true);
    expect(isProbeVisit({ webdriver: false }, "?c=probe-user-99")).toBe(true);
    expect(isProbeVisit({ webdriver: false }, "?x=1&c=probe-product&lang=kk")).toBe(true);
    expect(isProbeVisit({ webdriver: false }, "?c=ig")).toBe(false);
    expect(isProbeVisit({ webdriver: false }, "?c=mail-outreach-w22-qsign")).toBe(false);
    expect(isProbeVisit(undefined, "")).toBe(false);
    // «probe» внутри другого слова метки — не наша проба (ключ строго probe-<окно>)
    expect(isProbeVisit({ webdriver: false }, "?c=microprobe-x")).toBe(false);
  });

  it("flush живого перевода проверяет признак пробы (исходник)", () => {
    const src = readFileSync(join(process.cwd(), "src/components/AutoTranslate.tsx"), "utf8");
    expect(src).toContain("const probeVisit = isProbeVisit();");
    expect(src).toMatch(/if \(destroyed \|\| inFlight \|\| pending\.size === 0 \|\| serviceLies \|\| probeVisit\) return;/);
    const i = src.indexOf("|| probeVisit) return;"), j = src.indexOf('fetch(apiUrl("/api/i18n/translate")');
    expect(i, "проверка пробы стоит раньше запроса перевода").toBeLessThan(j);
  });
});
