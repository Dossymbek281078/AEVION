import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Вошедший видит свои проекты DevHub: запросы /api/devhub несут его вход.
 *
 * Замер прода 4f71ad70f, 30.10.2026: гость создал сайт → вошёл (страница после
 * оплаты так и советует) → adopt-guest 200 перенёс проект в аккаунт и сменил
 * гостевой ключ → список /devhub уходил БЕЗ Authorization, с новым ключом, и
 * был пуст; с токеном тот же API проект отдаёт. Здесь обёртка вызывается.
 */
import { installDevhubGuestHeader, DEVHUB_GUEST_HEADER } from "../devhubGuest";

let снять: (() => void) | null = null;
let последний: Headers | null = null;

beforeEach(() => {
  window.localStorage.clear();
  последний = null;
  window.fetch = vi.fn(async (_i: RequestInfo | URL, init?: RequestInit) => {
    последний = new Headers(init?.headers as HeadersInit | undefined);
    return new Response("{}");
  }) as unknown as typeof window.fetch;
  снять = installDevhubGuestHeader();
});
afterEach(() => { снять?.(); снять = null; });

describe("вход в заголовке запросов DevHub", () => {
  test("вошедший: список проектов уходит с Bearer и с гостевым ключом", async () => {
    window.localStorage.setItem("aevion_auth_token_v1", "tok-abc");
    await window.fetch("https://aevion.app/api-backend/api/devhub/projects", { cache: "no-store" });
    expect(последний!.get("authorization")).toBe("Bearer tok-abc");
    expect(последний!.get(DEVHUB_GUEST_HEADER)).toBeTruthy();
  });

  test("гость без входа: только гостевой ключ, Authorization нет", async () => {
    await window.fetch("https://api.aevion.app/api/devhub/projects");
    expect(последний!.get("authorization")).toBeNull();
    expect(последний!.get(DEVHUB_GUEST_HEADER)).toBeTruthy();
  });

  test("свой Authorization вызывающего не перезаписывается", async () => {
    window.localStorage.setItem("aevion_auth_token_v1", "tok-abc");
    await window.fetch("https://api.aevion.app/api/devhub/studio/credits", { headers: { Authorization: "Bearer own-token" } });
    expect(последний!.get("authorization")).toBe("Bearer own-token");
  });

  test("другие префиксы обёртки (qcoreai) вход не получают — их квоты не трогаем", async () => {
    window.localStorage.setItem("aevion_auth_token_v1", "tok-abc");
    await window.fetch("https://api.aevion.app/api/qcoreai/chat", { method: "POST" });
    expect(последний!.get("authorization")).toBeNull();
    expect(последний!.get(DEVHUB_GUEST_HEADER)).toBeTruthy();
  });
});
