import { describe, expect, test } from "vitest";
import { revenueTip } from "../revenueTip";

/**
 * 20.10.2026, окно «Приложения»: подсказка пилюли выручки на ru/kk заканчивалась хвостом
 * «($20M stretch goal)» — те самые 2 английских слова, что прибор языка находил на первом
 * экране КАЖДОЙ страницы при ru/kk на ширине ≥540 (прод cde01b698, /qsign и /qsign/verify).
 */
const words = (s: string) => [...s.matchAll(/[A-Za-z][A-Za-z]{2,}/g)].map((m) => m[0]);

describe("подсказка выручки без английского хвоста", () => {
  test("ru и kk — ни одного латинского слова (суммы $1M/$20M — не слова)", () => {
    expect(words(revenueTip("ru", 12345, 73))).toEqual([]);
    expect(words(revenueTip("kk", 12345, 73))).toEqual([]);
    expect(revenueTip("ru", 12345, 73)).toContain("$20M");
    expect(revenueTip("kk", 12345, 73)).toContain("$20M");
  });
  test("контроль: en по-прежнему английский", () => {
    expect(words(revenueTip("en", 12345, 73)).length).toBeGreaterThan(3);
    expect(revenueTip("en", 12345, 73)).toContain("stretch goal");
  });
});
