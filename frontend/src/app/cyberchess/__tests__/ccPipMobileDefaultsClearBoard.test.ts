// PiP-окно (WorkspacePiP) на телефоне при ПЕРВОМ показе не должно накрывать доску:
// замер 15.09.2026 на 390px — дефолт 320×180 в углу (24,24) занимал почти всю ширину и
// верх экрана. Теперь при отсутствии сохранённых значений и ширине <769 (порог BottomNav)
// окно стартует минимальным (240×135) внизу справа над навом (запас 100px). Сохранённые
// пользователем позиция/размер главнее — ветка только при `!raw`.
// Граница честная: сторож ИСХОДНИКА (форма); что окно реально ниже доски — браузером.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "WorkspacePiP.tsx"), "utf8");
const pos = src.slice(src.indexOf("function loadPos"), src.indexOf("function loadSize"));
const size = src.slice(src.indexOf("function loadSize"), src.indexOf("function clampToViewport"));

describe("PiP на телефоне стартует под доской, малым, над навом", () => {
  // Числа закреплены арифметикой замера 15.09.2026 (390×844, доска y 302..638):
  // 844 − 88 − 113 = 643 > 638. Первая редакция (240×135, зазор 100) давала верх на 609
  // и накрывала d1–h1 — сторож на неё был зелёным, потому что не закреплял ЧИСЛА.
  it("константы: 200×113 и зазор 88 (не 240×135 / 100)", () => {
    expect(src).toMatch(/const MOBILE_SIZE = \{ w: 200, h: 113 \}/);
    expect(src).toMatch(/const MOBILE_NAV_CLEAR = 88/);
  });
  it("loadPos: мобильная ветка при отсутствии raw — низ справа над навом", () => {
    expect(pos).toMatch(/if \(!raw\) return window\.innerWidth < 769/);
    expect(pos).toMatch(/innerHeight - MOBILE_SIZE\.h - MOBILE_NAV_CLEAR/);
    expect(pos).toMatch(/innerWidth - MOBILE_SIZE\.w - 8/);
  });
  it("loadSize: мобильная ветка при отсутствии raw — MOBILE_SIZE", () => {
    expect(size).toMatch(/if \(!raw\) return window\.innerWidth < 769 \? \{ \.\.\.MOBILE_SIZE \} : DEFAULT_SIZE/);
  });
  it("сохранённые значения по-прежнему читаются (ветка не сломала разбор raw)", () => {
    expect(pos).toMatch(/Number\(j\.x\) \|\| DEFAULT_POS\.x/);
    expect(size).toMatch(/Math\.max\(MIN_SIZE\.w, Number\(j\.w\)/);
  });
});
