import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware, сПутём } from "@/middleware";
import { языкПоЗапросу } from "@/lib/serverLang";

/**
 * Middleware отдаёт серверному выбору языка путь запроса (30.10.2026).
 *
 * ЗАЧЕМ. Ветка «/en/… → en» в языкПоЗапросу читает заголовок
 * x-aevion-pathname, а middleware его не ставил — ветка была мертва на проде
 * (находка Продукта). Страницы со своим английским адресом (/en/devhub,
 * /en/shop, /en/go) доходят до сервера без редиректа, и русский браузер
 * (Accept-Language ru, кука ru) получал на /en/devhub русский первый кадр;
 * /en/devhub закрыли жёстким lang="en" в макете, остальные /en/… ждали общего
 * решения. Остальные /en/<путь> редиректятся на /<путь> с кукой en — там язык
 * решает кука, и это проверено ниже как контроль.
 */

function запрос(url: string, cookie?: string): NextRequest {
  const headers = new Headers({ "accept-language": "ru-RU,ru;q=0.9" });
  if (cookie) headers.set("cookie", `aevion_lang_v1=${cookie}`);
  return new NextRequest(new URL(url, "https://aevion.app"), { headers });
}

/** Как Next передаёт переопределённые заголовки запроса дальше (x-middleware-request-*). */
function заголовокЗапроса(res: Response, name: string): string | null {
  return res.headers.get(`x-middleware-request-${name}`);
}

describe("middleware → x-aevion-pathname для serverLang", () => {
  it("🔴 /en/devhub (своя английская страница, без редиректа): заголовок с путём есть, и русский браузер с кукой ru получает en", () => {
    const res = middleware(запрос("/en/devhub", "ru"));
    expect(res.status).toBe(200);
    const путь = заголовокЗапроса(res, "x-aevion-pathname");
    expect(путь).toBe("/en/devhub");
    expect(языкПоЗапросу({ pathname: путь, cookie: "ru", acceptLanguage: "ru-RU,ru;q=0.9" })).toBe("en");
  });

  it("/bureau без префикса: путь передан, язык по-прежнему решают кука и Accept-Language", () => {
    const res = middleware(запрос("/bureau"));
    expect(res.status).toBe(200);
    expect(заголовокЗапроса(res, "x-aevion-pathname")).toBe("/bureau");
    expect(языкПоЗапросу({ pathname: "/bureau", cookie: null, acceptLanguage: "ru-RU,ru;q=0.9" })).toBe("ru");
    expect(языкПоЗапросу({ pathname: "/bureau", cookie: null, acceptLanguage: "en-US,en;q=0.9" })).toBe("en");
  });

  it("КОНТРОЛЬ: /en/bureau без куки → 308 на /bureau с кукой en; следующий запрос с этой кукой — en", () => {
    const res = middleware(запрос("/en/bureau"));
    expect(res.status).toBe(308);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/bureau");
    const кука = res.headers.get("set-cookie") ?? "";
    expect(кука).toMatch(/aevion_lang_v1=en/);
    expect(языкПоЗапросу({ pathname: "/bureau", cookie: "en", acceptLanguage: "ru-RU,ru;q=0.9" })).toBe("en");
  });

  it("сПутём не теряет прочие заголовки запроса", () => {
    const h = сПутём({ headers: new Headers({ "accept-language": "kk-KZ", cookie: "a=b" }) }, "/en/go");
    expect(h.get("x-aevion-pathname")).toBe("/en/go");
    expect(h.get("accept-language")).toBe("kk-KZ");
    expect(h.get("cookie")).toBe("a=b");
  });
});
