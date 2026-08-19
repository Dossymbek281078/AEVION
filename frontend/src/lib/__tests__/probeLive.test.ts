import { describe, expect, test, vi, afterEach } from "vitest";

import { probeLive, daysUntil } from "../probeLive";

// Проба живости для посадочных запуска — 19.08.2026.
//
// Функция короткая, но её правило неочевидно и легко «поправить» в обратную
// сторону: живым считается всё, что ответило НЕ 404, а не только 2xx. Без теста
// первый же читатель заменит это на `r.ok`, сочтя опечаткой, — и страницы начнут
// писать «проверяется» о работающих контурах.
//
// Почему именно так: у модулей, ради которых функция написана, осмысленные
// ответы как раз не 2xx.
//   POST /api/multichat/receipt/verify с неверным пакетом → 400 (поля проверены)
//   GET  /api/multichat/conversations без токена          → 402 (платная стена)
// А 404 отвечает и на несуществующий путь внутри живого роутера, и на
// отсутствующий роутер — то есть именно он означает «этого нет».

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Подменяет fetch статусом И ТЕЛОМ.
 *
 * Прежний помощник задавал только статус — и этого было достаточно, пока правило
 * читало статус. Теперь решает тело (см. шапку probeLive), поэтому тест без тела
 * проверял бы не то правило, которое работает.
 */
function stubFetch(status: number, body = "") {
  const calls: Array<[string, RequestInit | undefined]> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      calls.push([String(url), init]);
      return Promise.resolve({
        status,
        ok: status >= 200 && status < 300,
        text: () => Promise.resolve(body),
      } as unknown as Response);
    }),
  );
  return calls;
}

const EXPRESS_404 = "<!DOCTYPE html><html><body><pre>Cannot GET /api/no-such/abc</pre></body></html>";
const PAYWALL = '{"error":"upgrade_required","module":"multichat-engine","plan":"free"}';

describe("probeLive — четыре случая, замеренные на проде 19.08.2026", () => {
  // Каждый случай — реальный ответ api.aevion.app, а не придуманный.

  test("404 с доменной ошибкой — ЖИВО (маршрут есть, ресурса нет)", async () => {
    // GET /api/multichat/shared/launch-page-probe. Прежнее правило «не 404»
    // объявляло это мёртвым, и посадочная мультичата отрицала работающий
    // публичный просмотр беседы.
    stubFetch(404, '{"error":"not_found_or_revoked"}');
    await expect(probeLive("/api/multichat/shared/launch-page-probe")).resolves.toBe(true);
  });

  test("402 платной стены — НЕ доказательство, значит не живо", async () => {
    // GET /api/multichat/no-such-route-xyz: маршрута НЕТ, но стена модуля отвечает
    // раньше маршрутизации. Прежнее правило объявляло такой путь живым.
    stubFetch(402, PAYWALL);
    await expect(probeLive("/api/multichat/no-such-route-xyz")).resolves.toBe(false);
  });

  test("HTML «Cannot GET» — мертво", async () => {
    stubFetch(404, EXPRESS_404);
    await expect(probeLive("/api/no-such-module-xyz/abc")).resolves.toBe(false);
  });

  test("400 с доменной ошибкой — живо", async () => {
    // POST /api/multichat/receipt/verify с {} → not_a_receipt. Именно так и пробует
    // посадочная: методом POST, который стену не задевает.
    stubFetch(400, '{"error":"not_a_receipt","message":"Ожидается чек мультичата"}');
    await expect(probeLive("/api/multichat/receipt/verify", { method: "POST" })).resolves.toBe(true);
  });

  test("200 — живо", async () => {
    stubFetch(200, '{"providers":[{"id":"anthropic"}]}');
    await expect(probeLive("/api/qcoreai/providers")).resolves.toBe(true);
  });

  test("сетевая ошибка — не подтвердилось, а не «мертво»", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("ECONNREFUSED"))));
    await expect(probeLive("/api/x")).resolves.toBe(false);
  });

  test("init и кэш доезжают до fetch", async () => {
    const calls = stubFetch(200, "{}");
    await probeLive("/api/x", { method: "POST", body: "{}" });
    expect(calls).toHaveLength(1);
    expect(calls[0][1]?.method).toBe("POST");
    // Пробы кэшируются на полчаса: сборка не должна долбить прод при каждой странице.
    expect((calls[0][1] as { next?: { revalidate?: number } }).next?.revalidate).toBe(1800);
  });

  test("отрицательный контроль: правило различает тела, а не только коды", async () => {
    // Один и тот же код 404 даёт разные ответы — именно в этом суть починки.
    stubFetch(404, '{"error":"not_found_or_revoked"}');
    const alive = await probeLive("/a");
    vi.unstubAllGlobals();
    stubFetch(404, EXPRESS_404);
    const dead = await probeLive("/a");
    expect([alive, dead]).toEqual([true, false]);
  });
});

describe("daysUntil — счёт по UTC-полуночи", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("до даты — положительное число, в день — ноль", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T21:30:00Z"));
    expect(daysUntil(2026, 8, 13)).toBe(3);
    vi.setSystemTime(new Date("2026-09-13T00:00:01Z"));
    expect(daysUntil(2026, 8, 13)).toBe(0);
  });

  test("вечер и утро одного дня дают одинаковый ответ", () => {
    // Именно ради этого счёт идёт от UTC-полуночи: иначе страница, собранная
    // вечером и утром одного дня, показала бы разное число дней.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T23:59:00Z"));
    const evening = daysUntil(2026, 8, 20);
    vi.setSystemTime(new Date("2026-09-01T00:01:00Z"));
    expect(daysUntil(2026, 8, 20)).toBe(evening);
  });

  test("после даты — отрицательное, страница скажет «уже открыто»", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T10:00:00Z"));
    expect(daysUntil(2026, 8, 20)).toBeLessThan(0);
  });
});
