import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./_stripComments";

/* Сторож для самого инструмента сторожей. Оба режима отказа здесь — не выдуманные:
 * каждый измерен на живом файле модуля 11.08.2026. */

describe("stripComments", () => {
  it("вырезает обычные комментарии", () => {
    expect(stripComments("const a = 1; // хвост")).toBe("const a = 1; ");
    expect(stripComments("a /* середина */ b")).toBe("a  b");
    expect(stripComments("до\n/* через\n   строки */\nпосле")).toBe("до\n\n\nпосле");
  });

  it("НЕ принимает `/*` внутри строки за комментарий", () => {
    /* Ровно этот случай — `accept="image/*"` в page.tsx — заставлял наивную регулярку
       выбрасывать 77 строк кода до следующего настоящего `*​/`. */
    const src = 'const a = "image/*"; const keep = 1;';
    expect(stripComments(src)).toBe(src);
  });

  it("не застревает после апострофа в тексте", () => {
    /* Полный разбор со строками ломался наоборот: одна кавычка — и комментарии дальше
       переставали вырезаться совсем, то есть проверка «вызов есть» зеленела на
       ЗАКОММЕНТИРОВАННОМ вызове. Это ложный зелёный, худший из отказов. */
    const src = "<span>Игрок'ы</span>\n// комментарий\ncode();";
    expect(stripComments(src)).not.toMatch(/комментарий/);
    expect(stripComments(src)).toMatch(/code\(\)/);
  });

  it("на живых файлах модуля: код цел, комментарии убраны", () => {
    const page = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
    const coach = readFileSync(join(__dirname, "..", "AiCoach.tsx"), "utf8");

    // код, который наивная регулярка съедала вместе с фальшивым комментарием
    expect(stripComments(page)).toMatch(/setItem\(SK_MOVES/);
    // комментарий, который переживал разбор со строками
    expect(stripComments(coach)).not.toMatch(/не вызывался ни из одного места/);
    // а настоящий вызов рядом с ним — на месте
    expect(stripComments(coach)).toMatch(/bumpDaily\("coach"\)/);
  });

  it("не выбрасывает больше наивной регулярки — и код при этом цел", () => {
    const page = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
    const naive = page.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
    const ours = stripComments(page);

    /* Доля сама по себе плохой критерий: часть объёма — законно вырезанные комментарии.
       Осмысленно другое — мы не должны выбрасывать БОЛЬШЕ наивного варианта, при том что
       код, который он съедал, у нас остаётся. Построчный разбор режет комментарии и
       внутри многострочных шаблонов, и это осознанная цена: потеря ограничена строкой,
       а не семьюдесятью семью. */
    expect(ours.length).toBeGreaterThanOrEqual(naive.length);
    expect(naive).not.toMatch(/setItem\(SK_MOVES/);
    expect(ours).toMatch(/setItem\(SK_MOVES/);
  });
});
