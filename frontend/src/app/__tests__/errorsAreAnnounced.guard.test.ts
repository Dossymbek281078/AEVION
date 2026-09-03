import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Отказ, показанный только значком и цветом, для читалки не существует.
 *
 * Замер 02.09.2026 на проде: ввод неверного промокода на /pricing выводил
 * «✗ Промо-код не найден», и у сообщения не было НИ role, НИ aria-live, НИ
 * aria-invalid на поле. Человек нажимал Enter и не узнавал, что код отклонён.
 * Тот же класс на сбросе пароля: «токен истёк» — обычный абзац.
 *
 * Сторож охраняет ДВЕ поверхности, где цена ошибки высока: деньги и вход.
 * Он намеренно НЕ пытается охватить все 93 файла с «✓/✗» — там почти всё
 * статические таблицы сравнения, и правило про них краснело бы вечно
 * (а вечно красного сторожа перестают читать).
 */

const КОРЕНЬ = path.join(__dirname, "..");

function читать(отн: string) {
  return fs.readFileSync(path.join(КОРЕНЬ, отн), "utf8");
}

/** Есть ли у текста живая область — то есть объявит ли читалка изменение. */
export function естьЖиваяОбласть(текст: string) {
  return /role="(alert|status)"/.test(текст) && /aria-live=/.test(текст);
}

describe("исход действия объявляется читалке", () => {
  it("прибор умеет краснеть: на тексте без области даёт false", () => {
    expect(естьЖиваяОбласть('<p className="err">{err}</p>')).toBe(false);
  });

  it("прибор не клевещет: на тексте с областью даёт true", () => {
    expect(естьЖиваяОбласть('<div role="alert" aria-live="assertive">{err}</div>')).toBe(true);
  });

  it("промокод на странице цен: исход ввода объявляется", () => {
    const s = читать("pricing/page.tsx");
    expect(s).toContain('id="calc-promo-msg"');
    expect(s).toContain('role="status"');
    // поле обязано помечаться неверным, иначе читалка не свяжет отказ с ним
    expect(s).toContain('aria-describedby="calc-promo-msg"');
    expect(s).toContain("aria-invalid={");
  });

  it("сброс пароля: отказ объявляется на ОБОИХ шагах потока", () => {
    const s = читать("build/reset-password/page.tsx");
    const областей = (s.match(/role="alert"/g) || []).length;
    // два шага: запрос письма и установка нового пароля. Одна область
    // означала бы, что половина потока молчит.
    expect(областей).toBe(2);
    expect(естьЖиваяОбласть(s)).toBe(true);
  });

  it("живая область промокода отрисована ВСЕГДА, а не вместе с текстом", () => {
    const s = читать("pricing/page.tsx");
    const i = s.indexOf('id="calc-promo-msg"');
    expect(i).toBeGreaterThan(-1);
    // условие перед областью означало бы, что она появляется вместе с
    // сообщением — такую читалка объявляет ненадёжно
    const до = s.slice(Math.max(0, i - 260), i);
    expect(до.includes("&& (")).toBe(false);
  });
});
