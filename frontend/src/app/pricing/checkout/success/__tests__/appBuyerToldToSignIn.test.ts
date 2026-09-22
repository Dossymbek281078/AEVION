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
    expect(page).toContain("...(appLink\n                ? [{ icon: \"🔑\"");
  });
  it("ключ есть во всех трёх словарях и содержит {app}", () => {
    for (const l of ["ru", "en", "kk"]) {
      const m = dict(l).match(/"pricing\.checkoutSuccess\.nextLogin": "([^"]+)"/);
      expect(m, l).toBeTruthy();
      expect(m![1]).toContain("{app}");
    }
  });
});
