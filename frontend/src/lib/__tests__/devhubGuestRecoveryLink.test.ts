import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { adoptDevhubGuestKeyFromUrl, getDevhubGuestId } from "../devhubGuest";

const ЧУЖОЙ = "oldbrowser-key-1111";
const КЛЮЧ = "abc12345-recovered-key";

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});
afterEach(() => { vi.restoreAllMocks(); vi.resetModules(); });

describe("ссылка восстановления /devhub/<id>?k=<ключ> из письма «сохранить»", () => {
  test("чистый браузер: ключ записан как devhub_guest_id, ?k= убран из адреса", () => {
    window.history.replaceState(null, "", "/devhub/p-1?k=" + КЛЮЧ + "&x=1");
    expect(adoptDevhubGuestKeyFromUrl()).toBe(true);
    expect(window.localStorage.getItem("devhub_guest_id")).toBe(КЛЮЧ);
    expect(getDevhubGuestId()).toBe(КЛЮЧ);
    expect(window.location.search).toBe("?x=1");
    expect(window.location.href).not.toContain(КЛЮЧ);
  });

  test("другой ключ в хранилище заменяется ключом из ссылки", () => {
    window.localStorage.setItem("devhub_guest_id", ЧУЖОЙ);
    window.history.replaceState(null, "", "/devhub/p-1?k=" + КЛЮЧ);
    adoptDevhubGuestKeyFromUrl();
    expect(window.localStorage.getItem("devhub_guest_id")).toBe(КЛЮЧ);
  });

  test("без ?k= поведение прежнее: хранилище не тронуто, адрес не меняется", () => {
    window.localStorage.setItem("devhub_guest_id", ЧУЖОЙ);
    window.history.replaceState(null, "", "/devhub/p-1?x=1");
    expect(adoptDevhubGuestKeyFromUrl()).toBe(false);
    expect(window.localStorage.getItem("devhub_guest_id")).toBe(ЧУЖОЙ);
    expect(window.location.search).toBe("?x=1");
  });

  test("мусорный ?k= не пишется, но из адреса убирается", () => {
    window.localStorage.setItem("devhub_guest_id", ЧУЖОЙ);
    window.history.replaceState(null, "", "/devhub/p-1?k=a%20b");
    expect(adoptDevhubGuestKeyFromUrl()).toBe(false);
    expect(window.localStorage.getItem("devhub_guest_id")).toBe(ЧУЖОЙ);
    expect(window.location.search).toBe("");
  });

  test("вне /devhub/<id> ?k= не трогается", () => {
    window.history.replaceState(null, "", "/pricing?k=" + КЛЮЧ);
    expect(adoptDevhubGuestKeyFromUrl()).toBe(false);
    expect(window.localStorage.getItem("devhub_guest_id")).toBeNull();
  });

  test("ключ записан РАНЬШЕ первого fetch: запрос к /projects/<id> уходит с x-devhub-guest = ключ из ссылки", async () => {
    window.localStorage.setItem("devhub_guest_id", ЧУЖОЙ);
    window.history.replaceState(null, "", "/devhub/p-1?k=" + КЛЮЧ);
    const seen: Array<string | null> = [];
    window.fetch = vi.fn(async (_i: RequestInfo | URL, init?: RequestInit) => {
      seen.push(new Headers(init?.headers).get("x-devhub-guest"));
      return new Response("{}");
    }) as typeof window.fetch;
    // Модуль-обёртка в layout: ключ из ссылки берётся при вычислении модуля, затем ставится заголовок.
    await import("@/components/DevHubGuestIdentity");
    await window.fetch("/api/devhub/projects/p-1");
    expect(seen).toEqual([КЛЮЧ]);
  });
});
