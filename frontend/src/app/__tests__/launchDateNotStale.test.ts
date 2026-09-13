/**
 * Обещание запуска не должно звать на ПРОШЕДШУЮ дату.
 *
 * Зачем отдельный сторож рядом с launchDatesAgree.test.ts. Тот проверяет, что
 * все места называют ОДНУ дату, — то есть согласие страниц между собой. Замер
 * 13.09.2026 показал, чего это не ловит:
 *
 *   1. Согласие не равно правде. Если дата устарела ВЕЗДЕ, сторож зелёный.
 *      Ровно это и жило на проде: /go звала «открываем 10 сентября» три дня
 *      спустя после этой даты, при зелёном наборе тестов.
 *   2. Охват был только src/app/<модуль>/launch/. Замер: файлов с обещанием
 *      даты 23, под охватом 8, вне охвата 15 — и среди пятнадцати ровно одна
 *      настоящая посадочная, /go. Это единственная кликабельная ссылка в
 *      шапках соцсетей, то есть самая дорогая страница воронки.
 *
 * Комментарии из проверки вырезаются намеренно: в них прошедшие даты стоят
 * ЗАКОННО — там история решений («план основателя 30.08 был на 10 сентября»).
 * Без этого сторож краснел бы на объяснении, а не на обещании.
 *
 * Если этот сторож покраснел — значит страница зовёт на дату, которая прошла.
 * Чинить не датой в тесте, а текстом страницы: либо новая дата, либо развилка
 * по времени, как в cyberchess/launch (там уже есть CHESS_LAUNCH_UTC и
 * отрисовка «Открыто» после наступления срока).
 */
import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const APP = join(process.cwd(), "src/app");

export const MONTHS_RU = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

const MARKERS = ["открываем ", "Открываем ", "запуск ", "Запуск "];

/** Вырезать комментарии. `//` внутри `https://` комментарием НЕ считается. */
export function stripComments(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === "/*") {
      const end = src.indexOf("*/", i + 2);
      i = end < 0 ? src.length : end + 2;
      continue;
    }
    if (two === "//" && src[i - 1] !== ":") {
      const end = src.indexOf("\n", i);
      i = end < 0 ? src.length : end;
      continue;
    }
    out += src[i];
    i += 1;
  }
  return out;
}

function onlyCyrillic(s: string): string {
  return s
    .split("")
    .filter((c) => (c >= "а" && c <= "я") || c === "ё")
    .join("");
}

export type Promise_ = { day: number; month: number; raw: string };

/** Найти обещания вида «открываем 20 сентября» вне комментариев. */
export function promisesIn(src: string): Promise_[] {
  const clean = stripComments(src);
  const out: Promise_[] = [];
  for (const marker of MARKERS) {
    let i = clean.indexOf(marker);
    while (i >= 0) {
      const tail = clean.slice(i + marker.length, i + marker.length + 26);
      const parts = tail.split(" ");
      const day = Number(parts[0]);
      const month = MONTHS_RU.indexOf(onlyCyrillic(parts[1] || ""));
      if (Number.isInteger(day) && day >= 1 && day <= 31 && month >= 0) {
        out.push({ day, month, raw: marker + parts[0] + " " + MONTHS_RU[month] });
      }
      i = clean.indexOf(marker, i + 1);
    }
  }
  return out;
}

/**
 * Прошла ли обещанная дата. Год в тексте мы не пишем, поэтому читаем его как
 * текущий; если так выходит больше полугода назад — это дата СЛЕДУЮЩЕГО года
 * (декабрьская страница про январь), и она не просрочена.
 */
export function isStale(day: number, month: number, now: Date): boolean {
  const promised = Date.UTC(now.getUTCFullYear(), month, day, 23, 59, 59);
  const daysAgo = (now.getTime() - promised) / 86400000;
  if (daysAgo > 180) return false;
  return daysAgo > 0;
}

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "__tests__") out.push(...filesUnder(p));
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

function allPromises(): Array<{ file: string; p: Promise_ }> {
  const found: Array<{ file: string; p: Promise_ }> = [];
  for (const f of filesUnder(APP)) {
    for (const p of promisesIn(readFileSync(f, "utf8"))) {
      found.push({ file: f.slice(APP.length + 1).split("\\").join("/"), p });
    }
  }
  return found;
}

describe("обещание запуска не зовёт на прошедшую дату", () => {
  test("прибор исправен: узнаёт прошедшее, будущее и комментарий", () => {
    const now = new Date("2026-09-13T12:00:00Z");
    expect(isStale(10, 8, now), "10 сентября при сегодняшнем 13-м — прошедшая").toBe(true);
    expect(isStale(20, 8, now), "20 сентября при сегодняшнем 13-м — будущая").toBe(false);
    expect(isStale(5, 0, now), "5 января — это следующий год, не просрочка").toBe(false);

    expect(promisesIn('x = "открываем 20 сентября";').length).toBe(1);
    expect(
      promisesIn("/* план был: открываем 10 сентября */").length,
      "дата в комментарии — это история, а не обещание",
    ).toBe(0);
    expect(
      promisesIn('const u = "https://a.app/x"; // открываем 10 сентября').length,
      "дата в строчном комментарии тоже не обещание",
    ).toBe(0);
  });

  test("обещания вообще найдены — иначе проверка пуста", () => {
    const found = allPromises();
    expect(found.length, "ни одного обещания даты не найдено — сломан разбор").toBeGreaterThan(0);
  });

  test("охват включает посадочную воронки /go", () => {
    const files = allPromises().map((f) => f.file);
    expect(
      files,
      "у /go пропало обещание даты или сторож перестал её видеть; " +
        "именно эта страница стоит в шапках соцсетей, её проверять обязательно. " +
        "Сейчас видны: " + [...new Set(files)].join(", "),
    ).toContain("go/page.tsx");
  });

  test("ни одна страница не зовёт на прошедшую дату", () => {
    const now = new Date();
    const stale = allPromises().filter((f) => isStale(f.p.day, f.p.month, now));
    expect(
      stale.map((s) => s.file + " -> «" + s.p.raw + "»"),
      "страница зовёт на дату, которая уже прошла. Поправьте ТЕКСТ страницы: " +
        "новая дата или развилка по времени (образец — cyberchess/launch)",
    ).toEqual([]);
  });
});
