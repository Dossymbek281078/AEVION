import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 Подписи для скринридера и подсказок (aria-label/title/placeholder) на /cyberchess
 * у англоязычного гостя — не русские.
 *
 * Повод 13.10.2026 (bd, playwright locale en-US на /en/cyberchess): видимый текст
 * английский, а aria-label — русские. Живой слой перевода (AutoTranslate) переводит
 * атрибуты по словарю уже после первого кадра, и две подписи в словаре отсутствовали:
 * «Сила соперника», «Запустить Puzzle Rush» — они оставались русскими навсегда.
 * Эти две переведены через словарь шахмат (cc.t). Остальные жёсткие русские литералы
 * в атрибутах страницы (127 вхождений на 13.10 после правки; 129 до неё) слой переводит
 * по словарю через несколько секунд; сторож держит их число как храповик — расти нельзя,
 * переводишь ещё — опускай предел.
 */
const СТРАНИЦА = readFileSync(join(process.cwd(), "src/app/cyberchess/page.tsx"), "utf8");
const СЛОВАРЬ = readFileSync(join(process.cwd(), "src/app/cyberchess/i18n.ts"), "utf8");
const РУССКИЙ_АТРИБУТ = /(?:aria-label|title|placeholder|alt)="[^"]*[а-яА-ЯёЁ][^"]*"/g;
// 23.10.2026: все 126 (с alt) переведены в словарь — живой перевод на проде
// не работал (ключ отключён), en/kk-гость слышал их по-русски навсегда. Предел — 0.
const ПРЕДЕЛ_ЛИТЕРАЛОВ = 0;

describe("aria-подписи шахмат — из словаря", () => {
  it("🔴 «Сила соперника» и «Запустить Puzzle Rush» больше не жёсткие литералы, а ключи", () => {
    expect(СТРАНИЦА).not.toContain('aria-label="Сила соперника"');
    expect(СТРАНИЦА).not.toContain('aria-label="Запустить Puzzle Rush"');
    expect(СТРАНИЦА).toContain('cc.t("ai.strength.aria")');
    expect(СТРАНИЦА).toContain('cc.t("rush.start.aria")');
  });

  it("ключи есть во всех трёх языках и английский — не кириллица", () => {
    for (const ключ of ["ai.strength.aria", "rush.start.aria"]) {
      const вхождений = СЛОВАРЬ.split(`"${ключ}":`).length - 1;
      expect(вхождений, ключ).toBe(3);
    }
    expect(СЛОВАРЬ).toContain('"ai.strength.aria": "Opponent strength"');
    expect(СЛОВАРЬ).toContain('"rush.start.aria": "Start Puzzle Rush"');
  });

  it(`храповик: жёстких русских атрибутов на странице не больше ${ПРЕДЕЛ_ЛИТЕРАЛОВ}`, () => {
    const n = (СТРАНИЦА.match(РУССКИЙ_АТРИБУТ) || []).length;
    // знаменатель: прибор видит атрибуты-ключи страницы (их больше сотни)
    expect((СТРАНИЦА.match(/\b(?:aria-label|title|placeholder|alt)=\{cc\.t\(/g) || []).length).toBeGreaterThan(100);
    expect(n).toBeLessThanOrEqual(ПРЕДЕЛ_ЛИТЕРАЛОВ);
  });

  it("КОНТРОЛЬ: прибор видит русский литерал в атрибуте и не видит ключ", () => {
    expect(('<b title="Помощь">'.match(РУССКИЙ_АТРИБУТ) || []).length).toBe(1);
    expect(('<b title={cc.t("x")}>'.match(РУССКИЙ_АТРИБУТ) || []).length).toBe(0);
  });
});
