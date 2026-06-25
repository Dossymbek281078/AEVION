// AEVION module pricing — single source of truth for solo + bundle + all-access
// pricing tiers. Consumed by /api/aevion/pricing and (eventually) by the
// per-app pricing chips and Paddle Price ID lookup tables.
//
// Design (per design doc 2026-05-22):
//   - Solo (à la carte): 3 compute tiers — light $5, standard $9, heavy $15.
//   - Bundles: fintech, build, ai, gaming — priced at ~50% of sum-of-solos.
//   - All-Access: $49/mo, covers every module shipped now and in the future.
//     Kept in lockstep with the GTM "Full" tier in data/pricing.ts ($49) so the
//     ModulePricingChip's "All-Access" line matches the price actually charged
//     at checkout. If you re-price Full, re-price ALL_ACCESS_USD with it.
//   - Annual billing -20% (stored as annualPerMonth for display).
//   - 4 currencies pre-computed: USD, EUR, KZT, RUB. FX freshness in
//     currencyRatesAt so the frontend can warn if rates are stale.
//
// To add a new module: append to MODULE_PRICING with computeTier + bundle
// assignment. Solo + bundle + all-access pricing flow from that.
//
// To re-rate currencies: update FX_RATES + bump CURRENCY_RATES_AT. All
// solo/bundle/all-access numbers recompute from USD anchor.

export type CurrencyCode = "USD" | "EUR" | "KZT" | "RUB";
export type ComputeTier = "light" | "standard" | "heavy";
export type BundleId = "fintech" | "build" | "ai" | "gaming";

// USD anchor prices per compute tier (monthly).
const SOLO_USD: Record<ComputeTier, number> = {
  light: 5,
  standard: 9,
  heavy: 15,
};

// USD anchor prices per bundle (monthly).
const BUNDLE_USD: Record<BundleId, number> = {
  fintech: 29,
  build: 19,
  ai: 29,
  gaming: 19,
};

const ALL_ACCESS_USD = 49;

// Annual discount applied to the monthly price.
const ANNUAL_DISCOUNT = 0.20;

// FX rates: 1 USD = X currency. Updated manually until we wire a daily FX job.
const FX_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  EUR: 0.92,
  KZT: 500,
  RUB: 90,
};

export const CURRENCY_RATES_AT = "2026-05-22T00:00:00.000Z";

interface ModulePricingEntry {
  id: string;
  computeTier: ComputeTier;
  bundle: BundleId | null;
}

// Module → (computeTier, bundle) catalog. Reflects the 37-module catalog
// at /api/aevion/catalog. If a module is dropped from the catalog its
// pricing entry stays harmless; if a module is added without an entry
// here the pricing endpoint emits a console warning at boot.
export const MODULE_PRICING: ModulePricingEntry[] = [
  // Fintech bundle (6) — real-money flows + reputation/governance
  { id: "qpaynet-embedded", computeTier: "heavy",    bundle: "fintech" },
  { id: "qmaskcard",        computeTier: "standard", bundle: "fintech" },
  { id: "veilnetx",         computeTier: "heavy",    bundle: "fintech" },
  { id: "z-tide",           computeTier: "light",    bundle: "fintech" },
  { id: "qchaingov",        computeTier: "light",    bundle: "fintech" },
  { id: "qgood",            computeTier: "standard", bundle: "fintech" },

  // Build bundle (5) — IP / signing / contracts
  { id: "qbuild",            computeTier: "standard", bundle: "build" },
  { id: "qsign",             computeTier: "standard", bundle: "build" },
  { id: "qright",            computeTier: "light",    bundle: "build" },
  { id: "aevion-ip-bureau",  computeTier: "light",    bundle: "build" },
  { id: "qcontract",         computeTier: "standard", bundle: "build" },

  // AI bundle (5) — LLM-driven personas / multi-agent
  { id: "qcoreai",         computeTier: "heavy",    bundle: "ai" },
  { id: "multichat-engine",computeTier: "standard", bundle: "ai" },
  { id: "qfusionai",       computeTier: "heavy",    bundle: "ai" },
  { id: "qpersona",        computeTier: "standard", bundle: "ai" },
  { id: "healthai",        computeTier: "heavy",    bundle: "ai" },

  // Gaming/UX bundle (5) — consumer-facing engagement loops
  { id: "cyberchess",       computeTier: "standard", bundle: "gaming" },
  { id: "qlearn",           computeTier: "standard", bundle: "gaming" },
  { id: "qlife",            computeTier: "standard", bundle: "gaming" },
  { id: "qevents",          computeTier: "standard", bundle: "gaming" },
  { id: "kids-ai-content",  computeTier: "standard", bundle: "gaming" },

  // Standalone / infra (16) — solo-only, no bundle
  { id: "revenue-hub",      computeTier: "heavy",    bundle: null },
  { id: "globus",           computeTier: "light",    bundle: null },
  { id: "qtradeoffline",    computeTier: "standard", bundle: null },
  { id: "psyapp-deps",      computeTier: "standard", bundle: null },
  { id: "voice-of-earth",   computeTier: "standard", bundle: null },
  { id: "startup-exchange", computeTier: "standard", bundle: null },
  { id: "deepsan",          computeTier: "standard", bundle: null },
  { id: "mapreality",       computeTier: "light",    bundle: null },
  { id: "shadownet",        computeTier: "standard", bundle: null },
  { id: "lifebox",          computeTier: "standard", bundle: null },
  { id: "smeta-trainer",    computeTier: "standard", bundle: null },
  { id: "qnews",            computeTier: "standard", bundle: null },
  { id: "qmedia",           computeTier: "standard", bundle: null },
  { id: "qai",              computeTier: "heavy",    bundle: null },
  { id: "qstore",           computeTier: "light",    bundle: null },
  { id: "constitution",     computeTier: "light",    bundle: null },
];

