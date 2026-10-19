/**
 * 🔴 19.10.2026, слово основателя: ОДИН план «AEVION Планета» ($250/225/200/175/150
 * в месяц за 1/3/6/9/12 месяцев), отдельно продаются только шахматы — $50/год.
 *
 * Сторож держит три поверхности на одних данных: прайс (termPricing), витрину
 * магазина (products/MODULES) и страницу цен (page.tsx), плюс словари ru/en/kk.
 * Мутация «вернуть лестницу шахматам» или «вернуть DevHub на витрину» краснеет здесь.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  STANDALONE_APPS, TERM_TIERS, appSellableTerms, appTermTotal, appTermFor, planetTotal, planetPricePerMonth,
} from "@/lib/termPricing";
import { predlagaemOtdelno } from "@/lib/neProdayotsyaOtdelno";
import { MODULES, MODULES_NOT_OFFERED, SUBSCRIPTIONS } from "@/lib/products";

const PAGE = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const dict = (lang: string) => readFileSync(join(__dirname, "..", "..", "..", "lib", "i18n-lang", `${lang}.ts`), "utf8");

describe("один план и шахматы $50/год (19.10.2026)", () => {
  it("лесенка плана — литералы слова основателя", () => {
    expect(TERM_TIERS.map((t) => planetPricePerMonth(t))).toEqual([250, 225, 200, 175, 150]);
    expect(TERM_TIERS.map((t) => planetTotal(t))).toEqual([250, 675, 1200, 1575, 1800]);
  });

  it("отдельно предлагаются только шахматы, и только на 12 месяцев за $50", () => {
    const предлагаемые = STANDALONE_APPS.filter((a) => predlagaemOtdelno(a.slug));
    expect(предлагаемые.map((a) => a.slug)).toEqual(["cyberchess"]);
    const chess = предлагаемые[0];
    expect(appSellableTerms(chess)).toEqual(["max"]);
    expect(appTermTotal(chess, "max")).toBe(50);
    for (const t of ["lite", "medium", "pro", "full"] as const) {
      expect(appTermTotal(chess, t), `${t}: у годового приложения нет цены на этом сроке`).toBeNull();
      expect(appTermFor(chess, t), `${t}: витрина обязана покупать год`).toBe("max");
    }
    // Контроль прибора: у приложения без yearOnlyUsd лестница цела.
    const devhub = STANDALONE_APPS.find((a) => a.slug === "devhub")!;
    expect(appSellableTerms(devhub)).toEqual([...TERM_TIERS]);
    expect(appTermTotal(devhub, "lite")).toBe(200);
  });

  it("магазин: один план и одна карточка шахмат $50 в год; снятые не потеряны", () => {
    expect(SUBSCRIPTIONS.map((p) => p.id)).toEqual(["aevion-planet"]);
    expect(MODULES.map((p) => [p.id, p.priceUsd, p.billing])).toEqual([["cyberchess", 50, "year"]]);
    expect(MODULES[0].format).toContain("$50/год");
    expect(MODULES_NOT_OFFERED.map((p) => p.id).sort()).toEqual(
      ["devhub", "multichat", "qventure", "bureau", "qright", "qsign", "startup-exchange", "qskyway"].sort(),
    );
  });

  it("страница цен покупает срок приложения через appTermFor и подписывает «/год»", () => {
    expect(PAGE).toContain("const срок = appTermFor(a, appTerm);");
    expect(PAGE).toContain("startCheckout({ tierId: срок, app: a.slug, seats: 1 })");
    expect(PAGE).toContain("const срокГероя = appTermFor(app, appTerm);");
    expect(PAGE).toContain("startCheckout({ tierId: срокГероя, app: app.slug, seats: 1 })");
    expect(PAGE).toContain('t("pricing.home.apps.perYear")');
    expect(PAGE).toContain('t("pricing.home.apps.priceMayRise")');
    expect(PAGE, "переключатель сроков показывается только при лестнице").toContain("{естьЛестница && (<div");
    expect(PAGE, "старая кнопка покупки по сроку переключателя осталась").not.toContain("startCheckout({ tierId: appTerm, app: a.slug");
  });

  it("словари ru/en/kk знают новые подписи", () => {
    for (const lang of ["ru", "en", "kk"]) {
      const d = dict(lang);
      for (const k of ["pricing.home.apps.perYear", "pricing.home.apps.subtitleYearOnly", "pricing.home.apps.priceMayRise", "pricing.home.faq.singleModule.aOnePlan", "pricing.home.faq.bothSuites.aOnePlan"]) {
        expect(d, `${lang}: нет ключа ${k}`).toContain(`"${k}":`);
      }
    }
    expect(dict("ru")).toContain('"pricing.home.apps.perYear": "год"');
    expect(dict("en")).toContain('"pricing.home.apps.perYear": "year"');
  });

  it("магазин ru/en не называет «9 приложений» и цену за месяц у шахмат", () => {
    for (const f of ["shop/page.tsx", "en/shop/page.tsx"]) {
      const src = readFileSync(join(__dirname, "..", "..", f), "utf8").split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n"); // без комментариев
      expect(src, `${f}: осталось «9 приложений»`).not.toMatch(/9 приложений|9 apps/);
      expect(src, `${f}: карточка года подписана как месяц`).toMatch(/isYear \? <span style=\{styles\.per\}> (в год|a year)<\/span>/);
    }
  });
});
