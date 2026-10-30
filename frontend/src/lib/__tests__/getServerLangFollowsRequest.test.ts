import { describe, it, expect, vi, beforeEach } from "vitest";

// getServerLang (i18n-server) = serverLang("en"): те же правила, что у клиента,
// ?lang= и путь видны (заголовки x-aevion-*), умолчание прежнее — "en".
const req = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  h: {} as Record<string, string>,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "aevion_lang_v1" && req.cookie ? { value: req.cookie } : undefined) }),
  headers: async () => ({ get: (n: string) => req.h[n.toLowerCase()] ?? null }),
}));

import { getServerLang } from "../i18n-server";

beforeEach(() => {
  req.cookie = undefined;
  req.h = {};
});

describe("getServerLang следует запросу как клиент", () => {
  it("?lang=en побеждает куку ru", async () => {
    req.cookie = "ru";
    req.h = { "x-aevion-search": "?lang=en", "accept-language": "ru-RU,ru" };
    expect(await getServerLang()).toBe("en");
  });
  it("путь /en/… даёт en при куке ru", async () => {
    req.cookie = "ru";
    req.h = { "x-aevion-pathname": "/en/pricing" };
    expect(await getServerLang()).toBe("en");
  });
  it("без всего — прежнее умолчание en", async () => {
    expect(await getServerLang()).toBe("en");
  });
  it("кука без ?lang= работает как раньше", async () => {
    req.cookie = "kk";
    expect(await getServerLang()).toBe("kk");
  });
  it("Accept-Language: первый тег (uk-UA,ru — чужой язык, как у клиента, en)", async () => {
    req.h = { "accept-language": "uk-UA,ru;q=0.8" };
    expect(await getServerLang()).toBe("en");
  });
  it("Accept-Language ru-RU → ru", async () => {
    req.h = { "accept-language": "ru-RU,en;q=0.5" };
    expect(await getServerLang()).toBe("ru");
  });
});