// Currency conversion helper. KZT/RUB round to whole units (no kopecks
// shown), USD/EUR keep 2 decimals.
function convert(usd: number, currency: CurrencyCode): number {
  const raw = usd * FX_RATES[currency];
  if (currency === "USD" || currency === "EUR") return Math.round(raw * 100) / 100;
  return Math.round(raw);
}

function priceInAllCurrencies(usd: number): Record<CurrencyCode, number> {
  return {
    USD: convert(usd, "USD"),
    EUR: convert(usd, "EUR"),
    KZT: convert(usd, "KZT"),
    RUB: convert(usd, "RUB"),
  };
}

function annualPerMonth(usd: number): number {
  return usd * (1 - ANNUAL_DISCOUNT);
}

export interface SoloPrice {
  id: string;
  computeTier: ComputeTier;
  bundle: BundleId | null;
  monthly: Record<CurrencyCode, number>;
  annualPerMonth: Record<CurrencyCode, number>;
}

export interface BundlePrice {
  id: BundleId;
  modules: string[];
  monthly: Record<CurrencyCode, number>;
  annualPerMonth: Record<CurrencyCode, number>;
  saveVsSolo: Record<CurrencyCode, number>;
}

export interface AllAccessPrice {
  modules: number;
  monthly: Record<CurrencyCode, number>;
  annualPerMonth: Record<CurrencyCode, number>;
  saveVsAllSolo: Record<CurrencyCode, number>;
}

export interface PricingResponse {
  solo: SoloPrice[];
  bundles: BundlePrice[];
  allAccess: AllAccessPrice;
  currencyRatesAt: string;
  generatedAt: string;
}

export function buildPricingResponse(): PricingResponse {
  const solo: SoloPrice[] = MODULE_PRICING.map((m) => {
    const usd = SOLO_USD[m.computeTier];
    return {
      id: m.id,
      computeTier: m.computeTier,
      bundle: m.bundle,
      monthly: priceInAllCurrencies(usd),
      annualPerMonth: priceInAllCurrencies(annualPerMonth(usd)),
    };
  });

  const bundles: BundlePrice[] = (Object.keys(BUNDLE_USD) as BundleId[]).map((b) => {
    const usd = BUNDLE_USD[b];
    const modulesInBundle = MODULE_PRICING.filter((m) => m.bundle === b);
    const soloSumUsd = modulesInBundle.reduce((sum, m) => sum + SOLO_USD[m.computeTier], 0);
    return {
      id: b,
      modules: modulesInBundle.map((m) => m.id),
      monthly: priceInAllCurrencies(usd),
      annualPerMonth: priceInAllCurrencies(annualPerMonth(usd)),
      saveVsSolo: priceInAllCurrencies(soloSumUsd - usd),
    };
  });

  const allSoloSumUsd = MODULE_PRICING.reduce((sum, m) => sum + SOLO_USD[m.computeTier], 0);
  const allAccess: AllAccessPrice = {
    modules: MODULE_PRICING.length,
    monthly: priceInAllCurrencies(ALL_ACCESS_USD),
    annualPerMonth: priceInAllCurrencies(annualPerMonth(ALL_ACCESS_USD)),
    saveVsAllSolo: priceInAllCurrencies(allSoloSumUsd - ALL_ACCESS_USD),
  };

  return {
    solo,
    bundles,
    allAccess,
    currencyRatesAt: CURRENCY_RATES_AT,
    generatedAt: new Date().toISOString(),
  };
}
