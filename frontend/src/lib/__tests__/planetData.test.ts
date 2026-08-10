import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchPlanetStats, fetchRecentArtifacts, __resetPlanetCache } from "../planetData";

/**
 * Issue #1028: на главной `planet/stats` и `planet/artifacts/recent` уходили
 * по два раза — их независимо просят `app/page.tsx` и смонтированный внутри
 * неё `PlanetPulse`, причём recent с РАЗНЫМИ лимитами (5 и 4). Поэтому мало
 * дедупликации по URL: нужен один запрос с бо́льшим лимитом и нарезка под
 * каждого потребителя.
 */

const STATS = { eligibleParticipants: 7, distinctVotersAllTime: 42, certifiedArtifactVersions: 3 };
const ROWS = Array.from({ length: 8 }, (_, i) => ({ id: `a${i + 1}` }));

beforeEach(() => __resetPlanetCache());
afterEach(() => vi.restoreAllMocks());

function mockFetch(handler: (url: string) => { ok: boolean; body: unknown }) {
  const fn = vi.fn().mockImplementation(async (url: string) => {
    const { ok, body } = handler(String(url));
    return { ok, status: ok ? 200 : 500, json: async () => body };
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe("planetData — один запрос на всех потребителей", () => {
  it("stats: два параллельных вызова дают один сетевой запрос", async () => {
    const f = mockFetch(() => ({ ok: true, body: STATS }));
    const [a, b] = await Promise.all([fetchPlanetStats(), fetchPlanetStats()]);
    expect(f).toHaveBeenCalledTimes(1);
    expect(a).toEqual(STATS);
    expect(b).toEqual(STATS);
  });

  it("recent: лимиты 5 и 4 обслуживаются ОДНИМ запросом", async () => {
    const f = mockFetch(() => ({ ok: true, body: { items: ROWS } }));
    const [five, four] = await Promise.all([fetchRecentArtifacts(5), fetchRecentArtifacts(4)]);
    expect(f).toHaveBeenCalledTimes(1);
    expect(five).toHaveLength(5);
    expect(four).toHaveLength(4);
    // Порядок сохранён: каждый получает свежие N, а не случайный срез.
    expect(four?.map((r) => r.id)).toEqual(["a1", "a2", "a3", "a4"]);
    expect(five?.map((r) => r.id)).toEqual(["a1", "a2", "a3", "a4", "a5"]);
  });

  it("recent: запрошенный лимит покрывает обоих потребителей", async () => {
    const f = mockFetch(() => ({ ok: true, body: { items: ROWS } }));
    await fetchRecentArtifacts(5);
    const url = String(f.mock.calls[0][0]);
    const asked = Number(url.match(/limit=(\d+)/)?.[1]);
    // Иначе нарезка под 5 молча вернула бы меньше, чем просили.
    expect(asked).toBeGreaterThanOrEqual(5);
  });

  it("последовательный вызов в пределах TTL сети не касается", async () => {
    const f = mockFetch(() => ({ ok: true, body: STATS }));
    await fetchPlanetStats(1_000);
    await fetchPlanetStats(20_000);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("после TTL идёт свежий запрос", async () => {
    const f = mockFetch(() => ({ ok: true, body: STATS }));
    await fetchPlanetStats(1_000);
    await fetchPlanetStats(40_000);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("ошибку не кэшируем: сбой не гасит блок до перезагрузки", async () => {
    mockFetch(() => ({ ok: false, body: {} }));
    expect(await fetchPlanetStats(1_000)).toBeNull();
    const good = mockFetch(() => ({ ok: true, body: STATS }));
    expect(await fetchPlanetStats(2_000)).toEqual(STATS);
    expect(good).toHaveBeenCalledTimes(1);
  });

  it("не-массив в items → null, чтобы «нет данных» не выглядело как «пусто»", async () => {
    mockFetch(() => ({ ok: true, body: { items: "нет" } }));
    expect(await fetchRecentArtifacts(4)).toBeNull();
  });
});
