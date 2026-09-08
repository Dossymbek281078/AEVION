import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Кому обещали написать в день запуска — тому есть чем написать.
 *
 * 🔴 ЗАЧЕМ. Замер 08.09.2026, за два дня до запуска. Письмо-подтверждение при
 * подписке (constitutionBrevo.LAUNCH_MODULES) обещает «напишем в день
 * запуска» ДЕВЯТИ модулям. Рассылка на запуск (launchAnnounce.LAUNCH_MODULES)
 * знала ПЯТЬ. Подписчики qsign, qskyway, биржи стартапов и qventure получили
 * бы обещание и не получили бы письма: механизма для них не существовало.
 *
 * Отсутствие не падает и ни в одном отчёте не видно — письма просто не
 * уходят. Именно так этот класс уже проявлялся 31.08 в соседнем файле, где
 * сверили письмо со списком основателя и дописали три модуля; починили один
 * файл из двух, и второй остался с прежним списком.
 *
 * ГРАНИЦА. Сверяются ИМЕНА модулей, а не даты и не тексты: дата у части
 * записей намеренно null (обещать её без документа нельзя), и это не дефект.
 * Обратное направление — модуль в рассылке без обещания — тоже проверяется:
 * письмо о запуске тому, кто его не ждал, это спам, а не забота.
 */
const BACKEND = join(__dirname, "..");
const ANNOUNCE = join(BACKEND, "src/lib/launchAnnounce.ts");
const CONFIRM = join(BACKEND, "src/lib/constitutionBrevo.ts");

/** Ключи объекта LAUNCH_MODULES рассылки. */
function ктоПолучитПисьмо(src: string): string[] {
  const i = src.indexOf("export const LAUNCH_MODULES");
  expect(i, "в launchAnnounce нет LAUNCH_MODULES").toBeGreaterThan(-1);
  const блок = src.slice(i, src.indexOf("\n};", i));
  return [...блок.matchAll(/^ {2}([a-z][a-z-]*):\s*\{/gm)].map((m) => m[1]);
}

/** Префиксы из списка, которому обещано письмо. */
function комуОбещали(src: string): string[] {
  const i = src.indexOf("const LAUNCH_MODULES");
  expect(i, "в constitutionBrevo нет LAUNCH_MODULES").toBeGreaterThan(-1);
  const блок = src.slice(i, src.indexOf("\n];", i));
  return [...new Set([...блок.matchAll(/prefix:\s*"([a-z][a-z-]*)"/g)].map((m) => m[1]))];
}

describe("обещание написать в день запуска обеспечено рассылкой", () => {
  const обещали = комуОбещали(readFileSync(CONFIRM, "utf8"));
  const получат = ктоПолучитПисьмо(readFileSync(ANNOUNCE, "utf8"));

  it("прибор видит оба списка", () => {
    // без этого «расхождений нет» означало бы «оба пустые»
    expect(обещали.length).toBeGreaterThanOrEqual(5);
    expect(получат.length).toBeGreaterThanOrEqual(5);
    expect(обещали).toContain("cyberchess");
    expect(получат).toContain("cyberchess");
  });

  it("каждому, кому обещали, есть что отправить", () => {
    const без = обещали.filter((p) => !получат.includes(p));
    expect(
      без,
      "этим модулям обещано «напишем в день запуска», а рассылки для них нет — "
      + "подписчик получит обещание и ничего больше: " + без.join(", "),
    ).toEqual([]);
  });

  it("рассылка не пишет тем, кому не обещали", () => {
    const лишние = получат.filter((p) => !обещали.includes(p));
    expect(
      лишние,
      "рассылка знает модуль, которому письма не обещали — это письмо без "
      + "основания: " + лишние.join(", "),
    ).toEqual([]);
  });
});
