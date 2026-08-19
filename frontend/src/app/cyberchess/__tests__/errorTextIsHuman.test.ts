import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { stripComments } from "./_stripComments";

// Тексты ошибок — человеческие. 19.08.2026.
//
// Ворота запуска, пункт 4: «отказ показывается отказом; тексты ошибок
// человеческие, без кодов и адресов серверов». На странице повторов партий в
// сообщение попадал текст исключения — то есть «HTTP 500» и «API returned
// ok=false». Это язык разработчика: человек из него не понимает ни что
// случилось, ни что делать.
//
// Технический текст не потерян — он уходит в консоль, где и нужен.

const SRC = path.join(__dirname, "..", "replays", "page.tsx");

describe("страница повторов говорит с человеком по-человечески", () => {
  test("в сообщение не подставляется текст исключения", () => {
    const s = stripComments(fs.readFileSync(SRC, "utf-8")).replace(/\s+/g, " ");
    expect(s).not.toMatch(/setError\(e instanceof Error \? e\.message/);
    expect(s).toMatch(/Не удалось загрузить партии/);
  });

  test("технический текст всё же сохраняется — в консоли", () => {
    // Иначе починка «для человека» превратилась бы в потерю диагностики.
    const s = stripComments(fs.readFileSync(SRC, "utf-8"));
    expect(s).toMatch(/console\.warn\(/);
  });
});
