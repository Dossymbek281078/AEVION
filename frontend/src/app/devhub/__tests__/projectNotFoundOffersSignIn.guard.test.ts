// Экран «Проект не найден» DevHub: на языке интерфейса и с дорогой ко входу.
// 30.10.2026: был только русский текст и тупик. Частый случай — ссылка из письма
// «сохранить» (?k=гостевой ключ), а проект после входа ушёл в аккаунт: без
// входа его не видно. Сторож ИСХОДНИКА: страница — монолит с десятками
// запросов, рендерить её ради одного экрана дороже пользы.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEVHUB_DICT } from "../i18n";

const src = readFileSync(join(__dirname, "..", "[id]", "page.tsx"), "utf8");
const i = src.indexOf("if (!project) {");
const экран = src.slice(i, src.indexOf("const stackColor", i));

describe("DevHub: «Проект не найден» говорит, что делать", () => {
  it("тексты экрана — из словаря, литерала на русском нет", () => {
    expect(экран).toContain('tPro("proj.notFound")');
    expect(экран).toContain('tPro("proj.backToDevhub")');
    expect(экран).not.toContain("Проект не найден.");
  });
  it("невошедшему — ссылка на вход с возвратом на этот проект", () => {
    expect(экран).toContain("!getAuthToken() &&");
    expect(экран).toContain("/auth?next=${encodeURIComponent(`/devhub/${id}`)}");
    expect(экран).toContain('tPro("proj.notFoundSignIn")');
  });
  it("ключи есть на ru/en/kk", () => {
    for (const lang of ["ru", "en", "kk"]) for (const k of ["proj.notFound", "proj.notFoundSignIn", "proj.signIn", "proj.backToDevhub"]) {
      expect(DEVHUB_DICT[lang]?.[k as never], `${lang}:${k}`).toBeTruthy();
    }
  });
});
