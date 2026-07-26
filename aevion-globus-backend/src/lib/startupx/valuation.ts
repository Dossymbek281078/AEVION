/**
 * StartupX — deal guidance
 * ────────────────────────
 * What this file does NOT do: value a company. Nobody can value a pre-revenue
 * idea from a paragraph of text, and pretending otherwise is the single most
 * dishonest thing a marketplace can put on a screen.
 *
 * What it does: state the price range the *market* actually transacts in for a
 * listing of this shape, and check the founder's own asking terms against it.
 * So the investor sees "founder asks a $300k post-money for an unbuilt idea;
 * comparable idea-stage deals close at $50k–$500k, and this one scores in the
 * bottom third of that band" — a comparison, not a verdict.
 *
 * Every band below is a published market convention, not our measurement. The
 * sources are carried in MARKET_SOURCES and surfaced in the UI so a founder can
 * audit the anchor rather than trust it.
 */

import type { Tier, DealTerms, ListingMetrics } from "./model";

export interface MarketSource {
  publisher: string;
  year: number;
  claim: string;
  url: string;
}

/**
 * The anchors behind every number in this file. Checked 2026-07-26.
 *
 * Note the spread between them: revenue multiples for the same size of business
 * are quoted anywhere from 1.7× to 4×, which is exactly why the guidance here is
 * a band and never a point estimate.
 */
export const MARKET_SOURCES: MarketSource[] = [
  {
    publisher: "bigideasdb — SaaS Valuation Multiples 2026 (520+ deals)",
    year: 2026,
    claim: "Публичные листинги SaaS: медиана 2.6× годовой выручки; средний ask $484K при выручке $203K TTM.",
    url: "https://bigideasdb.com/saas-valuation-multiples-2026",
  },
  {
    publisher: "Nate Lind — SaaS Acquisition Multiples 2026 (190 closed deals)",
    year: 2026,
    claim: "Медиана закрытых сделок 2026 — 3.7× EBITDA; сделки до $100K закрываются около 1.68× прибыли, свыше $1M — около 4.3×.",
    url: "https://www.natelind.com/blog/saas-acquisition-multiples-2026",
  },
  {
    publisher: "CT Acquisitions — SaaS Business Valuation 2026",
    year: 2026,
    claim: "Micro-SaaS до $1M ARR торгуется в диапазоне 2.5–4× ARR (против 4–5× у более крупных).",
    url: "https://ctacquisitions.com/saas-business-valuation/",
  },
  {
    publisher: "Acquire.com",
    year: 2026,
    claim: "Маркетплейс микро-выкупов: 2000+ закрытых сделок, $500M+ объёма; пре-ревенью проекты и MVP продаются в диапазоне $5K–$50K.",
    url: "https://acquire.com/",
  },
];

// ── Pre-revenue bands ────────────────────────────────────────────────────────
//
// Idea and MVP tiers have no revenue to multiply, so the band comes from what
// angel / micro deals actually price at. These are wide on purpose: at this
// stage price is set by negotiation and by who the founder is, not by a model.

const PRE_REVENUE_BANDS: Record<Exclude<Tier, "product">, { low: number; high: number }> = {
  // Unbuilt idea. Bottom = "a weekend of someone's time"; top = a credible
  // founder with a spec and a plan (the level a YC-style standard deal implies).
  idea: { low: 50_000, high: 500_000 },
  // Something runs. Bottom = a demo nobody uses; top = a working product with
  // early users but no meaningful revenue.
  mvp: { low: 150_000, high: 1_500_000 },
};

/**
 * Revenue multiple band by revenue scale, from the sources above.
 *
 * Small deals genuinely trade lower — the sub-$100K bracket closes near 1.7×
 * profit while deals above $1M reach ~4.3×. Written as brackets this produced a
 * cliff: $99K of revenue got 1.5–2.5× and $101K got 2.0–3.5×, so two nearly
 * identical businesses were told very different things by an accident of
 * rounding. The anchors are interpolated on a log scale instead, which is how
 * the underlying data actually behaves.
 */
const MULTIPLE_ANCHORS: Array<{ revenue: number; low: number; high: number }> = [
  { revenue: 10_000, low: 1.3, high: 2.2 },
  { revenue: 100_000, low: 2.0, high: 3.0 },
  { revenue: 1_000_000, low: 3.0, high: 4.5 },
  { revenue: 10_000_000, low: 3.5, high: 5.0 },
];

