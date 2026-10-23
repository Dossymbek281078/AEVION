import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 23.10.2026: «Смотреть фильм демо» звала window.open ПОСЛЕ await fetch(render-all).
// Такой вызов браузер не считает ответом на нажатие: iOS Safari блокирует его
// всегда, Chrome — если ожидание дольше ~5 с. Гость нажимал и не видел фильма.
const src = readFileSync(join(__dirname, "..", "_client.tsx"), "utf8");

function тело(): string {
  const i = src.indexOf("async function watchDemoFilm()");
  expect(i, "watchDemoFilm не найдена").toBeGreaterThan(0);
  const j = src.indexOf("\n  async function ", i + 10);
  // без строк-комментариев: в них слово «await» стоит раньше вызова
  return src.slice(i, j > 0 ? j : i + 2000).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
}

describe("вкладка демо-фильма открывается в самом нажатии", () => {
  test("window.open стоит раньше первого await", () => {
    const b = тело();
    const open = b.indexOf("window.open(");
    const ждём = b.indexOf("await ");
    expect(open, "window.open нет").toBeGreaterThan(0);
    expect(ждём, "знаменатель: await в обработчике есть").toBeGreaterThan(0);
    expect(open).toBeLessThan(ждём);
  });
  test("заблокированное окно не глотает фильм молча", () => {
    expect(тело()).toContain("window.location.assign(");
  });
});
