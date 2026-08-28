import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "page.tsx"), "utf8");

describe("страница запуска объявляет свой настоящий язык", () => {
  test("на блоке содержимого стоит lang=ru", () => {
    // Замер 28.08.2026 по ОТДАВАЕМОМУ HTML: 951 русская буква против 28
    // латинских при объявленном "en". Общий шаблон сайта менять нельзя —
    // большая часть страниц английская, — поэтому язык объявляется на самом
    // блоке: ближайший lang выигрывает у корневого.
    expect(SRC).toContain('<main lang="ru"');
  });

  test("страница действительно русская — иначе пометка стала бы ложью", () => {
    const text = SRC.replace(/\/\/[^\n]*/g, "");
    const cyr = (text.match(/[а-яА-ЯёЁ]/g) || []).length;
    const lat = (text.match(/[a-zA-Z]/g) || []).length;
    expect(cyr, "русского текста стало мало — проверь, верна ли ещё пометка ru").toBeGreaterThan(400);
    expect(cyr).toBeGreaterThan(lat * 0.1);
  });
});
