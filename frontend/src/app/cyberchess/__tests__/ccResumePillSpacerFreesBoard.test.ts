// Пилюля «Вернуться к партии» — position:fixed и места в потоке не занимает: на вкладках
// Задачи/Коуч доска задачи/анализа уезжала ПОД неё (обход 15.09.2026: 4 клетки на 390px,
// 9 на 360px). Первые две починки (спейсер 64, затем 152 ПОСЛЕ </ProductPageShell>) были
// холостыми: ProductPageShell fullWidth = overflow:hidden, и снаружи клипа высота ничего
// не даёт — второй проход показал те же 724/844 и 694/780. Работает только paddingBottom
// у самого КОНТЕЙНЕРА ПРОКРУТКИ контента (div flex:1/overflowY:auto), под тем же условием,
// что у пилюли, плюс мобильный порог 769; величина 152 = 88 (отступ) + 56 (высота с чипом) + 8.
// Сторож закрепляет МЕСТО (скроллер, не снаружи), УСЛОВИЕ и ЧИСЛО (≥144 = 88+56).
// Граница честная: сторож исходника; что клетки достижимы — браузером вторым проходом.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const COND = 'on&&!over&&tab!=="play"&&!isHumanGame';

describe("отступ под пилюлю «Вернуться к партии» — у контейнера прокрутки, не снаружи", () => {
  it("пилюля рендерится под ожидаемым условием (якорь для сравнения)", () => {
    expect(src).toContain(`{${COND}&&<button onClick={()=>sTab("play")}`);
  });
  it("скроллер контента (flex:1/overflowY:auto) несёт paddingBottom с условием пилюли и порогом 769, значение ≥ 144", () => {
    const m = src.match(/overflowY:"auto",marginBottom:16,[^\n]*paddingBottom:\(on&&!over&&tab!=="play"&&!isHumanGame&&vwPx<769\)\?(\d+):0\}\}/);
    expect(m, "paddingBottom с условием пилюли на скроллере не найден").toBeTruthy();
    expect(Number(m![1])).toBeGreaterThanOrEqual(144);
  });
  it("холостой спейсер ПОСЛЕ </ProductPageShell> не вернулся", () => {
    expect(src).not.toMatch(/vwPx<769&&<div aria-hidden style=\{\{height:\d+\}\}\/>/);
  });
});
