import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Платный тариф не даёт МЕНЬШЕ бесплатного — ни по одной возможности.
 *
 * Конкретные числа в таблице лимитов — продуктовое решение, и сторож их не
 * трогает. А вот СООТНОШЕНИЕ решением не является: человек, заплативший
 * $149/мес и получивший меньше, чем не платящий, — это не «такой пакет», это
 * описка. Заметить её глазами трудно: таблица читается по строкам-тарифам, а
 * сравнивать надо по столбцам-возможностям.
 *
 * Замер 28.08.2026: одно нарушение — озвучка, у free 100 000 знаков против
 * 30 000 у pro. Втрое меньше голоса за деньги. Число не правил: состав пакета
 * решает основатель. Оно внесено в список исключений ПОИМЁННО и с причиной —
 * чтобы сторож защищал остальные возможности уже сейчас, а не ждал решения.
 *
 * Когда число поправят, строку из исключений убрать: тогда правило станет
 * безусловным.
 */

const FILE = path.join(__dirname, "..", "src", "routes", "devhub.ts");

/**
 * Известное расхождение, ждущее решения основателя.
 * Список без причин через месяц становится местом, куда дописывают, чтобы
 * сторож замолчал, — поэтому здесь и имя, и почему.
 */
// Пусто НАМЕРЕННО: 05.09.2026 расхождение tts (free 100000 > pro 30000)
// исправлено (free 10000, pro 200000 — числа вынесены основателю в
// Desktop\АЕВИОН\05-DevHub\2026-09-05-DevHub-доведение-что-сделано.md),
// и правило стало безусловным. Оба окна убрали исключение независимо —
// комментарии слиты при мерже 06.09. Новая строка сюда — только с датой и
// ссылкой на решение основателя.
const KNOWN: Record<string, string> = {};

type Limits = Record<string, Record<string, number>>;

function tierLimits(): Limits {
  const src = fs.readFileSync(FILE, "utf8");
  const start = src.indexOf("const TIER_LIMITS");
  const end = src.indexOf("};", start);
  expect(start, "таблица лимитов не найдена — сторож смотрит не туда").toBeGreaterThan(-1);
  const block = src.slice(start, end);
  const out: Limits = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^\s*([a-z]+):\s*\{(.*)\},?\s*$/);
    if (!m) continue;
    const caps: Record<string, number> = {};
    for (const pair of m[2].matchAll(/([a-z_]+):\s*(-?\d+)/g)) caps[pair[1]] = Number(pair[2]);
    if (Object.keys(caps).length) out[m[1]] = caps;
  }
  return out;
}

/** -1 означает «без предела», то есть больше любого числа. */
const value = (n: number) => (n === -1 ? Number.POSITIVE_INFINITY : n);

describe("платный тариф не хуже бесплатного", () => {
  test("прибор работает: таблица разобрана, тарифы и возможности на месте", () => {
    const t = tierLimits();
    expect(Object.keys(t), "тарифы не разобраны").toEqual(expect.arrayContaining(["free", "pro"]));
    expect(Object.keys(t.free).length, "возможности не разобраны").toBeGreaterThan(3);
    // Контроль в обратную сторону: безлимит обязан считаться большим числом.
    expect(value(-1)).toBeGreaterThan(value(1000000));
  });

  test("ни одна возможность у pro не меньше, чем у free", () => {
    const t = tierLimits();
    const worse = Object.keys(t.free)
      .filter((cap) => value(t.pro[cap]) < value(t.free[cap]))
      .filter((cap) => !(cap in KNOWN))
      .map((cap) => `${cap}: free ${t.free[cap]} > pro ${t.pro[cap]}`);
    expect(worse, "платящий получает меньше неплатящего").toEqual([]);
  });

  test("enterprise не хуже pro", () => {
    const t = tierLimits();
    const worse = Object.keys(t.pro)
      .filter((cap) => value(t.enterprise[cap]) < value(t.pro[cap]))
      .map((cap) => `${cap}: pro ${t.pro[cap]} > enterprise ${t.enterprise[cap]}`);
    expect(worse).toEqual([]);
  });

  test("известное расхождение всё ещё существует — иначе исключение пора убрать", () => {
    // Исключение, пережившее свою причину, — это тихо выключенная проверка.
    const t = tierLimits();
    for (const cap of Object.keys(KNOWN)) {
      expect(
        value(t.pro[cap]) < value(t.free[cap]),
        `${cap} уже поправлен — удалите строку из KNOWN, правило станет безусловным`,
      ).toBe(true);
    }
  });
});
