import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 147 (18.10.2026). Замер на проде a74ae8b (390×844, dejstviya-390.mjs, кадр 844): shadownet — h1 389..527, первая
 * кнопка выбора угрозы на ~911 (герой с верхним полем 80 px и абзац на 4 строки до неё); z-tide — h1 350..440, поле
 * публичного поиска на ~1632 (полоса чисел и два графика до него). Порядок в разметке: действие → абзац/числа/графики;
 * верхнее поле героя на телефоне режет класс aevion-geroj-sekciya. Пиксели после выкатки меряет браузер на проде.
 */
const файл = (п: string) => readFileSync(join(process.cwd(), п), "utf8");

describe("147: shadownet и z-tide — действие гостя первым", () => {
  test("🔴 shadownet: герой с классом aevion-geroj-sekciya, абзац героя после выбора модели угроз", () => {
    const s = файл("src/app/shadownet/page.tsx");
    expect(s).toContain('<section className="aevion-geroj-sekciya" style={{ maxWidth: "1100px", margin: "0 auto", padding: "80px 20px 50px" }}>');
    expect(s.indexOf("Не реальный VPN")).toBeGreaterThan(s.indexOf("<ThreatModelSelector />"));
    const css = файл("src/app/globals.css");
    expect(css.slice(css.indexOf("/* 147 (18.10.2026)"))).toContain(".aevion-geroj-sekciya { padding-top: 24px !important;");
  });
  test("🔴 z-tide: публичный поиск первым в сетке графиков, графики раньше полосы чисел", () => {
    const ch = файл("src/app/z-tide/TideCharts.tsx");
    const сетка = ch.indexOf('<section className="mx-auto max-w-6xl px-5 pb-8 grid grid-cols-1 lg:grid-cols-2 gap-4">');
    expect(сетка).toBeGreaterThan(0);
    const поиск = ch.indexOf("<TideLookup />", сетка);
    const графики = ch.indexOf("Распределение по рангам", сетка);
    expect(поиск).toBeGreaterThan(сетка);
    expect(графики).toBeGreaterThan(поиск);
    expect(ch.split("<TideLookup />").length - 1).toBe(1);
    const p = файл("src/app/z-tide/page.tsx");
    expect(p.indexOf("<TideCharts />")).toBeLessThan(p.indexOf("{/* Stats strip */}"));
  });
});
