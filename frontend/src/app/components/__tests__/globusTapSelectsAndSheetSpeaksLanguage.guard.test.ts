import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Глобус на главной, замер 27.10.2026 на проде (globus-klik.mjs, сетка 7×7):
 * 1) касание по глобусу не открывало панель страны — 0/49 на 390: выбор брал страну из последнего
 *    наведения, а у касания наведения нет. Теперь при отпускании без перетаскивания цель берётся
 *    по точке нажатия (updateHover до чтения labelRef/hoveredCountryRef).
 * 2) панель страны на ru/kk была по-английски: «1 NODE · 1.9% of ecosystem», «Country sheet».
 */
const src = readFileSync(join(__dirname, "..", "Globus3D.tsx"), "utf8");

describe("глобус: касание выбирает страну", () => {
  it("в onPointerUp updateHover по точке нажатия стоит до чтения labelRef", () => {
    const up = src.slice(src.indexOf("const onPointerUp"), src.indexOf("const onWheel"));
    expect(up.length).toBeGreaterThan(100);
    const tap = up.indexOf("updateHover(ev.clientX, ev.clientY)");
    const label = up.indexOf("const cur = labelRef.current");
    expect(tap, "updateHover в onPointerUp").toBeGreaterThan(-1);
    expect(label).toBeGreaterThan(tap);
  });
});

describe("глобус: панель страны на языке сайта", () => {
  it("английские подписи панели только в ветке en словаря sheetText", () => {
    const sheet = src.slice(src.indexOf("data-country-sheet"), src.indexOf("data-country-sheet") + 9000);
    for (const s of ["of ecosystem", "No AEVION nodes", '"node"', '"nodes"', '"Clear country filter"', '"Category breakdown"', "Country sheet:"]) {
      expect(sheet, s).not.toContain(s);
    }
  });

  it("у sheetText есть ru и kk", () => {
    const fn = src.slice(src.indexOf("function sheetText"), src.indexOf("function displayCountry"));
    expect(fn).toContain('locale === "ru"');
    expect(fn).toContain('locale === "kk"');
    expect(fn).toContain("узлов");
    expect(fn).toContain("түйін");
  });
});
