import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { QEVENTS_DICT, QEVENTS_KEYS, tQevents } from "./i18n";

// 24.10.2026: список, карточка и форма QEvents были на английском при ru,
// календарь — зашит по-русски (месяцы, Пн…Вс, ru-RU) при en/kk.
const PAGE = readFileSync(join(__dirname, "page.tsx"), "utf8");
const код = PAGE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("QEvents говорит на языке посетителя", () => {
  test("в разметке нет английских и русских надписей-литералов", () => {
    const текст = [...код.matchAll(/>\s*([^<>{}]*[A-Za-zА-Яа-я]{3,}[^<>{}]*?)\s*</g)].map((m) => m[1].trim()).filter((x) => x && x !== "QEvents" && !/[;=()]/.test(x));
    expect(текст).toEqual([]);
    expect(код).not.toMatch(/(placeholder|title|aria-label)="[^"]*[A-Za-zА-Яа-я]{3}/);
  });
  test("месяцы, дни недели и даты — из локали, не зашиты", () => {
    expect(код).not.toMatch(/MONTHS_RU|"Пн", "Вт"/);
    expect(код).not.toMatch(/toLocale(Date|Time)String\("(ru-RU|en-US)"/);
  });
  test("у ru и kk тот же набор ключей, и значения не английские", () => {
    expect(QEVENTS_KEYS.length, "знаменатель").toBeGreaterThan(40);
    for (const lang of ["ru", "kk"]) {
      const d = QEVENTS_DICT[lang]!;
      expect(Object.keys(d).sort()).toEqual([...QEVENTS_KEYS].sort());
      expect(tQevents(lang, "card.rsvp")).not.toBe("RSVP");
    }
  });
});
