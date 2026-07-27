import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchPlanetStats, fetchRecentArtifacts, __resetPlanetPulseCache } from "../planetPulse";

/**
 * Issue #1016: на главной `planet/stats` и `planet/artifacts/recent`
 * запрашивались дважды — сама страница и смонтированный на ней виджет
 * `PlanetPulse` ходили за одними данными независимо. Данные у обоих одни,
 * значит и запрос должен быть один.
 */

const STATS = {
  eligibleParticipants: 12,
  distinctVotersAllTime: 34,
  certifiedArtifactVersions: 5,
  submissions: 7,
};

const ITEMS = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }];

beforeEach(() => __resetPlanetPulseCache());
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

describe("fetchPlanetStats — один запрос на всех потребителей", () => {
  it("два параллельных вызова дают ОДИН сетевой запрос", async () => {
    const f = mockFetch(200, STATS);
    const [a, b] = await Promise.all([fetchPlanetStats(), fetchPlanetStats()]);
    expect(f).toHaveBeenCalledTimes(1);
    expect(a).toEqual(STATS);
    expect(b).toEqual(STATS);
  });

  it("последовательные вызовы в пределах TTL не ходят в сеть заново", async () => {
    const f = mockFetch(200, STATS);
    const t = 1_000_000;
    await fetchPlanetStats(t);
    await fetchPlanetStats(t + 5_000);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("после TTL запрос повторяется — данные не застывают навсегда", async () => {
    const f = mockFetch(200, STATS);
    const t = 1_000_000;
    await fetchPlanetStats(t);
    await fetchPlanetStats(t + 31_000);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("ошибка не кэшируется — одна неудача не гасит блок до перезагрузки", async () => {
    const bad = mockFetch(500, null);
    expect(await fetchPlanetStats(1_000)).toBeNull();
    expect(bad).toHaveBeenCalledTimes(1);

    const good = mockFetch(200, STATS);
    expect(await fetchPlanetStats(2_000)).toEqual(STATS);
    expect(good).toHaveBeenCalledTimes(1);
  });
});

describe("fetchRecentArtifacts — один список на разные лимиты", () => {
  it("запрос за 5 и за 4 — один поход в сеть, второму отдаётся срез", async () => {
    const f = mockFetch(200, { items: ITEMS });
    const t = 1_000_000;
    const five = await fetchRecentArtifacts(5, t);
    const four = await fetchRecentArtifacts(4, t);
    expect(f).toHaveBeenCalledTimes(1);
    expect(five).toHaveLength(5);
    expect(four).toHaveLength(4);
    expect(four).toEqual(ITEMS.slice(0, 4));
  });

  it("если нужно БОЛЬШЕ, чем получено, идём в сеть заново", async () => {
    // Отдать четыре тому, кто просил пять, значит молча показать неполную ленту.
    const f = mockFetch(200, { items: ITEMS.slice(0, 4) });
    const t = 1_000_000;
    await fetchRecentArtifacts(4, t);
    mockFetch(200, { items: ITEMS });
    const five = await fetchRecentArtifacts(5, t);
    expect(f).toHaveBeenCalledTimes(1); // первый мок больше не вызывался
    expect(five).toHaveLength(5);
  });

  it("ответ без массива items считается неудачей, а не пустой лентой", async () => {
    mockFetch(200, { oops: true });
    expect(await fetchRecentArtifacts(5, 1_000)).toBeNull();
  });

  it("параллельные вызовы разделяют один запрос", async () => {
    const f = mockFetch(200, { items: ITEMS });
    const [a, b] = await Promise.all([fetchRecentArtifacts(5), fetchRecentArtifacts(4)]);
    expect(f).toHaveBeenCalledTimes(1);
    expect(a).toHaveLength(5);
    expect(b).toHaveLength(4);
  });
});
