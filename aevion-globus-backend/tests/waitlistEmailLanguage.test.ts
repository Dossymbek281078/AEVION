import { describe, expect, test } from "vitest";
import { buildWaitlistConfirmEmail, isEnglishSource } from "../src/lib/constitutionBrevo";

const CYR = /[А-Яа-яЁё]/;
const text = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();

// Найдено 29.08.2026 вкладкой воронки за сутки до запуска: письмо честно
// подставляло, ОТКУДА человек подписался, но про язык не знало вовсе.
// Четыре ролика из одиннадцати англоязычные и ведут на /en/go — первое письмо
// от нас приходило бы на языке, которого человек может не знать, и при этом
// всё «работало»: адрес сохранён, письмо ушло, отказов нет.
describe("язык письма следует за языком страницы", () => {
  test("английский источник — письмо без кириллицы целиком", () => {
    for (const src of ["en-go", "en-longevity", "en"]) {
      const m = buildWaitlistConfirmEmail("kto-to@primer.ru", src);
      expect(CYR.test(m.subject), `${src}: кириллица в теме`).toBe(false);
      expect(CYR.test(text(m.htmlContent)), `${src}: кириллица в теле (подпись отписки?)`).toBe(false);
      expect(CYR.test(String(m.textContent ?? "")), `${src}: кириллица в текстовой части`).toBe(false);
    }
  });

  test("русский источник по-прежнему русский", () => {
    for (const src of ["go", "longevity", "cyberchess", "bureau"]) {
      const m = buildWaitlistConfirmEmail("kto-to@primer.ru", src);
      expect(CYR.test(m.subject), `${src}: тема перестала быть русской`).toBe(true);
    }
  });

  // Языковая приставка не должна прятать модуль: en-longevity — тот же
  // longevity, и человек должен узнать, что модуль УЖЕ открыт, а не что он
  // «в списке ожидания».
  test("приставка en- не скрывает модуль", () => {
    const en = buildWaitlistConfirmEmail("kto-to@primer.ru", "en-longevity");
    expect(en.subject).toMatch(/is open/i);
    expect(en.subject).not.toMatch(/early-access list$/);
  });

  test("распознавание источника не ловит лишнего", () => {
    expect(isEnglishSource("en-go")).toBe(true);
    expect(isEnglishSource("en")).toBe(true);
    expect(isEnglishSource("engineering")).toBe(false); // начинается на «en», но не язык
    expect(isEnglishSource("go")).toBe(false);
    expect(isEnglishSource(undefined)).toBe(false);
  });
});
