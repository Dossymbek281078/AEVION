// Пилюля «Вернуться к партии» — position:fixed и места в потоке не занимает: на вкладках
// Задачи/Коуч доска задачи/анализа уезжала ПОД неё (обход 15.09.2026: накрыто 4 клетки на
// 390px и 9 на 360px — нижняя горизонталь). Починка — спейсер в потоке перед BottomNav под
// ТЕМ ЖЕ условием, что у пилюли, плюс мобильный порог 769: доска прокручивается над пилюлей.
// Сторож закрепляет: спейсер существует, условие совпадает с условием пилюли, высота ≥ 60.
// Граница честная: сторож ИСХОДНИКА; что клетки реально достижимы после прокрутки —
// проверяется браузером вторым проходом (scrollIntoView нижнего ряда → elementFromPoint).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const PILL_COND = 'on&&!over&&tab!=="play"&&!isHumanGame';

describe("спейсер под пилюлю «Вернуться к партии» на телефоне", () => {
  it("пилюля рендерится под ожидаемым условием (якорь для сравнения)", () => {
    expect(src).toContain(`{${PILL_COND}&&<button onClick={()=>sTab("play")}`);
  });
  it("спейсер существует с тем же условием + мобильный порог и высотой ≥ 60", () => {
    const m = src.match(/\{on&&!over&&tab!=="play"&&!isHumanGame&&vwPx<769&&<div aria-hidden style=\{\{height:(\d+)\}\}\/>\}/);
    expect(m, "спейсер с условием пилюли не найден").toBeTruthy();
    expect(Number(m![1])).toBeGreaterThanOrEqual(60);
  });
  it("спейсер стоит ПЕРЕД BottomNav (в потоке, над sticky-навом)", () => {
    const iSpacer = src.indexOf('&&<div aria-hidden style={{height:');
    const iNav = src.indexOf("&&<BottomNav");
    expect(iSpacer).toBeGreaterThan(0);
    expect(iNav).toBeGreaterThan(iSpacer);
  });
});
