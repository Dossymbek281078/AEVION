import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { localizeTier, localizeNotes, localizeQuoteText, sameDigits } from "../pricingLocalize";

/**
 * 🔴 20.10.2026: Продажи замерили /pricing при locale en-US — 731 знак кириллицы.
 * Тексты карточек приходят с бэка по-русски (data/pricing.ts, planTier) и
 * переводятся на фронте; позиционная карта TIER_EN отстала от плана «Планета»
 * 19.10, и по фикстуре свежего ответа /api/pricing при en оставалось 11 русских
 * строк (401 знак): строка цены «… списание ежемесячно — N платежей …» у
 * пяти сроков, «Экономия N% против месяца без срока» у четырёх, два пункта
 * Enterprise.
 *
 * Порог — 0 знаков кириллицы в текстах карточек и примечаниях при en. Фикстура —
 * ответ ручки /api/pricing этой ветки (supertest), см. fixtureIsNotStale.
 */
type Fixture = {
  tiers: Array<{ id: string; tagline: string; features: string[]; ctaLabel: string }>;
  notes: string[];
  plan?: { terms: Array<{ tierId: string; paymentsCount: number; prepayUsd: number }> };
};
const pricing = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "app", "pricing", "__tests__", "__fixtures__", "pricing.json"), "utf8"),
) as Fixture;
const CYR = /[а-яё]/gi;

function русскиеСтроки(lang: string): string[] {
  const out: string[] = [];
  for (const t of pricing.tiers) {
    const e = localizeTier(t, lang);
    for (const s of [e.tagline, e.ctaLabel, ...e.features]) if (s.match(CYR)) out.push(`${t.id}: ${s}`);
  }
  for (const n of localizeNotes(pricing.notes, lang)) if (n.match(CYR)) out.push(`note: ${n}`);
  return out;
}

describe("карточки плана при en — без кириллицы", () => {
  it("КОНТРОЛЬ: фикстура — ответ плана «Планета» (plan.terms, строка «списание ежемесячно»), при ru русских строк много", () => {
    expect(pricing.plan?.terms.map((t) => t.paymentsCount)).toEqual([1, 3, 6, 9, 12]);
    expect(pricing.tiers.flatMap((t) => t.features).some((f) => f.includes("списание ежемесячно"))).toBe(true);
    expect(русскиеСтроки("ru").length).toBeGreaterThan(30);
  });

  it("en: 0 знаков кириллицы в tagline, ctaLabel, пунктах и примечаниях", () => {
    const строки = русскиеСтроки("en");
    const знаков = строки.join("").match(CYR)?.length ?? 0;
    expect(строки, `русских строк ${строки.length}, знаков ${знаков}`).toEqual([]);
  });

  it("en: числа в переводе те же, что в оригинале (цена, платежи, предоплата)", () => {
    for (const t of pricing.tiers) {
      const e = localizeTier(t, "en");
      e.features.forEach((f, i) => expect(sameDigits(t.features[i], f), `${t.id}[${i}] ${f}`).toBe(true));
    }
    const medium = localizeTier(pricing.tiers.find((t) => t.id === "medium")!, "en");
    expect(medium.features).toContain("$225 a month, billed monthly — 3 payments, $675 for 3 months; up front — $641.25 every 3 months until you cancel");
    expect(medium.features).toContain("Save 10% vs. one month without a term");
  });

  it("пункт без перевода остаётся русским, а не получает чужой английский (позиции больше нет)", () => {
    const ent = pricing.tiers.find((t) => t.id === "enterprise")!;
    const e = localizeTier({ ...ent, features: ["Новый пункт без перевода", ...ent.features] }, "en");
    expect(e.features[0]).toBe("Новый пункт без перевода");
    expect(e.features.slice(1).join(" ")).not.toMatch(CYR);
  });

  it("расчёт /quote: строки и примечания плана переводятся, числа сохраняются", () => {
    expect(localizeQuoteText("План «AEVION Планета» — 3 месяца, списание ежемесячно по $225", "en")).toBe("AEVION Planet plan — 3 months, billed monthly at $225");
    expect(localizeQuoteText("План «AEVION Планета» — 1 месяц, без обязательств", "en")).toBe("AEVION Planet plan — 1 month, no commitment");
    expect(localizeQuoteText("Дополнительные пользователи (2 × $5/мес)", "en")).toBe("Extra users (2 × $5/mo)");
    expect(localizeQuoteText("Enterprise — итоговая цена согласовывается отдельно", "en")).not.toMatch(CYR);
    expect(localizeQuoteText("План «AEVION Планета» — 3 месяца, списание ежемесячно по $225", "ru")).toContain("Планета");
  });
});
