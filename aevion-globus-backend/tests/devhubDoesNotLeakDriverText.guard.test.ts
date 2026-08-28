import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Сырой текст исключения не уходит клиенту оттуда, где он может прийти от
 * драйвера базы или внешнего вызова.
 *
 * Замер 29.08.2026: в devhub.ts было 45 ответов 500, и в 22 из них наружу
 * шёл e?.message из блока, где рядом стоит pool.query, await db*, fetch()
 * или вызов провайдера. Такой текст бывает вида
 * "connect ECONNREFUSED 10.130.0.7:5432" — внутренний адрес и порт базы.
 *
 * Все 22 обёрнуты в safeErrorText, поэтому сторож требует НОЛЬ, а не
 * храповик: вечно красная проверка перестаёт читаться в первый же день.
 */
const SRC = readFileSync(join(__dirname, "..", "src", "routes", "devhub.ts"), "utf8");
const LINES = SRC.split(String.fromCharCode(10));

function risky(): string[] {
  const out: string[] = [];
  LINES.forEach((l, i) => {
    if (l.includes("safeErrorText")) return;
    if (!l.includes("e?.message") && !l.includes("err?.message")) return;
    if (!l.includes("res.status") && !l.includes("res.json")) return;
    const ctx = LINES.slice(Math.max(0, i - 25), i).join(String.fromCharCode(10));
    const external =
      ctx.includes("pool.query") ||
      ctx.includes("await db") ||
      ctx.includes("fetch(") ||
      ctx.includes("callProvider");
    if (external) out.push(String(i + 1));
  });
  return out;
}

describe("текст исключения от базы и внешних вызовов не уходит клиенту", () => {
  test("прибор работает: обёрнутые места найдены", () => {
    // Без этого «нарушений нет» означало бы и «файл не прочитался», и
    // «шаблон ничего не понимает» — то есть ничего.
    const wrapped = LINES.filter((l) => l.includes("safeErrorText(")).length;
    expect(wrapped, "ни одного вызова safeErrorText — разбор не сработал").toBeGreaterThan(10);
    expect(LINES.length, "файл не прочитался").toBeGreaterThan(1000);
  });

  test("ни одного места с сырым e?.message рядом с базой или сетью", () => {
    expect(
      risky(),
      "сырой текст исключения уходит клиенту: оберните в safeErrorText(e) из lib/safeErrorText",
    ).toEqual([]);
  });
});
