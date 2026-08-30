/**
 * «Не знаю» — отдельный исход, а не разновидность «не оплачено».
 *
 * Это главное, что здесь проверяется. Если склеить их в булево, страница
 * покажет «купите» тому, чей статус не выяснила: не залогинен в этом
 * браузере, протух токен, лежит сеть. Человеку, который уже заплатил,
 * предложат заплатить снова — а он не станет спорить, он уйдёт.
 *
 * Тот же дефект уже ловили в кабинете и чинили признаком `ownedUnknown`;
 * здесь он закрыт с самого начала.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { checkAppAccess } from "../appAccess";
import * as auth from "../auth";

const originalFetch = globalThis.fetch;

function mockFetch(impl: () => Promise<Response> | Response) {
  globalThis.fetch = vi.fn(impl) as unknown as typeof fetch;
}

function json(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  vi.spyOn(auth, "getAuthToken").mockReturnValue("test-token");
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("оплачен ли модуль: три исхода, а не два", () => {
  it("сервер сказал active:true — оплачено", async () => {
    mockFetch(() => json({ active: true }));
    expect(await checkAppAccess("cyberchess")).toBe("owned");
  });

  it("сервер сказал active:false — НЕ оплачено", async () => {
    // Отрицательный контроль: без него всё ниже было бы зелёным на функции,
    // которая всегда отвечает «не знаю».
    mockFetch(() => json({ active: false }));
    expect(await checkAppAccess("cyberchess")).toBe("not-owned");
  });

  it("без токена — НЕ ЗНАЮ, а не «не оплачено»", async () => {
    vi.spyOn(auth, "getAuthToken").mockReturnValue(null);
    let called = false;
    mockFetch(() => {
      called = true;
      return json({ active: false });
    });
    expect(await checkAppAccess("cyberchess")).toBe("unknown");
    expect(called, "без токена запрос слать незачем").toBe(false);
  });

  it("протухший токен (401) — НЕ ЗНАЮ", async () => {
    // Человек мог купить вчера и всего лишь не перелогиниться.
    mockFetch(() => json({ error: "unauthorized" }, 401));
    expect(await checkAppAccess("cyberchess")).toBe("unknown");
  });

  it("база недоступна (500) — НЕ ЗНАЮ", async () => {
    mockFetch(() => json({ error: "db error" }, 500));
    expect(await checkAppAccess("cyberchess")).toBe("unknown");
  });

  it("сеть легла — НЕ ЗНАЮ, а не падение", async () => {
    mockFetch(() => Promise.reject(new Error("network down")));
    expect(await checkAppAccess("cyberchess")).toBe("unknown");
  });

  it("непонятный формат ответа — НЕ ЗНАЮ", async () => {
    // Формат когда-нибудь изменится. «Не разобрал» обязано быть «не знаю»,
    // а не «не оплачено»: цена ошибки в эту сторону — потерянный покупатель.
    mockFetch(() => json({ active: "yes" }));
    expect(await checkAppAccess("cyberchess")).toBe("unknown");
    mockFetch(() => json({}));
    expect(await checkAppAccess("cyberchess")).toBe("unknown");
  });

  it("пустой слаг не идёт на сервер", async () => {
    let called = false;
    mockFetch(() => {
      called = true;
      return json({ active: true });
    });
    expect(await checkAppAccess("")).toBe("unknown");
    expect(called).toBe(false);
  });

  it("слаг уезжает в параметр, а не в путь", async () => {
    // Иначе слаг с косой чертой сменил бы адрес запроса.
    let seen = "";
    mockFetch((...args: unknown[]) => {
      seen = String((args as [string])[0]);
      return json({ active: true });
    });
    await checkAppAccess("ip_bureau");
    expect(seen).toContain("app=ip_bureau");
  });
});
