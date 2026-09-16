import { describe, test, expect } from "vitest";
import { SUBSCRIPTIONS, GUIDES, MODULES, type Product } from "../products";
import { PLANET_BASE_MONTHLY, fromPricePerMonth, termTotal } from "../termPricing";

// Guard: one product card, one story about how much you get — 2026-08-11.
//
// The All-Access card told the buyer two different things at once: `desc`
// said "15+ модулей", the `includes` list right below said "30+ модулей",
// while the registry reported 36 live. Nothing broke — the card rendered
// fine, it just contradicted itself in front of someone about to pay.
//
// 15.09.2026: All-Access is no longer sold; the one subscription card is the
// AEVION term subscription. The rule stays: a card must not state two
// different counts of the same thing — and now also: the prices a card names
// in words must be the ones the term ladder charges.

const ALL: Product[] = [...SUBSCRIPTIONS, ...GUIDES, ...MODULES];

/** Counts of modules, in any of the shapes the catalogue has used. */
function moduleCounts(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\b(\d[\d\s]{0,6})\+?\s*(?:модул|module)/gi)) {
    const n = Number(m[1].replace(/\s/g, ""));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

describe("a product card never states two different module counts", () => {
  test.each(ALL.map((p) => [p.title, p] as const))("%s", (_title, p) => {
    const counts = [
      ...moduleCounts(p.desc),
      ...moduleCounts((p.includes || []).join(" ")),
      ...moduleCounts(p.format),
    ];
    const distinct = [...new Set(counts)];
    // One number is fine. Two different ones on the same card is the defect.
    expect(distinct.length).toBeLessThanOrEqual(1);
  });

  test("the subscription card names no module count at all and says what you get", () => {
    const card = SUBSCRIPTIONS.find((p) => p.id === "aevion-planet");
    expect(card, "the AEVION subscription card is missing").toBeTruthy();
    // A count would go stale with the next release; «все модули» does not.
    expect(moduleCounts([card!.desc, card!.format, ...(card!.includes || [])].join(" "))).toEqual([]);
    expect((card!.includes || []).join(" ")).toMatch(/Все модули/i);
  });

  test("the subscription card quotes exactly the ladder's figures", () => {
    const card = SUBSCRIPTIONS.find((p) => p.id === "aevion-planet")!;
    const dollars = [...card.format.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    expect(dollars).toEqual(
      [fromPricePerMonth(PLANET_BASE_MONTHLY), termTotal(PLANET_BASE_MONTHLY, "lite")].sort((a, b) => a - b),
    );
    expect(card.priceUsd).toBe(termTotal(PLANET_BASE_MONTHLY, "lite"));
  });

  test("the guard catches the shape that shipped", () => {
    // Proof the matcher is not vacuous.
    expect(moduleCounts("Полный доступ — 15+ модулей: QRight, QSign")).toEqual([15]);
    expect(moduleCounts("Все живые продукты AEVION (30+ модулей)")).toEqual([30]);
    expect(moduleCounts("Одна подписка, без лимитов")).toEqual([]);
  });
});
