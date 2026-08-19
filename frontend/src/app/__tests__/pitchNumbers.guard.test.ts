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
  // /press is where journalists copy figures verbatim, so it belongs on the
  // same guard as the investor surfaces. It was missing here, and carried an
  // invented "$340B addressable market" plus an inverted live/MVP split.
  // SEO-метаданные и OG-описания — «классические отстающие», как и написано
  // в шапке pitchFacts. Их тут не было, и «37 modules deployed» пережило рост
  // реестра до 41: страницы поправили, а описание в <head> и превью в соцсетях
  // остались со старым числом.
  "src/app/pitch/layout.tsx",
  "src/app/demo/layout.tsx",
  "src/lib/i18n-data.ts",
];

/**
 * Записи чейнджлога описывают, что было сделано НА ТОТ МОМЕНТ. «Сравнение всех
 * 37 модулей» — это правда о фиче, выпущенной тогда, когда модулей было 37.
 * Переписать её значит подделать историю, поэтому строки чейнджлога из проверки
 * на отставшие числа исключены. Всё остальное в i18n-data — живой текст,
 * который пользователь видит сейчас, и он обязан быть актуальным.
 */
const CHANGELOG_KEY = /"[a-zA-Z0-9_.]*changelog[a-zA-Z0-9_.]*":/i;

/** Убирает из содержимого строки чейнджлога — только для файла переводов. */
function stripChangelogLines(content: string): string {
  return content
    .split("\n")
    .filter((line) => !CHANGELOG_KEY.test(line))
    .join("\n");
}

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
    pattern: /\b37\b[^\n]{0,24}(modules?\s+deployed|modules?\s+live|product nodes)/i,
    reason:
      '"37 modules deployed" — stale module count (37). It survived in SEO meta and ' +
      "OG descriptions after the registry grew to 41; import MODULE_NODES instead.",
  },
  {
    pattern: /\b29\b[^\n]{0,20}(product nodes|modules? live|nodes)/i,
    reason: '"29 … nodes" — stale module count (never hardcode it; import MODULE_NODES from pitchFacts)',
  },
];

/**
 * AutoTranslate matches dictionary keys by EXACT full string. So the moment the
 * module count changes, the phrase "<N> product nodes" stops matching and the
 * Russian rendering silently falls back to English — no error, no test failure,
 * just an untranslated line nobody notices. This locks the two together.
 */
describe("AutoTranslate — the module-count phrase stays translatable", () => {
  it(`carries a dictionary entry for the current count`, async () => {
    const { MODULE_NODES } = await import("@/data/pitchFacts");
    const dict = readFileSync(path.join(FRONTEND_ROOT, "src/components/AutoTranslate.tsx"), "utf8");
    const phrase = `"${MODULE_NODES} product nodes"`;
    expect(
      dict.includes(phrase),
      `AutoTranslate.tsx has no entry for ${phrase}. The dictionary matches whole ` +
        `strings exactly, so without it the phrase renders untranslated in RU. ` +
        `Add the pair next to the existing "product nodes" entries.`,
    ).toBe(true);
  });
});