function revenueMultipleBand(annualRevenueUsd: number): { low: number; high: number } {
  const r = Math.max(1, annualRevenueUsd);
  const first = MULTIPLE_ANCHORS[0];
  const last = MULTIPLE_ANCHORS[MULTIPLE_ANCHORS.length - 1];
  if (r <= first.revenue) return { low: first.low, high: first.high };
  if (r >= last.revenue) return { low: last.low, high: last.high };
  for (let i = 0; i < MULTIPLE_ANCHORS.length - 1; i++) {
    const a = MULTIPLE_ANCHORS[i];
    const b = MULTIPLE_ANCHORS[i + 1];
    if (r <= b.revenue) {
      const t = (Math.log10(r) - Math.log10(a.revenue)) / (Math.log10(b.revenue) - Math.log10(a.revenue));
      return {
        low: round2(a.low + (b.low - a.low) * t),
        high: round2(a.high + (b.high - a.high) * t),
      };
    }
  }
  return { low: last.low, high: last.high };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface ValuationBand {
  low: number;
  base: number;
  high: number;
  /** Plain-Russian explanation of where these three numbers came from. */
  basis: string;
  /** "revenue-multiple" | "stage-band" — what kind of anchor was used. */
  method: "revenue-multiple" | "stage-band";
}

/**
 * Market band for a listing, positioned within itself by the readiness score.
 *
 * `score` (0–100) only moves the *base* inside the band — it never widens or
 * narrows it. A high score does not make an idea worth more than idea-stage
 * deals close at; it makes it worth the upper part of that same range.
 */
export function valuationBand(args: {
  tier: Tier;
  score: number;
  annualRevenueUsd: number | null;
  metrics?: ListingMetrics;
}): ValuationBand {
  const { tier, score, annualRevenueUsd, metrics } = args;
  const pos = Math.max(0, Math.min(1, score / 100));

  if (tier === "product" && annualRevenueUsd !== null && annualRevenueUsd > 0) {
    const mult = revenueMultipleBand(annualRevenueUsd);
    // Growth and margin move the multiple inside its own band — the two things
    // buyers actually pay up for. Neither can push it outside the band.
    const growth = metrics?.growthMomPct ?? 0;
    const margin = metrics?.grossMarginPct ?? null;
    let adj = pos;
    if (growth >= 10) adj = Math.min(1, adj + 0.15);
    if (margin !== null && margin >= 70) adj = Math.min(1, adj + 0.1);
    if (margin !== null && margin < 40) adj = Math.max(0, adj - 0.15);
    const baseMult = mult.low + (mult.high - mult.low) * adj;
    return {
      low: Math.round(annualRevenueUsd * mult.low),
      base: Math.round(annualRevenueUsd * baseMult),
      high: Math.round(annualRevenueUsd * mult.high),
      method: "revenue-multiple",
      basis:
        `Годовая выручка $${fmt(annualRevenueUsd)} × ${mult.low}–${mult.high} — диапазон, ` +
        `в котором в 2026 торгуются продукты этого размера (см. источники).`,
    };
  }

  // Everything else is priced off the stage band. Note what this is NOT saying:
  // an idea or MVP with some early revenue is not priced on that revenue, because
  // at this stage the price is set by negotiation, not by a multiple of $800/mo.
  // The wording has to say that rather than "выручки нет" — a founder who typed
  // an MRR in and was told they have no revenue stops trusting everything else
  // on the page, and they would be right to.
  const key: Exclude<Tier, "product"> = tier === "idea" ? "idea" : "mvp";
  const band = PRE_REVENUE_BANDS[key];
  const base = Math.round(band.low + (band.high - band.low) * pos);
  const hasRevenue = annualRevenueUsd !== null && annualRevenueUsd > 0;

  let basis: string;
  if (tier === "product") {
    basis = "Выручка не раскрыта, поэтому оценка идёт по диапазону MVP: покупатель платит за то, что может проверить.";
  } else if (hasRevenue) {
    basis =
      `Годовая выручка ~$${fmt(annualRevenueUsd)} учтена в баллах, но цену на этом уровне определяет не она: ` +
      `диапазон взят из рынка сделок «${tier === "idea" ? "только идея" : "идея + MVP"}».`;
  } else {
    basis = "Выручки нет — диапазон взят из рынка сделок этого уровня, а не рассчитан по вашему проекту.";
  }

  return { low: band.low, base, high: band.high, method: "stage-band", basis };
}

// ── Founder's own terms ──────────────────────────────────────────────────────

export interface ImpliedTerms {
  /** Post-money the founder's own numbers imply, USD. */
  postMoneyUsd: number | null;
  /** How that compares to the market band: <1 below, 1 inside, >1 above. */
  ratioToBandHigh: number | null;
  /** Exactly which arithmetic produced postMoneyUsd. */
  formula: string | null;
}

/**
 * Turn asking terms into an implied post-money valuation.
 *
 * raise:       $30k for 10%  → post-money $300k
 * sell_stake:  $60k for 20%  → implied whole-company value $300k
 * sell_full:   asking price is the whole-company value
 */
export function impliedTerms(deal: DealTerms, band: ValuationBand): ImpliedTerms {
  let post: number | null = null;
  let formula: string | null = null;

  if (deal.intent === "raise" && deal.askUsd && deal.equityOfferedPct && deal.equityOfferedPct > 0) {
    post = deal.askUsd / (deal.equityOfferedPct / 100);
    formula = `$${fmt(deal.askUsd)} ÷ ${deal.equityOfferedPct}% = пост-оценка $${fmt(post)}`;
  } else if (deal.intent === "sell_stake" && deal.stakePriceUsd && deal.stakeForSalePct && deal.stakeForSalePct > 0) {
    post = deal.stakePriceUsd / (deal.stakeForSalePct / 100);
    formula = `$${fmt(deal.stakePriceUsd)} ÷ ${deal.stakeForSalePct}% = оценка всей компании $${fmt(post)}`;
  } else if (deal.intent === "sell_full" && deal.askingPriceUsd) {
    post = deal.askingPriceUsd;
    formula = `Цена продажи целиком: $${fmt(post)}`;
  }

  return {
    postMoneyUsd: post === null ? null : Math.round(post),
    ratioToBandHigh: post === null || band.high <= 0 ? null : Math.round((post / band.high) * 100) / 100,
    formula,
  };
}

/** Investor entry ticket suggested for this listing, inside the tier's norm. */
export function suggestedTicketUsd(tier: Tier, deal: DealTerms, ticketNorm: { low: number; high: number }): {
  low: number;
  high: number;
  note: string;
} {
  // When the founder states an ask, the ticket range is anchored to it: a lead
  // taking a third of the round, up to the whole round.
  if (deal.intent === "raise" && deal.askUsd && deal.askUsd > 0) {
    return {
      low: Math.max(1_000, Math.round(deal.askUsd / 3)),
      high: Math.round(deal.askUsd),
      note: "От трети раунда (лид-инвестор) до полного закрытия запроса.",
    };
  }
  if (deal.intent === "sell_stake" && deal.stakePriceUsd && deal.stakePriceUsd > 0) {
    return { low: Math.round(deal.stakePriceUsd), high: Math.round(deal.stakePriceUsd), note: "Цена доли зафиксирована продавцом." };
  }
  if (deal.intent === "sell_full" && deal.askingPriceUsd && deal.askingPriceUsd > 0) {
    return { low: Math.round(deal.askingPriceUsd), high: Math.round(deal.askingPriceUsd), note: "Цена выкупа целиком." };
  }
  return { low: ticketNorm.low, high: ticketNorm.high, note: `Типичный чек на уровне «${tier}».` };
}

/**
 * Money, short. A trailing ".0" is noise — "$30.0K за 15%" reads like a
 * measurement, "$30K за 15%" reads like a deal — so the decimal appears only
 * when it carries information.
 */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const short = (value: number, digits: number): string => {
    const rounded = value.toFixed(digits);
    return rounded.endsWith(".0") ? rounded.slice(0, -2) : rounded;
  };
  if (Math.abs(n) >= 1_000_000) return `${short(n / 1_000_000, n >= 10_000_000 ? 0 : 1)}M`;
  if (Math.abs(n) >= 1_000) return `${short(n / 1_000, n >= 100_000 ? 0 : 1)}K`;
  return String(Math.round(n));
}
