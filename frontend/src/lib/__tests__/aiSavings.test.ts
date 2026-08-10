import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchAiSavings, __resetAiSavingsCache } from "../aiSavings";

/**
 * Issue #1016: на `/pricing` счётчик экономии запрашивался 3 раза за загрузку —
 * его независимо просят виджет в шапке, сама страница и соседние блоки.
 * Число у всех одно, значит и запрос должен быть один.
 */

const OK = {
  runs: 12, facts: 4, light: 5, deep: 3,
  totalCostUsd: 0.42, estAlwaysCouncilUsd: 1.1, savedUsd: 0.68, savedPct: 61.8,
};

beforeEach(() => __resetAiSavingsCache());
afterEach(() => vi.restoreAllMocks());

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe("fetchAiSavings — один запрос на всех потребителей", () => {
  it("три параллельных вызова дают ОДИН сетевой запрос", async () => {
    const f = mockFetch(200, OK);
    const [a, b, c] = await Promise.all([fetchAiSavings(), fetchAiSavings(), fetchAiSavings()]);
    expect(f).toHaveBeenCalledTimes(1);
    expect(a).toEqual(OK);
    expect(b).toEqual(OK);
    expect(c).toEqual(OK);
  });

  it("повторный вызов в пределах TTL сети не касается", async () => {
    const f = mockFetch(200, OK);
    await fetchAiSavings(1_000);
    await fetchAiSavings(20_000); // +19с — внутри 30с
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("после TTL идёт свежий запрос — счётчик живой, а не замороженный", async () => {
    const f = mockFetch(200, OK);
    await fetchAiSavings(1_000);
    await fetchAiSavings(40_000); // +39с — TTL истёк
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("ошибку не кэшируем: один 502 не гасит счётчик до перезагрузки", async () => {
    const bad = mockFetch(502, {});
    expect(await fetchAiSavings(1_000)).toBeNull();
    const good = mockFetch(200, OK);
    expect(await fetchAiSavings(2_000)).toEqual(OK);
    expect(bad).toHaveBeenCalledTimes(1);
    expect(good).toHaveBeenCalledTimes(1);
  });

  it("мусор в ответе — null, а не полупустой объект на продающей странице", async () => {
    mockFetch(200, { runs: "много" });
    expect(await fetchAiSavings()).toBeNull();
  });
});
