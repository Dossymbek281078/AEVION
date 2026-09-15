// Пилюля «Вернуться к партии» (fixed, по центру низа) на телефоне обязана стоять ВЫШЕ
// BottomNav (sticky bottom:0, ~54px). Замер 15.09.2026 на 390px: при bottom:20 она ложилась
// ровно на вкладки Анализ/Коуч и, будучи выше по z-index, делала их ненажимаемыми — игрок,
// ушедший из партии в Задачи, не мог открыть Коуч. Сторож ловит откат к литеральному
// bottom:20 без мобильной ветки. Граница честная: это сторож ИСХОДНИКА (форма), а не
// отрисовки; что нав реально свободен — проверяется браузером (elementFromPoint).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const i = src.indexOf("<span>Вернуться к партии</span>");
const block = src.slice(Math.max(0, i - 1400), i); // стиль пилюли лежит выше её текста

describe("пилюля «Вернуться к партии» не накрывает BottomNav на телефоне", () => {
  it("пилюля найдена в исходнике", () => { expect(i).toBeGreaterThan(0); });
  it("bottom на мобиле поднят над навом (условие по ширине, порог 769 как у BottomNav)", () => {
    expect(block).toMatch(/bottom:\s*vwPx\s*<\s*769\s*\?\s*(8[0-9]|9[0-9]|1\d\d)\s*:\s*20/);
  });
  it("литеральный bottom:20 у пилюли не вернулся", () => {
    expect(block).not.toMatch(/position:"fixed",bottom:20,/);
  });
});
