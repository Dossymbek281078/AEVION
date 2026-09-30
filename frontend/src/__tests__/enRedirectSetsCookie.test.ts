import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

/**
 * Стык с предзагрузкой словаря (окно user-0c): скрипт на /devhub языкового
 * префикса уже не видит и берёт язык из куки. Значит кука обязана доехать до
 * ПЕРВОГО рендера — то есть стоять прямо на ответе 308, а не ставиться позже.
 * Иначе на первом экране мелькнёт русский при английском адресе.
 *
 * Тест проверяет именно это: сам ответ переадресации несёт Set-Cookie.
 */
describe("редирект /en ставит язык прямо на ответе", () => {
  it("/en/pricing → 308 на /pricing и Set-Cookie aevion_lang_v1=en", () => {
    const ответ = middleware(new NextRequest("https://aevion.app/en/pricing"));
    expect(ответ.status).toBe(308);
    expect(ответ.headers.get("location")).toContain("/pricing");
    const кука = ответ.headers.get("set-cookie") ?? "";
    expect(кука).toContain("aevion_lang_v1=en");
  });

  it("сохраняет параметры запроса при переадресации", () => {
    const ответ = middleware(new NextRequest("https://aevion.app/en/pricing?c=ph&utm_source=producthunt"));
    const куда = ответ.headers.get("location") ?? "";
    expect(куда).toContain("c=ph");
    expect(куда).toContain("utm_source=producthunt");
  });

  it("свою английскую страницу не трогает и куку не ставит", () => {
    const ответ = middleware(new NextRequest("https://aevion.app/en/devhub"));
    expect(ответ.status).not.toBe(308);
    expect(ответ.headers.get("set-cookie") ?? "").not.toContain("aevion_lang_v1");
  });
});