describe("pitch numbers — retired figures must not resurface", () => {
  for (const rel of SURFACES) {
    it(`${rel} carries no retired figures`, () => {
      const raw = readFileSync(path.join(FRONTEND_ROOT, rel), "utf8");
      // Файл переводов держит и живой текст, и записи чейнджлога. Вторые —
      // историческая правда о том, что было выпущено при 37 модулях.
      const src = rel.endsWith("i18n-data.ts") ? stripChangelogLines(raw) : raw;
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
 * Lock the canonical counts to the registry — by COUNTING it.
 *
 * The previous version of this block asserted `MODULE_NODES === 37` and
 * `LIVE_MODULES === 35` against literals. That compares one hardcoded number to
 * another: the registry grew from 38 entries to 41 and both assertions stayed
 * green while every pitch surface published a stale figure (audit 2026-07-26 —
 * real counts were 41 total / 36 live, published counts were 37 / 35).
 *
 * A guard that cannot fail is not a guard. These now read projects.ts and
 * report the number they actually found, so the fix is obvious when it breaks.
 */
const REGISTRY = path.resolve(FRONTEND_ROOT, "../aevion-globus-backend/src/data/projects.ts");

/** Statuses as they appear in projects.ts entries. */
function countRegistry(): { total: number; byStatus: Record<string, number> } {
  const src = readFileSync(REGISTRY, "utf8");
  const statuses = Array.from(src.matchAll(/status:\s*["'](\w+)["']/g)).map((m) => m[1]);
  const byStatus: Record<string, number> = {};
  for (const s of statuses) byStatus[s] = (byStatus[s] ?? 0) + 1;
  return { total: statuses.length, byStatus };
}

/** The globus entry is the map shell, not a product node — see pitchFacts header. */
const MAP_SHELL_ENTRIES = 1;

describe("pitchFacts — canonical counts stay in sync with the registry", () => {
  it("MODULE_NODES equals registry entries minus the globus map shell", async () => {
    const { total } = countRegistry();
    const { MODULE_NODES } = await import("@/data/pitchFacts");
    expect(
      MODULE_NODES,
      `projects.ts now holds ${total} entries, so MODULE_NODES should be ` +
        `${total - MAP_SHELL_ENTRIES}. Update src/data/pitchFacts.ts.`,
    ).toBe(total - MAP_SHELL_ENTRIES);
  });

  it("REGISTRY_ENTRIES equals the total number of entries in projects.ts", async () => {
    const { total } = countRegistry();
    const { REGISTRY_ENTRIES } = await import("@/data/pitchFacts");
    expect(
      REGISTRY_ENTRIES,
      `projects.ts now holds ${total} entries, so REGISTRY_ENTRIES should be ` +
        `${total}. Update src/data/pitchFacts.ts.`,
    ).toBe(total);
  });

  it('LIVE_MODULES equals the count of status:"live" in projects.ts', async () => {
    const { byStatus } = countRegistry();
    const live = byStatus.live ?? 0;
    const { LIVE_MODULES } = await import("@/data/pitchFacts");
    expect(
      LIVE_MODULES,
      `projects.ts now holds ${live} live modules. Update src/data/pitchFacts.ts.`,
    ).toBe(live);
  });

  it("the registry is readable and non-empty (the counter itself must not silently return 0)", () => {
    const { total, byStatus } = countRegistry();
    expect(total).toBeGreaterThan(20);
    expect(Object.keys(byStatus).length).toBeGreaterThan(0);
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
 *
 * SCOPE, and its counterpart. The checks below pin NAMED surfaces to the
 * registry — they answer "is this specific figure still right?". They cannot
 * answer "did a retired price reappear somewhere nobody is watching?": the $59
 * All-Access banner and the $149 devhub link were both found by hand on
 * 2026-08-10, not by this guard. That question belongs to
 * retiredPrices.guard.test.ts, which sweeps the whole frontend for the four
 * retired tier prices and names every legitimate exception — the same bet
 * scaleClaims.guard.test.ts makes for module counts. Keep the two apart:
 * positive pinning here, whole-sweep there, and no third mechanism.
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

/**
 * These pull in pitchModel/pitchFacts through a dynamic import. Under a full
 * parallel run on a loaded machine that import alone can exceed vitest's 5s
 * default, which is sized for pure unit tests — the guard then goes red because
 * the disk was busy, not because a price drifted. A guard that is red for no
 * reason is one people learn to skim past.
 */
const IMPORT_TIMEOUT_MS = 30_000;

describe("prices — derived surfaces stay in sync with the backend tier registry", () => {
  it("the registry parses and still holds the six known tiers", () => {
    const tiers = registryTierPrices();
    expect(Object.keys(tiers).sort()).toEqual(
      ["enterprise", "free", "full", "lite", "medium", "pro"],
    );
    expect(tiers.enterprise).toBeNull();
  }, IMPORT_TIMEOUT_MS);

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
  }, IMPORT_TIMEOUT_MS);

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
  }, IMPORT_TIMEOUT_MS);

  it("the growth model prices the Universe seat at the registry price", async () => {
    const tiers = registryTierPrices();
    const { launchGrowth } = await import("@/data/pitchModel");

    expect(launchGrowth.seat.headline).toBe(`$${tiers.pro} / mo`);
    expect(
      launchGrowth.seat.honesty,
      "The on-ramp ladder quoted next to the seat price must be the live one.",
    ).toContain(`($0/$${tiers.lite}/$${tiers.medium}/$${tiers.full})`);
  }, IMPORT_TIMEOUT_MS);

  it("the bottom-up model prices All-Access at the live Full tier", async () => {
    const tiers = registryTierPrices();
    const { unitEconomics } = await import("@/data/pitchModel");
    const allAccess = unitEconomics.flagships.find((f) => f.module === "Ecosystem All-Access");
    expect(allAccess, "The 'Ecosystem All-Access' flagship disappeared from unitEconomics").toBeTruthy();
    expect(
      allAccess!.price.startsWith(`$${tiers.full}/mo`),
      `All-Access is the Full tier — its modelled price must open with $${tiers.full}/mo, got: ${allAccess!.price}`,
    ).toBe(true);
  }, IMPORT_TIMEOUT_MS);

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
    }, IMPORT_TIMEOUT_MS);
  }
});

/**
 * The same drift, one level down: per-product prices quoted on marketing and
 * investor surfaces while the charging code lives elsewhere in the backend.
 * Each case below was a real wrong number found on 2026-08-10, so each is
 * pinned to the file that actually decides what a customer pays.
 */

const BACKEND_SRC = path.resolve(FRONTEND_ROOT, "../aevion-globus-backend/src");

/** Read a backend file, failing with a useful message if the layout moved. */
function readBackend(rel: string): string {
  const abs = path.join(BACKEND_SRC, rel);
  try {
    return readFileSync(abs, "utf8");
  } catch {
    throw new Error(
      `Could not read ${abs}. If the backend was restructured, repoint this guard — ` +
        "do not delete it; it exists because these numbers drifted silently once.",
    );
  }
}

describe("product prices — marketing copy stays pinned to the charging code", () => {
  it("the All-Access upgrade banner carries no hardcoded price", () => {
    const src = readFileSync(path.join(FRONTEND_ROOT, "src/components/UpgradeButton.tsx"), "utf8");
    // This banner renders on 9 module pages next to a live checkout. It sat at
    // "$59/мес" — a number no tier ever charged. The price must be imported.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(
      /\$\s?\d/.test(code),
      "UpgradeButton.tsx must not type a price literal — read it from @/lib/products.",
    ).toBe(false);
    // It sells the Gumroad product `xpxzam`, not a tier, so the figure must come
    // from the product catalogue (verified against the live Gumroad dashboard on
    // 2026-07-26) — not from the tier registry.
    expect(src).toContain('productById("xpxzam")');
  }, IMPORT_TIMEOUT_MS);

  it("/investor quotes the live Bureau Verified price", () => {
    const payment = readBackend("lib/payment/index.ts");
    // getVerifiedTierPriceCents(): the env override is a deployment concern;
    // the default in code is what the published page should quote.
    const m = payment.match(/BUREAU_VERIFIED_PRICE_CENTS[\s\S]{0,200}?return\s+(\d+);/);
    expect(m, "Could not read the Verified-tier default price from lib/payment/index.ts").toBeTruthy();
    const usd = Number(m![1]) / 100;

    const investor = readFileSync(path.join(FRONTEND_ROOT, "src/app/investor/page.tsx"), "utf8");
    expect(
      investor,
      `Bureau Verified is charged at $${usd}/cert — /investor must not quote a different figure.`,
    ).toContain(`{ tier: "Verified", price: "$${usd}"`);
  }, IMPORT_TIMEOUT_MS);

  it("/investor quotes the real QBuild hire-fee range", () => {
    const build = readBackend("lib/build/index.ts");
    // hireFeeBps/10000 of the accepted salary, tier-adjusted at hire time.
    const bps = [...build.matchAll(/hireFeeBps:\s*(\d+),/g)]
      .map((x) => Number(x[1]))
      .filter((n) => n > 0);
    expect(bps.length, "No hireFeeBps values found in lib/build/index.ts").toBeGreaterThan(1);
    const base = Math.max(...bps) / 100;
    const best = Math.min(...bps) / 100;

    const investor = readFileSync(path.join(FRONTEND_ROOT, "src/app/investor/page.tsx"), "utf8");
    expect(
      investor,
      `The hire fee runs ${base}% (default recruiter tier) down to ${best}% (Platinum). ` +
        "It once read \"1.5%\" here — 8× below what the platform actually takes.",
    ).toContain(`price: "${base}% → ${best}%"`);
  }, IMPORT_TIMEOUT_MS);
});
