// Мобильный BottomNav: «Играть» при ЖИВОЙ партии обязан возвращать к доске, а не открывать
// шторку «Новая партия». Обход 15.09.2026 на 390/360: тап по «Играть» из Задач в живой партии
// открывал Quick-Setup — игрок, хотевший вернуться к партии, получал предложение начать новую.
// Десктопная панель (goTab("play"), стр. ~6004) при on возвращает к доске — один предикат
// обязан давать одно поведение на обеих раскладках.
// Сторож ИСХОДНИКА (форма); что тап реально возвращает к доске — проверяется браузером.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const i = src.indexOf("<BottomNav");
const block = src.slice(i, i + 900);

describe("BottomNav «Играть» при живой партии возвращает к доске", () => {
  it("BottomNav найден", () => { expect(i).toBeGreaterThan(0); });
  it("onPlay: при on&&!over — sTab(\"play\"), шторка только без партии", () => {
    expect(block).toMatch(/onPlay=\{\(\)=>\{ if\(on&&!over\)\{ sTab\("play"\); sSetup\(false\); \} else sShowQuickSetupModal\(true\); \}\}/);
  });
  it("прежняя форма «всегда шторка» не вернулась", () => {
    expect(block).not.toMatch(/onPlay=\{\(\)=>sShowQuickSetupModal\(true\)\}/);
  });
  it("десктопный goTab(\"play\") по-прежнему возвращает к доске (якорь единого поведения)", () => {
    expect(src).toContain('if(k==="play"){ sTab("play"); if(!on&&!over)sSetup(true); return; }');
  });
});
