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

describe("PiP на телефоне стартует под доской, минимальным, над навом", () => {
  it("loadPos: мобильная ветка при отсутствии raw — низ справа над навом", () => {
    expect(pos).toMatch(/if \(!raw\) return window\.innerWidth < 769/);
    expect(pos).toMatch(/innerHeight - MIN_SIZE\.h - 100/);
    expect(pos).toMatch(/innerWidth - MIN_SIZE\.w - 8/);
  });
  it("loadSize: мобильная ветка при отсутствии raw — MIN_SIZE", () => {
    expect(size).toMatch(/if \(!raw\) return window\.innerWidth < 769 \? \{ \.\.\.MIN_SIZE \} : DEFAULT_SIZE/);
  });
  it("сохранённые значения по-прежнему читаются (ветка не сломала разбор raw)", () => {
    expect(pos).toMatch(/Number\(j\.x\) \|\| DEFAULT_POS\.x/);
    expect(size).toMatch(/Math\.max\(MIN_SIZE\.w, Number\(j\.w\)/);
  });
});
