import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Язык первого кадра на сервере (lib/serverLang.ts) — приёмка Оркестратора 30.10.2026:
 * без заголовков → ru; Accept-Language en → en; кука kk → kk; кука важнее
 * заголовка; путь /en/… → en (когда путь известен).
 */

const фальшивые = { cookie: null as string | null, acceptLanguage: null as string | null, pathname: null as string | null, бросать: false };

vi.mock("next/headers", () => ({
  cookies: async () => {
    if (фальшивые.бросать) throw new Error("вне запроса");
    return { get: (name: string) => (name === "aevion_lang_v1" && фальшивые.cookie !== null ? { value: фальшивые.cookie } : undefined) };
  },
  headers: async () => {
    if (фальшивые.бросать) throw new Error("вне запроса");
    return {
      get: (name: string) =>
        name === "accept-language" ? фальшивые.acceptLanguage : name === "x-aevion-pathname" ? фальшивые.pathname : null,
    };
  },
}));

// eslint-disable-next-line import/first
import { serverLang, языкПоЗапросу } from "../serverLang";

beforeEach(() => {
  фальшивые.cookie = null;
  фальшивые.acceptLanguage = null;
  фальшивые.pathname = null;
  фальшивые.бросать = false;
});

describe("языкПоЗапросу — чистый выбор", () => {
  it("🔴 без куки, заголовка и пути — ru", () => {
    expect(языкПоЗапросу({})).toBe("ru");
    expect(языкПоЗапросу({ cookie: "", acceptLanguage: "", pathname: "" })).toBe("ru");
  });

  it("Accept-Language en → en; ru → ru; kk/kz → kk; первый тег решает", () => {
    expect(языкПоЗапросу({ acceptLanguage: "en-US,en;q=0.9,ru;q=0.8" })).toBe("en");
    expect(языкПоЗапросу({ acceptLanguage: "ru-RU,ru;q=0.9,en;q=0.8" })).toBe("ru");
    expect(языкПоЗапросу({ acceptLanguage: "kk-KZ,ru;q=0.9" })).toBe("kk");
    expect(языкПоЗапросу({ acceptLanguage: "kz" })).toBe("kk");
    expect(языкПоЗапросу({ acceptLanguage: "de-DE,de;q=0.9" })).toBe("de");
  });

  it("кука kk → kk; кука важнее заголовка", () => {
    expect(языкПоЗапросу({ cookie: "kk" })).toBe("kk");
    expect(языкПоЗапросу({ cookie: "en", acceptLanguage: "ru-RU,ru;q=0.9" })).toBe("en");
    expect(языкПоЗапросу({ cookie: "ru", acceptLanguage: "en-US" })).toBe("ru");
  });

  it("путь /en/… → en, и он важнее куки (как у клиентского провайдера)", () => {
    expect(языкПоЗапросу({ pathname: "/en/auth" })).toBe("en");
    expect(языкПоЗапросу({ pathname: "/en" })).toBe("en");
    expect(языкПоЗапросу({ pathname: "/en/auth", cookie: "ru" })).toBe("en");
    expect(языкПоЗапросу({ pathname: "/kk/cyberchess", cookie: "ru" })).toBe("kk");
    // Не языковой префикс — не язык.
    expect(языкПоЗапросу({ pathname: "/auth", cookie: "en" })).toBe("en");
    expect(языкПоЗапросу({ pathname: "/english/auth" })).toBe("ru");
  });

  it("мусор в куке не становится языком и не ломает выбор", () => {
    expect(языкПоЗапросу({ cookie: "<script>", acceptLanguage: "en" })).toBe("en");
    expect(языкПоЗапросу({ cookie: "xx" })).toBe("ru");
  });

  it("умолчание задаёт вызывающий", () => {
    expect(языкПоЗапросу({}, "en")).toBe("en");
  });
});

describe("serverLang — чтение cookies()/headers() Next", () => {
  it("🔴 без заголовков и куки — ru", async () => {
    expect(await serverLang()).toBe("ru");
  });

  it("Accept-Language en → en", async () => {
    фальшивые.acceptLanguage = "en-US,en;q=0.9";
    expect(await serverLang()).toBe("en");
  });

  it("кука kk → kk и важнее заголовка", async () => {
    фальшивые.cookie = "kk";
    фальшивые.acceptLanguage = "en-US";
    expect(await serverLang()).toBe("kk");
  });

  it("путь из заголовка x-aevion-pathname → en", async () => {
    фальшивые.pathname = "/en/auth";
    фальшивые.cookie = "ru";
    expect(await serverLang()).toBe("en");
  });

  it("вне запроса (cookies()/headers() бросают) — умолчание, а не ошибка", async () => {
    фальшивые.бросать = true;
    expect(await serverLang()).toBe("ru");
    expect(await serverLang("en")).toBe("en");
  });
});
