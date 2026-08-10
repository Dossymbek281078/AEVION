import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Regression guard for retired pitch numbers.
 *
 * Why this exists: the same headline figure ($2B+ ARR, the "Seed $5M" ask, …)
 * used to live as a hardcoded string in ~10 different files with slightly
 * different wording. A cleanup in one window only ever caught the variants
 * someone grepped for, so a stale copy always resurfaced in another surface
 * (SEO meta, OG images, print pages). This test fails the build the moment a
 * retired figure reappears on any pitch surface — so drift is caught in CI,
 * not by a human reading the page months later.
 *
 * Scope is deliberately narrow: only investor-facing pitch surfaces, and only
 * figures that were explicitly retired. Legitimate numbers the founder keeps
 * (valuation ranges like "$1.0-1.6B", the "$10M returnable advance", real
 * plant-cost answers in the smeta trainer) are intentionally NOT matched.
 */

const FRONTEND_ROOT = path.resolve(__dirname, "../../..");

// Pitch surfaces that must stay consistent with the single revenue model.
const SURFACES = [
  "src/app/page.tsx",
  "src/app/pitch/page.tsx",
  "src/app/pitch/print/page.tsx",
  "src/app/pitch/opengraph-image.tsx",
  "src/app/partner/page.tsx",
  "src/app/partner/print/page.tsx",
  "src/app/investor/layout.tsx",
  "src/app/investor/page.tsx",
  "src/components/AutoTranslate.tsx",
  "src/data/pitchModel.ts",
];

// Retired figures. Each must not appear on any surface above.
const RETIRED: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\$2\.?0?\s*B\+/i,
    reason: '"$2B+" / "$2.0B+" — retired top-down ARR headline (replaced by the bottom-up model)',
  },
  {
    pattern: /modelled at \$2/i,
    reason: '"modelled at $2B" — retired top-down trajectory headline',
  },
  {
    pattern: /Seed \$5M/i,
    reason: '"Seed $5M" — retired ask (canonical offer is a $10M returnable advance, not an equity seed)',
  },
  {
    pattern: /\b29\b[^\n]{0,20}(product nodes|modules? live|nodes)/i,
    reason: '"29 … nodes" — stale module count (canonical public count is 37 nodes; import MODULE_NODES from pitchFacts)',
  },
];

describe("pitch numbers — retired figures must not resurface", () => {
  for (const rel of SURFACES) {
    it(`${rel} carries no retired figures`, () => {
      const src = readFileSync(path.join(FRONTEND_ROOT, rel), "utf8");
      for (const { pattern, reason } of RETIRED) {
        const hit = src.match(pattern);
        expect(
          hit,
          `${rel} still contains ${reason}. Found: ${hit ? hit[0] : ""}. ` +
            `Align it with the single bottom-up revenue model (see unitEconomics in src/data/pitchModel.ts).`,
        ).toBeNull();
      }
    });
  }
});

/**
 * Lock the canonical counts to the registry. If someone adds/removes a module
 * in aevion-globus-backend/src/data/projects.ts, this fails until pitchFacts is
 * updated to match — so the single source of truth can't silently drift.
 */
