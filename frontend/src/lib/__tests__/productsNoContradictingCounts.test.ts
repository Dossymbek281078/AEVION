import { describe, test, expect } from "vitest";
import { SUBSCRIPTIONS, GUIDES, type Product } from "../products";

// Guard: one product card, one story about how much you get — 2026-08-11.
//
// The All-Access card told the buyer two different things at once: `desc`
// said "15+ модулей", the `includes` list right below said "30+ модулей",
// while the registry reported 36 live. Nothing broke — the card rendered
// fine, it just contradicted itself in front of someone about to pay.
//
// `desc` is the seller's own wording, mirrored from Gumroad on purpose
// (see the comment in products.ts): drifting from what the checkout page
// shows would be worse than being imprecise. So the rule is not "no numbers
// anywhere" — it is "the card must not state two different counts of the
// same thing".

const ALL: Product[] = [...SUBSCRIPTIONS, ...GUIDES];

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
    // One number is fine (it may be the seller's own wording). Two different
    // ones on the same card is the defect this pins.
    expect(distinct.length).toBeLessThanOrEqual(1);
  });

  test("All-Access specifically — the card that had both 15+ and 30+", () => {
    const card = SUBSCRIPTIONS.find((p) => p.id === "xpxzam");
    expect(card).toBeTruthy();
    const inIncludes = moduleCounts((card!.includes || []).join(" "));
    // The includes list no longer carries a count of its own; whatever the
    // seller's desc says stands alone.
    expect(inIncludes).toEqual([]);
    // And it still tells the buyer what they get.
    expect((card!.includes || []).join(" ")).toMatch(/Все живые продукты/i);
  });

  test("the guard catches the shape that shipped", () => {
    // Proof the matcher is not vacuous.
    expect(moduleCounts("Полный доступ — 15+ модулей: QRight, QSign")).toEqual([15]);
    expect(moduleCounts("Все живые продукты AEVION (30+ модулей)")).toEqual([30]);
    expect(moduleCounts("Одна подписка, без лимитов")).toEqual([]);
  });
});
