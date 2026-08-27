import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Человеку нельзя показывать PUZZLES.length как «сколько задач у нас есть».
 *
 * PUZZLES — это пачка, загруженная в браузер (400 штук). Банк — это pzTotal,
 * он приходит с сервера и равен полумиллиону. 28.08.2026 на первом экране
 * новичка стояли рядом «Решить задачу 400» и «502 584 задачи в банке»:
 * два наших собственных ответа об одном и том же спорили между собой,
 * и короткий был неверным.
 *
 * Правило: любое число задач НА ЭКРАНЕ берётся как (pzTotal ?? PUZZLES.length) —
 * настоящее, а с откатом на пачку, пока сервер не ответил.
 */
const PAGE = path.join(__dirname, "..", "cyberchess", "page.tsx");

describe("число задач на экране — это банк, а не загруженная пачка", () => {
  it("PUZZLES.length не выводится человеку без отката на pzTotal", () => {
    const src = fs.readFileSync(PAGE, "utf8");

    // toLocaleString зовут только чтобы ПОКАЗАТЬ число человеку.
    const shown = [...src.matchAll(/([\w?.()]{0,40})PUZZLES\.length\.toLocaleString/g)];
    const bad = shown.filter((m) => !m[1].includes("pzTotal"));

    expect(
      bad.map((m) => m[0]),
      "число на экране должно быть (pzTotal??PUZZLES.length), иначе показываем размер пачки",
    ).toEqual([]);
  });

  it("проверка умеет краснеть: голый PUZZLES.length ловится", () => {
    const fake = 'sub:`Случайная из ${PUZZLES.length.toLocaleString("ru-RU")}`';
    const shown = [...fake.matchAll(/([\w?.()]{0,40})PUZZLES\.length\.toLocaleString/g)];
    expect(shown.filter((m) => !m[1].includes("pzTotal")).length).toBe(1);
  });
});
