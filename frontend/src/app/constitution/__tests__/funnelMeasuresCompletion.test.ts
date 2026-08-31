import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * У измеряемого НАЧАЛА есть измеряемое ЗАВЕРШЕНИЕ.
 *
 * Замер 29.08.2026: в словаре воронки 18 событий, и восемь не отправлял никто.
 * Два из них — завершения, у которых начало отправляется исправно:
 *
 *   tour_started    → шлётся    | tour_completed   → НЕ шлётся
 *   upgrade_click   → шлётся    | upgrade_complete → НЕ шлётся
 *
 * Это худший вид дыры в измерении: цифры выглядят полными. Видно, сколько людей
 * НАЧАЛО знакомство с продуктом и сколько нажало «Купить», — а сколько дошло до
 * конца и сколько заплатило, не видно вовсе. Конверсия при этом не «низкая»,
 * её просто некому записать.
 *
 * Остальные шесть неотправляемых событий сторож не трогает намеренно: у них нет
 * работающего начала (блог, комментарии, голоса, академия), то есть это словарь
 * на будущее, а не потерянное измерение. Сторож, краснеющий на задел, приучает
 * себя не читать.
 */

const APP = join(__dirname, "..", "..");

function allSources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "__tests__") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...allSources(p));
    else if (name.endsWith(".tsx") || name.endsWith(".ts")) out.push(p);
  }
  return out;
}

const sources = allSources(APP).map((p) => readFileSync(p, "utf8"));
const sends = (event: string) =>
  sources.filter((s) => s.includes(`track("${event}"`)).length;

describe("воронка измеряет не только начало", () => {
  test("контроль: счётчик вообще видит отправки", () => {
    expect(sends("page_view")).toBeGreaterThan(0);
    expect(sends("no_such_event_at_all")).toBe(0);
  });

  test.each([
    ["tour_started", "tour_completed"],
    ["upgrade_click", "upgrade_complete"],
  ])("%s измеряется — значит и %s тоже", (start, done) => {
    expect(sends(start), `начало ${start} перестало отправляться`).toBeGreaterThan(0);
    expect(
      sends(done),
      `начало измеряем, а завершение ${done} — нет: видно, сколько людей начало, и никогда — сколько дошло`,
    ).toBeGreaterThan(0);
  });

  test("завершение тура отправляется один раз за тур, а не на каждый заход", () => {
    const page = readFileSync(join(APP, "constitution", "page.tsx"), "utf8");
    // Проверяется не НАЛИЧИЕ защёлки, а то, что она стоит В УСЛОВИИ отправки.
    // Первая версия теста искала просто имя переменной и была слепа: мутация
    // «убрать условие» её не роняла — форма закреплена, следствие нет.
    const guardedSend = /if\s*\([^)]*!\w*[Ff]inished\w*\.current[^)]*\)/.test(page);
    expect(
      guardedSend,
      "отправка завершения не закрыта защёлкой: возврат на последний шаг посчитается новым прохождением, и метрика завысится",
    ).toBe(true);
  });
});
