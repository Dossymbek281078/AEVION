import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Глобус вешает keydown на window и вызывает preventDefault. Пока он делал это
 * БЕЗУСЛОВНО, главная страница не проходилась с клавиатуры вовсе: замер на
 * проде 31.08.2026 — 40 нажатий Tab из 40 оставляли фокус на body при 121
 * ссылке и 25 кнопках. Съедались Tab, пробел, Enter и стрелки.
 *
 * Починка: клавиши действуют, только когда фокус ВНУТРИ глобуса.
 *
 * 🔴 Граница этого сторожа, названная честно: он стережёт НАЛИЧИЕ проверки и
 * её место — до разбора клавиш. Он НЕ доказывает, что на живой странице Tab
 * работает: это свойство рендера, и его меряет
 * `aevion-keyboard-walk.mjs --base=<адрес> --paths=/`, где находка «ловушка»
 * или «потеря» и означает возврат дефекта. Зелёный цвет здесь читать как
 * «охрану не сняли», а не как «клавиатура работает».
 */

const ФАЙЛ = path.join(__dirname, "..", "components", "Globus3D.tsx");

describe("клавиши глобуса не распространяются на всю страницу", () => {
  const текст = fs.readFileSync(ФАЙЛ, "utf8");

  it("файл прочитан и это тот самый компонент", () => {
    expect(текст.length).toBeGreaterThan(1000);
    expect(текст).toContain('window.addEventListener("keydown"');
  });

  it("есть проверка «фокус внутри глобуса»", () => {
    expect(текст).toContain("корень.contains(document.activeElement)");
  });

  it("проверка стоит ДО разбора клавиш, иначе она бесполезна", () => {
    const охрана = текст.indexOf("корень.contains(document.activeElement)");
    const разбор = текст.indexOf("switch (e.key)");
    expect(охрана).toBeGreaterThan(-1);
    expect(разбор).toBeGreaterThan(-1);
    expect(охрана).toBeLessThan(разбор);
  });

  it("результат проверки ИСПОЛЬЗУЕТСЯ, а не просто посчитан", () => {
    // Проверку можно оставить на месте и обезвредить: `if (false) return`.
    // Поэтому закрепляем именно ранний выход по её результату.
    expect(текст).toContain("if (!вГлобусе) return;");
  });

  it("из глобуса можно выйти с клавиатуры — иначе это ловушка", () => {
    expect(текст).toContain('case "Escape"');
  });

  it("глобус представляется читалке и принимает фокус", () => {
    expect(текст).toContain("tabIndex={0}");
    expect(текст).toContain('role="application"');
    expect(текст).toContain("aria-label=");
  });
});