describe("pitchFacts — canonical counts stay in sync with the registry", () => {
  it("MODULE_NODES = 37 (38 registry entries − the globus map shell)", async () => {
    const { MODULE_NODES } = await import("@/data/pitchFacts");
    expect(MODULE_NODES).toBe(37);
  });

  it("LIVE_MODULES = 35 (status:\"live\" in projects.ts)", async () => {
    const { LIVE_MODULES } = await import("@/data/pitchFacts");
    expect(LIVE_MODULES).toBe(35);
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/* Price drift — the expensive half of the same problem                        */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * The 2026-07-22 repricing (lite 19→24, medium 29→39, full 49→89, Universe
 * 149.99→249.99) landed in the backend tier registry and nowhere else. For
 * three weeks the marketing copy, the tier OG cards and the whole investor
 * model still quoted the old ladder — a visitor read "$19/mo" and the checkout
 * charged $24. Nothing crashed, no test went red: exactly the silent kind of
 * wrong that only a human re-reading the page ever catches.
 *
 * So: parse the prices straight out of the backend registry and assert the
 * derived surfaces match. Any future price change fails here until every
 * surface is updated — the drift becomes a red build, not a support ticket.
 */

const BACKEND_PRICING = path.resolve(
  FRONTEND_ROOT,
  "../aevion-globus-backend/src/data/pricing.ts",
);

/** tierId → priceMonthly as written in TIERS (null for enterprise). */
function registryTierPrices(): Record<string, number | null> {
  const src = readFileSync(BACKEND_PRICING, "utf8");
  // Slice to the TIERS array — MODULES_PRICING below it also has `id:` keys.
  const start = src.indexOf("export const TIERS");
  const end = src.indexOf("export const MODULES_PRICING");
  expect(
    start >= 0 && end > start,
    `Could not locate the TIERS array in ${BACKEND_PRICING}. If the registry was ` +
      "restructured, update this guard — do not delete it.",
  ).toBe(true);

  const tiers: Record<string, number | null> = {};
  const re = /id:\s*"([a-z]+)",[\s\S]*?priceMonthly:\s*([\d.]+|null)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src.slice(start, end))) !== null) {
    tiers[m[1]] = m[2] === "null" ? null : Number(m[2]);
  }
  return tiers;
}

/** Prices a public price card is allowed to show, ascending. */
function registryCardPrices(): number[] {
  const tiers = registryTierPrices();
  return Object.values(tiers)
    .filter((p): p is number => p !== null)
    .sort((a, b) => a - b);
}

describe("prices — derived surfaces stay in sync with the backend tier registry", () => {
  it("the registry parses and still holds the six known tiers", () => {
    const tiers = registryTierPrices();
    expect(Object.keys(tiers).sort()).toEqual(
      ["enterprise", "free", "full", "lite", "medium", "pro"],
    );
    expect(tiers.enterprise).toBeNull();
  });

  it("pitchFacts quotes the live ladder (entry / top-live-checkout / Universe)", async () => {
    const tiers = registryTierPrices();
    const facts = await import("@/data/pitchFacts");

    expect(
      facts.ENTRY_PAID_TIER_MONTHLY,
      "ENTRY_PAID_TIER_MONTHLY must equal the Lite price in data/pricing.ts",
    ).toBe(`$${tiers.lite}`);

    // Universe (`pro`) has no Lemon Squeezy variant, so Full is the highest
    // tier a visitor can actually subscribe to — see data/lemonSqueezyVariants.ts.
    expect(
      facts.LIVE_TOP_TIER_MONTHLY,
      "LIVE_TOP_TIER_MONTHLY must equal the Full price in data/pricing.ts",
    ).toBe(`$${tiers.full}`);

    expect(
      facts.UNIVERSE_SEAT_MONTHLY,
      "UNIVERSE_SEAT_MONTHLY must equal the `pro` (Universe) price in data/pricing.ts",
    ).toBe(`$${tiers.pro}`);
  });

  it("the Universe annual figure follows the registry's ×10 annual formula", async () => {
    const tiers = registryTierPrices();
    const { UNIVERSE_SEAT_ANNUAL_TOTAL } = await import("@/data/pitchFacts");
    const expected = `~$${Math.round((tiers.pro as number) * 10).toLocaleString("en-US")}/yr`;
    expect(
      UNIVERSE_SEAT_ANNUAL_TOTAL,
      "Annual = pay for 10 months, get 12 (annualTotal() in data/pricing.ts). " +
        "This figure is the seat ARPU the growth model runs on — if it drifts, every " +
        "ARR row in pitchModel.ts is wrong.",
    ).toBe(expected);
  });

  it("the growth model prices the Universe seat at the registry price", async () => {
    const tiers = registryTierPrices();
    const { launchGrowth } = await import("@/data/pitchModel");

    expect(launchGrowth.seat.headline).toBe(`$${tiers.pro} / mo`);
    expect(
      launchGrowth.seat.honesty,
      "The on-ramp ladder quoted next to the seat price must be the live one.",
    ).toContain(`($0/$${tiers.lite}/$${tiers.medium}/$${tiers.full})`);
  });

  it("the bottom-up model prices All-Access at the live Full tier", async () => {
    const tiers = registryTierPrices();
    const { unitEconomics } = await import("@/data/pitchModel");
    const allAccess = unitEconomics.flagships.find((f) => f.module === "Ecosystem All-Access");
    expect(allAccess, "The 'Ecosystem All-Access' flagship disappeared from unitEconomics").toBeTruthy();
    expect(
      allAccess!.price.startsWith(`$${tiers.full}/mo`),
      `All-Access is the Full tier — its modelled price must open with $${tiers.full}/mo, got: ${allAccess!.price}`,
    ).toBe(true);
  });

  // OG cards are the classic laggard: nobody re-opens an image when a price
  // changes. Compare the full set of prices on the card to the registry rather
  // than banning old literals — that way an added tier fails too, and prose in
  // comments can still mention a retired price.
  const PRICE_CARDS: Array<{ rel: string; re: RegExp }> = [
    { rel: "src/app/pricing/[tierId]/opengraph-image.tsx", re: /price:\s*"\$([\d.]+)"/g },
    { rel: "src/app/pricing/compare/opengraph-image.tsx", re: /price="\$([\d.]+)"/g },
  ];

  for (const { rel, re } of PRICE_CARDS) {
    it(`${rel} shows exactly the registry ladder`, () => {
      const src = readFileSync(path.join(FRONTEND_ROOT, rel), "utf8");
      const shown = [...src.matchAll(re)].map((m) => Number(m[1])).sort((a, b) => a - b);
      expect(
        shown,
        `${rel} is a share card — its prices must be the live ladder from ` +
          "aevion-globus-backend/src/data/pricing.ts (Enterprise shows a word, not a number).",
      ).toEqual(registryCardPrices());
    });
  }
});
