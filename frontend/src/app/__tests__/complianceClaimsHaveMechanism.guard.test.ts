import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Сторож: страница соответствия не объявляет работающим то, чего нет в коде.
 *
 * ЗАЧЕМ. Блок санкционных списков показывал зелёный значок «Synced» и точное
 * время последней синхронизации по пяти спискам (OFAC, EU, UN, UK HMT, KZ AFM).
 * Время было зашито в файл — 2026-04-28, четыре месяца назад, — а проверки по
 * санкционным спискам в бэкенде нет вовсе: ни под словом ofac, ни под словом
 * sanction. То есть страница о соответствии требованиям утверждала о нас факт,
 * которого не было.
 *
 * На той же странице есть честный образец: отчёт прямо назван «demo report
 * stub. In production this would contain…». Значит голос у страницы уже был —
 * просто этот блок ему не следовал.
 */
const ROOT = join(__dirname, "..", "..", "..");
const BACKEND = join(ROOT, "..", "aevion-globus-backend", "src");
const PAGE = join(ROOT, "src", "app", "payments", "compliance", "page.tsx");

function файлыСо(словом: RegExp, dir: string): number {
  let n = 0;
  for (const i of readdirSync(dir)) {
    const p = join(dir, i);
    if (statSync(p).isDirectory()) n += файлыСо(словом, p);
    else if (/\.(ts|tsx)$/.test(i) && словом.test(readFileSync(p, "utf8"))) n++;
  }
  return n;
}

describe("заявления о соответствии подкреплены механизмом", () => {
  it("санкционные списки не объявлены синхронизируемыми без проверки в коде", () => {
    expect(existsSync(BACKEND), "бэкенд не найден — сторож не может ответить").toBe(true);

    // Контроль прибора: заведомо существующее слово обязано находиться, иначе
    // ноль ниже означал бы сломанный обход, а не отсутствие механизма.
    expect(файлыСо(/refund/i, BACKEND), "обход бэкенда сломан").toBeGreaterThan(0);

    const механизм = файлыСо(/ofac|sanction/i, BACKEND);
    const page = readFileSync(PAGE, "utf8");

    if (механизм === 0) {
      expect(page, "страница объявляет списки синхронизированными, а проверки нет")
        .not.toContain("Synced");
      expect(page, "нет честной пометки о том, что проверка не подключена")
        .toContain("not wired to this list yet");
      expect(page, "на странице снова зашитая дата синхронизации").not.toContain("lastSync");
    }
  });
});
