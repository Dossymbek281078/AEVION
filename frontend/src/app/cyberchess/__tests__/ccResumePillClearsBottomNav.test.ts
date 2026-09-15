// Пилюля «Вернуться к партии» (fixed, по центру) не должна ложиться ни на нав, ни на доску,
// ни на ряд ввода ходов.
// Телефон (<769): bottom:88 — над BottomNav (sticky bottom:0, ~54px). Замер 15.09.2026 на 390:
//   при bottom:20 она накрывала вкладки Анализ/Коуч (elementFromPoint возвращал пилюлю).
// Десктоп (≥769): top:156 — под шапкой. Раскладка фиксированной высоты, доска анализа доходит
//   до низа экрана: при bottom:20 пилюля накрывала c1–h1 И ряд ввода ходов «Перевернуть ·
//   Новая партия · Голос · Ход текстом» (скрин основателя 15.09.2026, Коуч, ~2000px — ряда
//   не видно вовсе). Левый нижний угол не универсален (при сдвинутой раскладке ряд ввода
//   начинается с x≈217). Вверху: контент с y≈148, тулбар слева (x<260), баннер с ≈230,
//   доска с ≈430 — центрированная пилюля на top:156 ни с чем не пересекается.
// Сторож ИСХОДНИКА (форма): что пилюля реально ничего не накрывает — браузером
// (пересечение прямоугольников пилюли с доской и с рядом ввода = 0).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const i = src.indexOf("<span>Вернуться к партии</span>");
const block = src.slice(Math.max(0, i - 1800), i); // стиль пилюли лежит выше её текста

describe("пилюля «Вернуться к партии»: над навом на телефоне, под шапкой на десктопе", () => {
  it("пилюля найдена в исходнике", () => { expect(i).toBeGreaterThan(0); });
  it("телефон: bottom ≥ 60 над BottomNav; десктоп: top (не bottom), порог 769", () => {
    const m = block.match(/\.\.\.\(vwPx<769\?\{bottom:(\d+)\}:\{top:(\d+)\}\)/);
    expect(m, "форма ...(vwPx<769?{bottom:N}:{top:M}) не найдена").toBeTruthy();
    expect(Number(m![1])).toBeGreaterThanOrEqual(60);
    expect(Number(m![2])).toBeGreaterThanOrEqual(120);
  });
  it("пилюля центрирована (left 50% + translateX) на обеих раскладках", () => {
    expect(block).toMatch(/left:"50%",transform:"translateX\(-50%\)"/);
  });
  it("прежние формы не вернулись: bottom:20 на десктопе, левый угол", () => {
    expect(block).not.toMatch(/position:"fixed",bottom:20,/);
    expect(block).not.toMatch(/bottom:vwPx<769\?88:20/);
    expect(block).not.toMatch(/left:vwPx<769\?"50%":20/);
  });
});
