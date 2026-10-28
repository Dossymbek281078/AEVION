import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

/*
 * 28.10.2026. Sentry AEVION-BACKEND-B «AbortError: This operation was aborted», GET /api/aevion/health:
 * 258 событий с 12.08, 0 пользователей — проба соседней ручки не уложилась в 3 с, и probe()
 * отправлял ожидаемый таймаут в Sentry как ошибку. Таймаут остаётся в теле ответа (error:"timeout"),
 * а capture зовётся только для настоящих сбоев. Мутация 28.10: убрать условие `if (!таймаут)` перед
 * capture → тест 1 красный (проверено).
 */
const захват = vi.fn();
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => захват }));

const { probe } = await import("../src/routes/aevion-hub");

const запрос = { headers: { host: "127.0.0.1:4001", "x-forwarded-proto": "http" }, protocol: "http" } as unknown as import("express").Request;

// fetch, который висит до отмены сигналом — как соседняя ручка, не ответившая за timeoutMs.
const висящийFetch = (_url: unknown, init?: { signal?: AbortSignal }) =>
  new Promise<Response>((_resolve, reject) => {
    const s = init?.signal;
    if (s?.aborted) return reject(Object.assign(new Error("This operation was aborted"), { name: "AbortError" }));
    s?.addEventListener("abort", () => reject(Object.assign(new Error("This operation was aborted"), { name: "AbortError" })));
  });

const исходныйFetch = globalThis.fetch;
beforeEach(() => { захват.mockClear(); });
afterEach(() => { globalThis.fetch = исходныйFetch; });

describe("probe соседней ручки: таймаут — исход, а не ошибка Sentry", () => {
  test("🔴 таймаут: ok=false, body.error=timeout, capture НЕ вызван", async () => {
    globalThis.fetch = висящийFetch as unknown as typeof fetch;
    const r = await probe(запрос, "/api/devhub/openapi.json", 30);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(0);
    expect(r.body).toEqual({ error: "timeout", timeoutMs: 30 });
    expect(r.durationMs).toBeGreaterThanOrEqual(25);
    expect(захват).not.toHaveBeenCalled();
  });

  test("настоящий сбой (сеть): capture вызван один раз, текст ошибки в теле", async () => {
    globalThis.fetch = (async () => { throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }); }) as unknown as typeof fetch;
    const r = await probe(запрос, "/api/devhub/openapi.json", 1000);
    expect(r.ok).toBe(false);
    expect(r.body).toEqual({ error: "connect ECONNREFUSED" });
    expect(захват).toHaveBeenCalledTimes(1);
  });

  test("ответ пришёл вовремя: ok и status как у ручки", async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
    const r = await probe(запрос, "/api/devhub/openapi.json", 1000);
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
    expect(захват).not.toHaveBeenCalled();
  });
});
