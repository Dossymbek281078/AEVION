import { describe, test, expect, beforeEach, vi, afterEach } from "vitest";

/**
 * Каждое событие несёт метку канала — иначе отчёт видит «начали оплату» и не
 * может сказать, откуда пришёл человек.
 *
 * Найдено 30.08.2026: из десяти мест, шлющих checkout_start, метку клали ДВА.
 * Восемь остальных — страницы модулей, витрина, тарифы, посадочные под ролики.
 * Сводка воронки читает только meta.channel; поле path рядом тоже несёт ?c=,
 * но никто его не разбирает.
 *
 * Проверяется ТЕЛО запроса, а не наличие кода: греп здесь зелен и на сломанном
 * коде — слово channel встречается в пояснениях.
 */

const fetchMock = vi.fn(() => Promise.resolve(new Response("{}")));

function at(search: string) {
  window.history.replaceState({}, "", "/qlearn" + search);
}

function sentBody(): Record<string, unknown> {
  expect(fetchMock, "событие не отправлено вовсе").toHaveBeenCalled();
  const init = (fetchMock.mock.calls[0] as unknown[])[1] as { body: string };
  return JSON.parse(init.body);
}

beforeEach(async () => {
  // Канал теперь переживает поход в кассу и хранится во вкладке (track.ts,
  // 31.08.2026). Значит соседний тест с `?c=yt` оставляет метку следующему, и
  // проверки «без метки» и «выдуманная метка» молча становятся слабее: они
  // увидели бы чужой канал вместо своего. Чистим — проверки остаются строгими.
  try {
    sessionStorage.clear();
  } catch {
    // приватный режим — хранилища нет, чистить нечего
  }
  vi.resetModules();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  // sendBeacon в jsdom нет; убираем явно, чтобы путь отправки был один и тот же.
  vi.stubGlobal("navigator", { ...window.navigator, sendBeacon: undefined });
  at("");
});

afterEach(() => vi.unstubAllGlobals());

async function track(payload: Parameters<typeof import("../track").track>[0]) {
  const mod = await import("../track");
  mod.track(payload);
}

describe("метка канала доезжает до отчёта", () => {
  test("берётся из адреса, даже если отправитель её не передал", async () => {
    at("?c=tg");
    await track({ type: "checkout_start", source: "upgrade-button/qlearn" });

    const body = sentBody();
    expect((body.meta as Record<string, unknown>)?.channel, "канал не доехал").toBeTruthy();
  });

  test("переданная отправителем старше найденной в адресе", async () => {
    at("?c=yt");
    await track({ type: "checkout_start", source: "go", meta: { channel: "Telegram" } });

    expect((sentBody().meta as Record<string, unknown>).channel).toBe("Telegram");
  });

  test("без метки поле не появляется — пустое значение хуже отсутствия", async () => {
    await track({ type: "checkout_start", source: "pricing" });

    const meta = (sentBody().meta ?? {}) as Record<string, unknown>;
    expect(Object.keys(meta)).not.toContain("channel");
  });

  test("выдуманная метка не принимается — иначе отчёт наполнится мусором", async () => {
    at("?c=zzzz");
    await track({ type: "checkout_start", source: "pricing" });

    const meta = (sentBody().meta ?? {}) as Record<string, unknown>;
    expect(Object.keys(meta)).not.toContain("channel");
  });

  test("правило общее для всех событий, не только для оплаты", async () => {
    at("?c=tg");
    await track({ type: "lead_submit", source: "go" });

    expect((sentBody().meta as Record<string, unknown>)?.channel).toBeTruthy();
  });
});
