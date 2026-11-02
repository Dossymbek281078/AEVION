import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { оплатаНаша, ЛЕГАСИ_ОПЛАТЫ_НАШИ } from "../src/routes/events";

/**
 * 02.11.2026: два payment_confirmed 30.10 18:12Z — смоук вебхука LS со свой:false — считались
 * живыми оплатами (замер Науки). Сторож: счёт оплат везде идёт через оплатаНаша, а она знает
 * признак вебхука, тестовый режим кассы и известные отметки смоука.
 */
const SRC = readFileSync(join(__dirname, "..", "src", "routes", "events.ts"), "utf8");

describe("оплаты смоука — наши", () => {
  it("обе отметки 30.10 — наши, живая оплата — нет", () => {
    for (const ts of ЛЕГАСИ_ОПЛАТЫ_НАШИ) expect(оплатаНаша({ ts, meta: { свой: false } })).toBe(true);
    expect(оплатаНаша({ ts: "2026-10-30T18:12:06.828Z", meta: {} })).toBe(true);
    expect(оплатаНаша({ ts: "2026-11-01T10:00:00.000Z", meta: { свой: false } })).toBe(false);
    expect(оплатаНаша({ ts: "2026-11-01T10:00:00.000Z", meta: { testMode: true } })).toBe(true);
    expect(оплатаНаша({ ts: "2026-11-01T10:00:00.000Z", meta: { свой: true } })).toBe(true);
  });
  it("ни один счётчик paidOurs не читает meta.свой напрямую", () => {
    const прямых = SRC.split("\n").filter((l) => /paidOurs/.test(l) === false && /meta\?\.свой === true\)/.test(l) && !/mark-ours|return line/.test(l));
    expect(прямых).toEqual([]);
    expect((SRC.match(/оплатаНаша\(ev\)/g) || []).length).toBeGreaterThanOrEqual(3);
  });
});
