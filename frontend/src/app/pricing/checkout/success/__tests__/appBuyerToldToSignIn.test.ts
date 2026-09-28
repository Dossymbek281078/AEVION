// Купивший отдельное приложение (гость, почта только в кассе) должен узнать, что доступ
// привязан к почте оплаты и открывается после входа с ней. 22.09.2026: CyberChess Lite
// покупался без входа, страница приложения показывала гостю гостевое, а подсказки не было.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const dict = (l: string) => readFileSync(join(__dirname, "..", "..", "..", "..", "..", "lib", "i18n-lang", `${l}.ts`), "utf8");

describe("страница успеха: подсказка про вход с почтой оплаты", () => {
  it("пункт есть только при известном приложении и ведёт на /auth с возвратом в приложение", () => {
    expect(page).toContain('t("pricing.checkoutSuccess.nextLogin", { app: appLink.name }), href: `/auth?next=${encodeURIComponent(appLink.href)}`');
  });

  it("ключ есть во всех трёх словарях и содержит {app}", () => {
    for (const l of ["ru", "en", "kk"]) {
      const m = dict(l).match(/"pricing\.checkoutSuccess\.nextLogin": "([^"]+)"/);
      expect(m, l).toBeTruthy();
      expect(m![1]).toContain("{app}");
    }
  });

  // 28.09.2026: DevHub не было в APP_LINKS вовсе — 29 приложений были, он нет. И вход ему
  // не помог бы: аккаунта у DevHub нет, права находят человека по почте оплаты. Замер:
  // покупатель возвращался с оплаты без ссылки на продукт и без единственного нужного шага.
  it("DevHub ведёт на связывание покупки, а НЕ на вход", () => {
    expect(page).toContain('devhub: { name: "DevHub", href: "/devhub" }');
    expect(page).toContain('appId === "devhub"');
    expect(page).toContain('t("pricing.checkoutSuccess.nextDevhubLink"), href: "/devhub/link"');
    // Порядок важен: ветка devhub обязана стоять ДО общей ветки appLink,
    // иначе DevHub снова уйдёт на /auth — в тупик сразу после списания денег.
    expect(page.indexOf('appId === "devhub"')).toBeLessThan(
      page.indexOf('t("pricing.checkoutSuccess.nextLogin"'),
    );
  });

  it("ключ связывания есть во всех трёх словарях", () => {
    for (const l of ["ru", "en", "kk"]) {
      const m = dict(l).match(/"pricing\.checkoutSuccess\.nextDevhubLink": "([^"]+)"/);
      expect(m, l).toBeTruthy();
      expect(m![1].length, l).toBeGreaterThan(30);
    }
  });
});
