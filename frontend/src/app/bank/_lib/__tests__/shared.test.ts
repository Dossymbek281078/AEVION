import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sharedPingBackend, sharedFetchMe, __resetBankShared } from "../shared";

/**
 * Issue #1035: на `/bank` `health` и `auth/me` уходили по два раза — их
 * независимо просят `_hooks/usePreflight` и `_lib/api.ts`.
 *
 * Самое важное здесь не трафик, а привязка кэша `auth/me` К ТОКЕНУ: без неё
 * после входа или выхода второй потребитель получил бы ответ предыдущего
 * пользователя.
 */

const USER = { id: "u1", email: "a@b.c" };

beforeEach(() => __resetBankShared());
afterEach(() => vi.restoreAllMocks());

function mockFetch(impl: (url: string, init?: RequestInit) => { ok: boolean; status?: number; body?: unknown }) {
  const fn = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    const { ok, status, body } = impl(String(url), init);
    return { ok, status: status ?? (ok ? 200 : 401), json: async () => body ?? {} };
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe("health — один запрос на всех", () => {
  it("параллельные вызовы схлопываются в один", async () => {
    const f = mockFetch(() => ({ ok: true }));
    const [a, b] = await Promise.all([sharedPingBackend(), sharedPingBackend()]);
    expect(f).toHaveBeenCalledTimes(1);
    expect(a).toBe(true);
    expect(b).toBe(true);
  });

  it("404 значит «сервер живой, ручки нет»", async () => {
    mockFetch(() => ({ ok: false, status: 404 }));
    expect(await sharedPingBackend()).toBe(true);
  });

  it("force обходит кэш — кнопка «проверить снова» не должна врать", async () => {
    const f = mockFetch(() => ({ ok: true }));
    await sharedPingBackend(1_000);
    await sharedPingBackend(2_000); // в пределах TTL → из кэша
    expect(f).toHaveBeenCalledTimes(1);
    await sharedPingBackend(2_000, true); // явная перепроверка
    expect(f).toHaveBeenCalledTimes(2);
  });
});

describe("auth/me — кэш привязан к токену", () => {
  it("один и тот же токен: два вызова — один запрос", async () => {
    const f = mockFetch(() => ({ ok: true, body: { user: USER } }));
    const [a, b] = await Promise.all([sharedFetchMe("tok-1"), sharedFetchMe("tok-1")]);
    expect(f).toHaveBeenCalledTimes(1);
    expect(a.user).toEqual(USER);
    expect(b.ok).toBe(true);
  });

  it("СМЕНА токена = новый запрос, а не чужой закэшированный ответ", async () => {
    const f = mockFetch((_u, init) => {
      const auth = String((init?.headers as Record<string, string>)?.Authorization ?? "");
      return { ok: true, body: { user: { id: auth.replace("Bearer ", "") } } };
    });
    const first = await sharedFetchMe("tok-1", 1_000);
    const second = await sharedFetchMe("tok-2", 1_100); // в пределах TTL, но токен другой
    expect(f).toHaveBeenCalledTimes(2);
    expect(first.user?.id).toBe("tok-1");
    // Вот это и есть суть: второй пользователь не должен увидеть первого.
    expect(second.user?.id).toBe("tok-2");
  });

  it("пустой токен — без запроса вообще", async () => {
    const f = mockFetch(() => ({ ok: true, body: { user: USER } }));
    const r = await sharedFetchMe("");
    expect(f).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: false, user: null });
  });

  it("отвергнутый токен: ok=false, и это кэшируется (ответ определённый)", async () => {
    const f = mockFetch(() => ({ ok: false, status: 401 }));
    expect(await sharedFetchMe("bad", 1_000)).toEqual({ ok: false, user: null });
    await sharedFetchMe("bad", 2_000);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("force обходит кэш и для me", async () => {
    const f = mockFetch(() => ({ ok: true, body: { user: USER } }));
    await sharedFetchMe("tok-1", 1_000);
    await sharedFetchMe("tok-1", 2_000, true);
    expect(f).toHaveBeenCalledTimes(2);
  });
});
