import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 139в (14.10.2026). Замер на проде 9c0c0b6a6, 1024×900, путь ?puzzle=: тост «⌕ Жми Ctrl+K…» появлялся через
 * 2,4 с и до ~4 с лежал на кнопках масштаба под доской (elementFromPoint в центре кнопки → .aevion-toast-stack);
 * приёмка priemka-doski.mjs красила пару 1024×900. Подсказка о палитре — не для первого экрана и не для пришедшего
 * за задачей: показывается один раз после первой доигранной партии (over), на телефоне — никогда.
 */
const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("подсказка палитры не накрывает первый экран и экран задачи (139в)", () => {
  it("🔴 условие показа: не телефон, не путь задачи, только после доигранной партии; эффект зависит от over", () => {
    const i = src.indexOf('showToast("⌕ Жми Ctrl+K');
    expect(i).toBeGreaterThan(0);
    const блок = src.slice(Math.max(0, i - 1200), i + 500);
    expect(блок).toContain("if(isMobileLayout)return;");
    expect(блок).toContain("if(зашёлЗаЗадачей||!over)return;");
    expect(блок).toContain('localStorage.getItem("aevion_chess_palette_hint_v2")==="1"');
    expect(блок).toContain("},[showToast,isMobileLayout,зашёлЗаЗадачей,over]);");
    // старый ключ больше не читается: иначе у старых посетителей подсказка не покажется никогда, у новых — на первом экране
    expect(src).not.toContain('"aevion_chess_palette_hint_v1"');
  });
  it("показывается ровно один раз и помечается тем же ключом v2", () => {
    expect(src).toContain('localStorage.setItem("aevion_chess_palette_hint_v2","1")');
  });
});
