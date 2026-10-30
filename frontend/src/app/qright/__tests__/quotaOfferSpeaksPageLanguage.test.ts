import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { quotaOfferText } from "../quotaOffer";
import { planetFromPerMonth, planetPricePerMonth } from "@/lib/termPricing";

/**
 * Предложение после 402 free_quota_exceeded на /qright — на языке страницы и без «4 of 3».
 *
 * 🔴 30.10.2026, повод (прод): текст был английским литералом в разметке при любом
 * языке, а «used» бэкенд считает вместе с отказанной попыткой — человек читал
 * «Free registrations this month are used up (4 of 3)».
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = readFileSync(join(HERE, "../page.tsx"), "utf8");
const ЦЕНА = { from: planetFromPerMonth(), month: planetPricePerMonth("lite") };

describe("QRight: текст предела по языку страницы", () => {
  it("en: английский, использовано не больше нормы — «3 of 3», не «4 of 3»", () => {
    const { headline, body } = quotaOfferText("en", { used: 4, freePerMonth: 3 }, ЦЕНА);
    expect(headline).toBe("Free registrations this month are used up (3 of 3) — the subscription has no limit.");
    expect(headline).not.toContain("4 of 3");
    expect(body).toContain(`$${planetFromPerMonth()}/mo`);
    expect(body).toContain(`$${planetPricePerMonth("lite")}/mo`);
    expect(/[Ѐ-ӿ]/.test(headline + body), "кириллица в английском тексте").toBe(false);
  });

  it("ru: «Бесплатные регистрации в этом месяце исчерпаны (3 из 3) — в подписке предела нет.»", () => {
    const { headline, body } = quotaOfferText("ru", { used: 4, freePerMonth: 3 }, ЦЕНА);
    expect(headline).toBe("Бесплатные регистрации в этом месяце исчерпаны (3 из 3) — в подписке предела нет.");
    expect(body).toContain(`$${planetFromPerMonth()}/мес`);
    expect(body).not.toContain("{from}");
  });

  it("kk: своя строка, не en и не ru", () => {
    const kk = quotaOfferText("kk", { used: 4, freePerMonth: 3 }, ЦЕНА).headline;
    expect(kk).not.toBe(quotaOfferText("en", { used: 4, freePerMonth: 3 }, ЦЕНА).headline);
    expect(kk).not.toBe(quotaOfferText("ru", { used: 4, freePerMonth: 3 }, ЦЕНА).headline);
    expect(kk).toContain("3");
    expect(kk).not.toContain("{used}");
  });

  it("норма не пришла (0) — берётся копия числа бэкенда, а не «0 of 0»", () => {
    const { headline } = quotaOfferText("en", { used: 7, freePerMonth: 0 }, ЦЕНА);
    expect(headline).toContain("(3 of 3)");
  });

  it("страница зовёт quotaOfferText с ценами лесенки планеты, английского литерала о пределе в разметке нет", () => {
    expect(PAGE).toContain('quotaOfferText(lang, quotaOffer, { from: planetFromPerMonth(), month: planetPricePerMonth("lite") })');
    expect(PAGE).not.toContain("Free registrations this month are used up (");
  });
});
