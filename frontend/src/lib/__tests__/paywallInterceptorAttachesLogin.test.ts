import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { нашАдрес, installPaywallInterceptor } from "../paywall";
import { AUTH_TOKEN_KEY } from "../auth";

/**
 * Стена узнаёт человека только по `Authorization: Bearer`. Из 55 вызовов фронта
 * к закрытым префиксам 30 шли без заголовка — заплативший получал 402 как гость.
 * Вход подставляется в перехватчике; здесь проверяются ТРИ его границы, потому
 * что нарушение любой дороже самой починки.
 */
describe("свой адрес отличается от чужого", () => {
  it("наши адреса узнаются", () => {
    for (const u of ["/api-backend/api/healthai/plan", "/api/pricing", "https://api.aevion.app/api/qlearn"]) {
      expect(нашАдрес(u), `${u} — наш`).toBe(true);
    }
  });
  it("КОНТРОЛЬ: чужие адреса НЕ узнаются", () => {
    for (const u of ["https://example.com/api/healthai", "https://api.lemonsqueezy.com/v1/products", "https://evil.tld/?x=/api-backend"]) {
      expect(нашАдрес(u), `${u} — чужой, токен туда не уходит`).toBe(false);
    }
  });
});

describe("перехватчик подставляет вход", () => {
  let звонки: Array<{ url: string; auth: string | null }>;
  const исходный = globalThis.fetch;

  beforeEach(() => {
    звонки = [];
    localStorage.clear();
    // снимаем отметку «уже установлен», иначе второй тест не переустановит
    delete (window as unknown as Record<symbol, unknown>)[Symbol.for("aevion.paywall.fetchPatched")];
    window.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : (input as Request).url ?? String(input);
      const h = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      звонки.push({ url, auth: h.get("authorization") });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    installPaywallInterceptor();
  });
  afterEach(() => { globalThis.fetch = исходный; });

  it("нашему адресу вход добавляется", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "t0ken");
    await fetch("/api-backend/api/healthai/plan");
    expect(звонки[0].auth, "вход не доехал — стена снова увидит гостя").toBe("Bearer t0ken");
  });

  it("КОНТРОЛЬ: чужому адресу вход НЕ добавляется", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "t0ken");
    await fetch("https://example.com/x");
    expect(звонки[0].auth, "токен ушёл чужому серверу").toBeNull();
  });

  it("КОНТРОЛЬ: без токена ничего не добавляется", async () => {
    await fetch("/api-backend/api/healthai/plan");
    expect(звонки[0].auth).toBeNull();
  });

  it("КОНТРОЛЬ: свой Authorization вызывающего не перетирается", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "t0ken");
    await fetch("/api-backend/api/x", { headers: { Authorization: "Bearer chuzhoj" } });
    expect(звонки[0].auth).toBe("Bearer chuzhoj");
  });
});
