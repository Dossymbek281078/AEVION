import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Два места, где английские слова живут дольше всего, потому что их не видно
 * при обычном обходе страницы:
 *
 *  1. названия тем доски — они уходят в title и aria-label, то есть их
 *     читает и человек, и экранный диктор;
 *  2. МЕТАДАННЫЕ страницы (layout, og-картинка) — вкладка браузера, сниппет
 *     поисковика, превью в мессенджере. Свип по видимому тексту их не видит
 *     принципиально.
 *
 * Замер 01.09.2026: после перевода всего видимого «AI-коуч» остался ровно
 * в метаданных — 5 мест, включая заголовок вкладки.
 */

const ЧИТ = (...путь: string[]) => readFileSync(join(__dirname, "..", ...путь), "utf8");

describe("темы доски и метаданные по-русски", () => {
  it("у каждой темы доски русское название", () => {
    const код = ЧИТ("page.tsx");
    const i = код.indexOf("const BOARD_THEMES");
    expect(i).toBeGreaterThan(0);
    const блок = код.slice(i, код.indexOf("];", i));
    const имена = [...блок.matchAll(/name:"([^"]+)"/g)].map((m) => m[1]);
    // контроль охвата: тем действительно много, правило не про пустоту
    expect(имена.length).toBeGreaterThanOrEqual(8);
    const латиница = имена.filter((n) => n !== "AEVION" && !/[А-Яа-яЁё]/.test(n));
    expect(латиница).toEqual([]);
  });

  it("в заголовке вкладки и превью — «ИИ», а не «AI»", () => {
    for (const файл of ["layout.tsx", "opengraph-image.tsx"]) {
      const т = ЧИТ(файл);
      expect(т, `${файл}: «AI-коуч» виден в браузере и в поиске`).not.toContain("AI-коуч");
      expect(т).toContain("ИИ-коуч");
    }
  });
});
