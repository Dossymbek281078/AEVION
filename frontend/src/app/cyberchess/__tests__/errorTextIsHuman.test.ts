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

describe("во всём модуле текст исключения не показывается человеку", () => {
  test("ни одна страница не подставляет e.message в сообщение", () => {
    // Свип по классу, а не по одному файлу: сегодня нашлось три места, и все
    // три показывали «HTTP 500» или «API returned ok=false».
    const корень = path.join(__dirname, "..");
    const файлы: string[] = [];
    const обойти = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { if (e.name !== "__tests__") обойти(p); }
        else if (/\.tsx?$/.test(e.name)) файлы.push(p);
      }
    };
    обойти(корень);
    const плохие = файлы.filter((f) =>
      /set(Error|Message)\(\s*(e|err)[^)]*\.message/.test(stripComments(fs.readFileSync(f, "utf-8"))));
    expect(плохие.map((f) => path.relative(корень, f))).toEqual([]);
  });
});
