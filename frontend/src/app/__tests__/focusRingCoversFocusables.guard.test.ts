import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Общий контур фокуса обязан покрывать ВСЁ, что принимает фокус.
 *
 * Замер прода 29.08.2026, страница цен: правило покрывало button, a,
 * [role=button], [role=tab], input, select, textarea — а `<summary>` под него
 * не попадал. Восемь разворачивающихся вопросов принимали фокус, попадали под
 * `:focus-visible`, и при этом их оформление НЕ МЕНЯЛОСЬ: контур `none`.
 * Клавиатурой по разделу вопросов человек шёл вслепую.
 *
 * Проверка по исходнику: правило статическое, и потерять элемент из списка
 * можно только правкой этих строк.
 */

const CSS = join(__dirname, "..", "globals.css");

// Всё, что браузер делает фокусируемым и что у нас встречается.
const MUST_COVER = [
  "button",
  "a",
  '[role="button"]',
  '[role="tab"]',
  "input",
  "select",
  "textarea",
  "summary",
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="link"]',
];

describe("контур фокуса покрывает всё фокусируемое", () => {
  const css = readFileSync(CSS, "utf8");
  // Берём именно блок общего правила, а не любое упоминание focus-visible.
  const start = css.indexOf("button:focus-visible");
  const block = start >= 0 ? css.slice(start, css.indexOf("}", start)) : "";

  it("блок общего правила найден — иначе проверять нечего", () => {
    expect(start, "в globals.css нет общего правила фокуса").toBeGreaterThan(0);
    expect(block.length).toBeGreaterThan(50);
  });

  for (const sel of MUST_COVER) {
    it(`${sel} попадает под общий контур`, () => {
      expect(block, `${sel} выпал из общего правила — фокус на нём станет невидим`)
        .toContain(`${sel}:focus-visible`);
    });
  }

  it("осознанное исключение .cc-focus-ring сохранено", () => {
    // Этот класс намеренно снимает контур и рисует СВОЁ кольцо тенью
    // (~84 применения в шахматах). Общий !important навязал бы им контур
    // поверх кольца. Признак видимого фокуса у них есть — нижняя граница
    // соблюдена, значит их решение уважаем.
    const last = css.lastIndexOf(".cc-focus-ring:focus-visible");
    expect(last, "исключение пропало — шахматам навяжется чужой контур")
      .toBeGreaterThan(start);
    const rule = css.slice(last, css.indexOf("}", last));
    expect(rule, "исключение перестало перебивать общий !important")
      .toContain("outline: none !important");
  });

  it("контур действительно рисуется, а не объявлен пустым", () => {
    const rule = css.slice(css.indexOf("{", start), css.indexOf("}", start));
    expect(rule, "у правила пропала толщина контура").toMatch(/outline:\s*[1-9]/);
  });
});
