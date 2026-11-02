/**
 * StartupX — free listing assessment
 * ──────────────────────────────────
 * Every listing on the exchange gets this, free, at every tier, computed
 * synchronously with no LLM call: it is deterministic, so the same listing
 * always produces the same number, and two listings can be compared because the
 * same rules produced both.
 *
 * Three design rules, in order of importance:
 *
 * 1. Never claim to know what it cannot see. The assessment reads a text and
 *    some numbers the founder typed. It has not met the team, run the code,
 *    checked the cap table or called a customer. `blindSpots` says so on every
 *    single result, and the wording of each factor states its basis.
 * 2. Separate pitch quality from business quality. A clear description of a bad
 *    idea scores well on clarity and that is *all* it means. Labelled as such.
 * 3. Never emit a guarantee. The disclaimer is part of the payload, not a
 *    footer the UI may forget to render.
 */

import {
  TIER_SPECS,
  annualRevenueUsd,
  listingSectorDetection,
  listingSignals,
  type ListingInput,
  type Tier,
} from "./model";
import {
  MARKET_SOURCES,
  marketSourcesFor,
  impliedTerms,
  suggestedTicketUsd,
  valuationBand,
  fmt,
  type ImpliedTerms,
  type ValuationBand,
} from "./valuation";
import type { PlanSignals } from "../qventure/signals";
import type { SectorProfile } from "../qventure/sectors";
import type { SectorDetection } from "./sectorDetect";

/** Language of the human-readable text. The stored assessment is always "ru". */
export type AssessLang = "ru" | "en";

/** Anything but "en" is Russian: an unknown value must never change the text. */
export function normalizeAssessLang(v: unknown): AssessLang {
  return typeof v === "string" && v.trim().toLowerCase().slice(0, 2) === "en" ? "en" : "ru";
}

const TIER_LABEL_EN: Record<Tier, string> = { idea: "Idea only", mvp: "Idea + MVP", product: "Finished product" };

export function tierLabel(tier: Tier, lang: AssessLang = "ru"): string {
  return lang === "en" ? TIER_LABEL_EN[tier] : TIER_SPECS[tier].label;
}

/** Bump when the rules below change, so old scores are never silently compared
 *  to new ones. The listing row stores this next to the score. */
export const ASSESSMENT_VERSION = 1;

export type Basis = "company-evidence" | "sector-prior" | "text-only";

export interface AssessmentFactor {
  key: string;
  label: string;
  weight: number;
  score: number;
  rationale: string;
  basis: Basis;
}

export type FlagSeverity = "high" | "medium" | "info";

export interface RedFlag {
  severity: FlagSeverity;
  message: string;
}

export interface DealAssessment {
  band: ValuationBand;
  implied: ImpliedTerms;
  ticket: { low: number; high: number; note: string };
}

export interface Assessment {
  version: number;
  tier: Tier;
  score: number;
  band: "strong" | "mixed" | "weak";
  headline: string;
  factors: AssessmentFactor[];
  redFlags: RedFlag[];
  blindSpots: string[];
  deal: DealAssessment;
  sector: { id: string; label: string; tamUsdBn: number; cagr: number; origin: "declared" | "detected" | "fallback" };
  sources: typeof MARKET_SOURCES;
  /** 0–1: share of the score backed by numbers the founder actually disclosed. */
  evidenceCoverage: number;
  disclaimer: string;
  generatedAt: string;
}

export const DISCLAIMER_EN =
  "This is a free automated analysis based on the formal features of the listing. " +
  "It guarantees neither the success nor the failure of the project: it has not seen your team, code, " +
  "legal documents or the live market, and has not verified the figures provided. " +
  "Only the investor makes the investment decision; only the parties to a deal set the price.";

export function disclaimerFor(lang: AssessLang = "ru"): string {
  return lang === "en" ? DISCLAIMER_EN : DISCLAIMER;
}

export const DISCLAIMER =
  "Это бесплатный автоматический анализ по формальным признакам заявки. " +
  "Он не гарантирует ни успеха, ни неудачи проекта: он не видел вашу команду, код, " +
  "юридические документы и живой рынок, и не проверял достоверность указанных цифр. " +
  "Решение об инвестиции принимает только инвестор, цену определяют только стороны сделки.";

// ── Factor weights per tier ──────────────────────────────────────────────────
//
// The same five questions matter at every tier, but not equally. At idea stage
// there is nothing to measure but the thinking; at product stage the numbers
// carry the weight and the prose barely matters.

const WEIGHTS: Record<Tier, Record<string, number>> = {
  idea:    { clarity: 0.34, market: 0.26, moat: 0.14, evidence: 0.10, deal: 0.16 },
  mvp:     { clarity: 0.22, market: 0.22, moat: 0.15, evidence: 0.26, deal: 0.15 },
  product: { clarity: 0.12, market: 0.18, moat: 0.15, evidence: 0.35, deal: 0.20 },
};

// ── 1. Clarity: quality of the pitch, not of the business ────────────────────

interface Cue {
  key: string;
  label: string;
  labelEn: string;
  points: number;
  re: RegExp;
}

/**
 * `\b` in JavaScript is ASCII-only: between a space and "проблема" there is no
 * word boundary at all, because Cyrillic letters are not `\w`. A cue written as
 * /\b(проблем|...)/i therefore never fires on a Russian text — and since most
 * founders here write in Russian, every one of their listings would have scored
 * as though it said nothing, silently and without an error anywhere.
 *
 * These build the boundary from Unicode letter classes instead.
 */
const LEFT_EDGE = "(?<![\\p{L}\\p{N}_])";
const RIGHT_EDGE = "(?![\\p{L}\\p{N}_])";

function cue(body: string): RegExp {
  return new RegExp(`${LEFT_EDGE}(?:${body})`, "iu");
}

/**
 * Bilingual cues — founders write in Russian or English and the exchange must
 * not score a Russian listing lower for being Russian.
 */
const CLARITY_CUES: Cue[] = [
  {
    key: "audience",
    label: "названа аудитория",
    labelEn: "target audience named",
    points: 16,
    re: cue(
      `для\\s+(?:кого|малого|среднего|крупного|b2b|b2c)|наша аудитория|целевая аудитор|клиенты?\\s*[-—:]` +
      `|for\\s+(?:smb|smbs|enterprises?|freelancers?|developers?|teams?)|target (?:audience|customer)|our (?:users|customers)`,
    ),
  },
  {
    key: "problem",
    label: "сформулирована проблема",
    labelEn: "problem stated",
    points: 18,
    re: cue(
      `проблем|боль${RIGHT_EDGE}|болью|вручную|тратят|теряют|неудобн|нет способа|приходится` +
      `|problem|pain\\s?point|manually|waste[sd]?\\s+(?:time|money)|struggle|no way to`,
    ),
  },
  {
    key: "mechanism",
    label: "описано, как это работает",
    labelEn: "how it works described",
    points: 16,
    re: cue(
      `мы\\s+(?:делаем|строим|автоматизируем)|платформ|алгоритм|интеграц|автоматическ` +
      `|api${RIGHT_EDGE}|we (?:build|automate|match|connect)|platform|algorithm|pipeline|integrat`,
    ),
  },
  {
    key: "money",
    label: "описано, на чём зарабатываем",
    labelEn: "revenue model described",
    points: 18,
    re: cue(
      `подписк|комисси|тариф|цена|стоимость|монетиз|платят` +
      `|subscription|commission|take rate|pricing|per (?:seat|user|month)|revenue model|monetiz`,
    ),
  },
  {
    key: "differentiation",
    label: "названо отличие от конкурентов",
    labelEn: "difference from competitors named",
    points: 14,
    re: cue(
      `в отличие|конкурент|аналог|сейчас это делают|альтернатив` +
      `|unlike|competitor|alternative|today (?:people|teams|companies) use|vs\\.?\\s`,
    ),
  },
];

/**
 * Buzzwords are only a problem when they stand alone. "Уникальная технология,
 * 40% конверсия" is a claim with a number behind it; "уникальная революционная
 * платформа" is a claim about nothing.
 */
const BUZZWORDS = new RegExp(
  `${LEFT_EDGE}(?:революционн|уникальн|не имеет аналогов|не имеющая аналогов|прорывн|инновационн` +
  `|лучш(?:ий|ая|ее|им) в мире|изменит индустрию` +
  `|disrupt(?:ive|ing)?|revolutionary|game[- ]chang|world[- ]class|cutting[- ]edge|next[- ]gen)`,
  "giu",
);

/**
 * A pitch that ticks every box is a good pitch, not a proven business — so the
 * ceiling is 88, not 100. The first calibration run handed 100/100 to a solid
 * but entirely unvalidated paragraph, which reads as the exchange endorsing it.
 */
const CLARITY_CEILING = 88;

/**
 * The part of a description that actually explains something.
 *
 * Measured on real listings against a deliberately stuffed one: an honest pitch
 * runs 9–12 words per sentence, while "Подписка, комиссия, тариф, цена." is a
 * keyword list wearing a full stop. Before this, stuffing every cue word into
 * one comma-separated line scored 88/100 on clarity and 71 overall — the
 * exchange would have ranked spam above a real pitch, and a founder would have
 * found that out before we did.
 *
 * A sentence is dropped when it is too short to say anything, or when it is
 * mostly commas — one word per comma is a list, not a sentence.
 */
function explanatorySentences(text: string): string {
  return text
    .split(/[.!?\n]+/)
    .map((raw) => raw.trim())
    .filter((sentence) => {
      const words = sentence.split(/[\s,;:()—–-]+/).filter(Boolean);
      if (words.length < 4) return false;
      const commas = (sentence.match(/,/g) ?? []).length;
      if (commas >= 3 && words.length / commas <= 2) return false;
      return true;
    })
    .join(". ");
}

function scoreClarity(listing: ListingInput, signals: PlanSignals, lang: AssessLang): AssessmentFactor {
  const en = lang === "en";
  const full = listing.description;
  // Cues are looked for only where an explanation could live; the buzzword
  // penalty still reads the whole text, because loud words count wherever
  // they are.
  const text = explanatorySentences(full);
  const hits: string[] = [];
  const misses: string[] = [];
  let s = 12; // a readable paragraph that says nothing still beats an empty one

  for (const cue of CLARITY_CUES) {
    if (cue.re.test(text)) {
      s += cue.points;
      hits.push(en ? cue.labelEn : cue.label);
    } else {
      misses.push(en ? cue.labelEn : cue.label);
    }
  }

  // Concrete numbers anywhere in the pitch — the cheapest proxy for specificity.
  if (signals.fieldsFound >= 3) s += 8;
  else if (signals.fieldsFound >= 1) s += 4;

  const buzz = (full.match(BUZZWORDS) ?? []).length;
  const unbackedBuzz = signals.fieldsFound === 0 ? buzz : Math.max(0, buzz - signals.fieldsFound);
  const penalty = Math.min(18, unbackedBuzz * 6);
  s -= penalty;

  // Very short descriptions cannot carry five ideas, however many cues match.
  // Measured on the explanatory part, so padding with keyword lists does not
  // buy length either.
  const spec = TIER_SPECS[listing.tier];
  if (text.length < spec.minDescription * 1.5) s = Math.min(s, 64);
  s = Math.min(s, CLARITY_CEILING);

  const parts: string[] = [];
  if (hits.length) parts.push(`${en ? "present" : "есть"}: ${hits.join(", ")}`);
  if (misses.length) parts.push(`${en ? "missing" : "нет"}: ${misses.join(", ")}`);
  if (penalty > 0) parts.push(en ? `−${penalty} for loud words without numbers (${unbackedBuzz})` : `−${penalty} за громкие слова без цифр (${unbackedBuzz})`);

  return {
    key: "clarity",
    label: en ? "Listing clarity" : "Ясность заявки",
    weight: WEIGHTS[listing.tier].clarity,
    score: clamp(s),
    rationale: en
      ? `${parts.join("; ")}. This scores the text of the listing, not the quality of the business: ` +
        `a weak idea that is clearly written up will score high here.`
      : `${parts.join("; ")}. Это оценка текста заявки, а не качества бизнеса: ` +
        `понятно изложенная слабая идея наберёт здесь много баллов.`,
    basis: "text-only",
  };
}

// ── 2. Market: sector prior, identical for everyone in the sector ────────────

const SECTOR_ORIGIN_NOTE_EN: Record<"declared" | "detected" | "fallback", string> = {
  declared: "Sector chosen by you.",
  detected: "Sector detected from the description",
  fallback:
    "The sector could not be detected from the description, so generic figures were used — they are not about your market. " +
    "Pick a sector in the form and this score will become meaningful.",
};

const SECTOR_ORIGIN_NOTE: Record<"declared" | "detected" | "fallback", string> = {
  declared: "Отрасль указана вами.",
  detected: "Отрасль определена по описанию",
  fallback:
    "Отрасль по описанию определить не удалось, поэтому взяты общие цифры — они не про ваш рынок. " +
    "Выберите отрасль в форме, и этот балл станет осмысленным.",
};

function scoreMarket(listing: ListingInput, detection: SectorDetection, lang: AssessLang): AssessmentFactor {
  const en = lang === "en";
  const notes = en ? SECTOR_ORIGIN_NOTE_EN : SECTOR_ORIGIN_NOTE;
  const sector = detection.sector;
  // TAM on a log scale: $1bn → 40, $10bn → 60, $100bn → 80, $1000bn → 100.
  const tamScore = clamp(40 + 20 * Math.log10(Math.max(0.1, sector.tamUsdBn)));
  const growthScore = clamp(30 + sector.cagr * 250); // 12% CAGR → 60, 28% → 100
  const crowding = clamp(100 - sector.competitiveIntensity * 100);
  const s = tamScore * 0.4 + growthScore * 0.35 + crowding * 0.25;

  const origin =
    detection.origin === "detected" && detection.evidence.length
      ? `${notes.detected} (${detection.evidence.join(", ")}).`
      : notes[detection.origin];

  return {
    key: "market",
    label: en ? "Market" : "Рынок",
    weight: WEIGHTS[listing.tier].market,
    score: clamp(s),
    rationale: en
      ? `${sector.label}: addressable market ~$${sector.tamUsdBn}bn, growth ${(sector.cagr * 100).toFixed(0)}%/yr, ` +
        `competitiveness ${(sector.competitiveIntensity * 10).toFixed(1)}/10. ` +
        `This is sector data — every project in this sector gets the same score here. ${origin}`
      : `${sector.label}: адресуемый рынок ~$${sector.tamUsdBn}млрд, рост ${(sector.cagr * 100).toFixed(0)}%/год, ` +
      `конкурентность ${(sector.competitiveIntensity * 10).toFixed(1)}/10. ` +
      `Это данные по отрасли — у всех проектов этой отрасли здесь одинаковый балл. ${origin}`,
    basis: "sector-prior",
  };
}

// ── 3. Moat: how much of the sector's defensibility this listing has earned ──

const MOAT_CEILING: Record<string, number> = {
  "network-effects": 90,
  "regulatory-license": 82,
  "ip-patents": 80,
  "data-scale": 78,
  "switching-costs": 74,
  "economies-of-scale": 68,
  "brand": 62,
  "none": 35,
};

/** An unbuilt idea owns none of its category's future moat. */
const MOAT_REALIZATION: Record<Tier, number> = { idea: 0.22, mvp: 0.42, product: 0.62 };

function scoreMoat(listing: ListingInput, sector: SectorProfile, signals: PlanSignals, lang: AssessLang): AssessmentFactor {
  const en = lang === "en";
  const ceiling = MOAT_CEILING[sector.primaryMoat] ?? 50;
  let realization = MOAT_REALIZATION[listing.tier];
  const notes: string[] = [];

  if (signals.mentionsPatent) {
    realization = Math.min(1, realization + 0.08);
    notes.push(en ? "patents / proprietary IP claimed" : "заявлены патенты/собственная IP");
  }
  if (signals.customers !== null && signals.customers > 0) {
    realization = Math.min(1, realization + 0.08);
    notes.push(en ? "has paying customers" : "есть платящие клиенты");
  }
  if (listing.tier !== "idea" && !listing.demoUrl && !listing.repoUrl) {
    realization = Math.max(0, realization - 0.1);
    notes.push(en ? "no verifiable link to the product" : "нет проверяемой ссылки на продукт");
  }

  // Blend the archetype ceiling toward the "nothing demonstrated" floor by how
  // much of it this listing has plausibly earned.
  const floor = MOAT_CEILING.none;
  const s = floor + (ceiling - floor) * realization;

  return {
    key: "moat",
    label: en ? "Defensibility" : "Защитимость",
    weight: WEIGHTS[listing.tier].moat,
    score: clamp(s),
    rationale: en
      ? `In this sector defensibility is built on «${sector.primaryMoat}» (ceiling ${ceiling}/100). ` +
        `At the «${tierLabel(listing.tier, lang)}» level ~${Math.round(realization * 100)}% of that ceiling is realized` +
        (notes.length ? `: ${notes.join(", ")}.` : ".") +
        ` The category offers a chance of defensibility, not defensibility itself.`
      : `В этой отрасли защита строится на «${sector.primaryMoat}» (потолок ${ceiling}/100). ` +
      `На уровне «${TIER_SPECS[listing.tier].label}» реализовано ~${Math.round(realization * 100)}% этого потолка` +
      (notes.length ? `: ${notes.join(", ")}.` : ".") +
      ` Категория даёт возможность защиты, а не саму защиту.`,
    // Without a company fact to move it, this number is the sector's, not the
    // company's — and calling it company evidence would inflate the share of the
    // score that looks like it came from disclosed facts.
    basis: notes.length > 0 ? "company-evidence" : "sector-prior",
  };
}

// ── 4. Evidence: what the founder actually disclosed ─────────────────────────

function scoreEvidence(listing: ListingInput, signals: PlanSignals, lang: AssessLang): AssessmentFactor {
  const en = lang === "en";
  const tier = listing.tier;
  const revenue = annualRevenueUsd(listing.metrics, signals);
  const users = listing.metrics?.users ?? signals.customers ?? null;
  const notes: string[] = [];
  let s: number;

  if (tier === "idea") {
    // Nothing is expected to exist yet. Scoring an idea low for having no
    // traction would just re-punish it for being an idea — it is already
    // priced into the tier. What earns points here is preparation.
    s = 45;
    if (listing.metrics?.monthsInDevelopment && listing.metrics.monthsInDevelopment > 0) {
      s += 8; notes.push(en ? "time has already been spent on development" : "уже потрачено время на проработку");
    }
    if ((listing.metrics?.teamSize ?? 0) >= 2) { s += 10; notes.push(en ? "team of more than one person" : "команда больше одного человека"); }
    if (listing.demoUrl) { s += 12; notes.push(en ? "has a link (landing page / mockup)" : "есть ссылка (лендинг/макет)"); }
    if (signals.fieldsFound >= 2) { s += 10; notes.push(en ? "the listing contains concrete numbers" : "в заявке есть конкретные цифры"); }
    if (notes.length === 0) notes.push(en ? "no evidence yet — normal for the idea-only level" : "подтверждений пока нет — это нормально для уровня «только идея»");
  } else {
    s = 30;
    if (revenue !== null && revenue > 0) {
      // $1k/yr → ~46, $10k → ~58, $100k → ~70, $1M → ~82
      s = 34 + 12 * Math.log10(Math.max(1, revenue) / 1_000);
      notes.push(en ? `annual revenue ~$${fmt(revenue)}` : `годовая выручка ~$${fmt(revenue)}`);
    } else if (signals.mentionsRevenueNoNumber) {
      s = 34;
      notes.push(en ? "revenue is mentioned but no figure given" : "выручка упомянута, но цифра не названа");
    } else {
      notes.push(en ? "revenue not disclosed" : "выручка не раскрыта");
    }
    if (users !== null && users > 0) {
      s += Math.min(12, 3 * Math.log10(Math.max(1, users)));
      notes.push(en ? `users ~${fmt(users)}` : `пользователей ~${fmt(users)}`);
    }
    if (listing.metrics?.growthMomPct !== undefined) {
      const g = listing.metrics.growthMomPct;
      s += g >= 15 ? 10 : g >= 5 ? 6 : g > 0 ? 2 : -6;
      notes.push(en ? `growth ${g}%/mo` : `рост ${g}%/мес`);
    }
    if (listing.metrics?.churnMonthlyPct !== undefined) {
      const c = listing.metrics.churnMonthlyPct;
      s += c <= 3 ? 8 : c <= 7 ? 2 : -10;
      notes.push(en ? `churn ${c}%/mo` : `отток ${c}%/мес`);
    }
    if (listing.demoUrl) { s += 5; notes.push(en ? "demo available" : "демо доступно"); }
    if (listing.repoUrl) { s += 3; notes.push(en ? "code available" : "код доступен"); }
  }

  // `listing.metrics` is always an object after normalization — every field can
  // still be undefined. Testing the object for truthiness marked a listing that
  // disclosed nothing as "backed by company evidence", which is the one claim
  // this factor exists to make honestly.
  const disclosedMetric = Object.values(listing.metrics ?? {}).some((v) => v !== undefined);
  const hasCompanyFacts = signals.fieldsFound > 0 || disclosedMetric || Boolean(listing.demoUrl);

  return {
    key: "evidence",
    label: en ? "Evidence" : "Доказательства",
    weight: WEIGHTS[tier].evidence,
    score: clamp(s),
    rationale: en
      ? `${notes.join("; ")}. The figures are the founder's own and were not verified by the exchange.`
      : `${notes.join("; ")}. Цифры взяты со слов основателя и не проверялись биржей.`,
    basis: hasCompanyFacts ? "company-evidence" : "text-only",
  };
}

// ── 5. Deal: are the asking terms inside the market's range ──────────────────

function scoreDeal(listing: ListingInput, implied: ImpliedTerms, checks: RedFlag[], lang: AssessLang): AssessmentFactor {
  const en = lang === "en";
  let s = 70;
  const notes: string[] = [];

  const r = implied.ratioToBandHigh;
  if (r === null) {
    s = 50;
    notes.push(en ? "the deal terms do not allow a valuation to be computed" : "условия сделки не позволяют посчитать оценку");
  } else if (r <= 1) {
    s = 88;
    notes.push(en ? `the ask is inside the market range (${Math.round(r * 100)}% of the upper bound)` : `запрос внутри рыночного диапазона (${Math.round(r * 100)}% от верхней границы)`);
  } else if (r <= 2) {
    s = 62;
    notes.push(en ? `the ask is ${r.toFixed(1)}× above the market's upper bound` : `запрос выше верхней границы рынка в ${r.toFixed(1)}×`);
  } else if (r <= 4) {
    s = 38;
    notes.push(en ? `the ask is ${r.toFixed(1)}× above the market's upper bound` : `запрос выше верхней границы рынка в ${r.toFixed(1)}×`);
  } else {
    s = 18;
    notes.push(en ? `the ask is ${r.toFixed(1)}× above the market's upper bound — negotiations will most likely not start` : `запрос выше верхней границы рынка в ${r.toFixed(1)}× — переговоры, скорее всего, не начнутся`);
  }

  // Structural problems with the terms cost points regardless of the price.
  const high = checks.filter((c) => c.severity === "high").length;
  const medium = checks.filter((c) => c.severity === "medium").length;
  s -= high * 15 + medium * 6;
  if (high || medium) notes.push(en ? `issues with the terms: ${high} serious, ${medium} medium` : `замечаний к условиям: ${high} серьёзных, ${medium} средних`);

  return {
    key: "deal",
    label: en ? "Deal terms" : "Условия сделки",
    weight: WEIGHTS[listing.tier].deal,
    score: clamp(s),
    rationale: en
      ? `${notes.join("; ")}. A comparison with the market range, not an evaluation of the project.`
      : `${notes.join("; ")}. Сравнение с рыночным диапазоном, а не оценка проекта.`,
    // With no terms stated there is nothing of the company's in this number.
    basis: r === null ? "text-only" : "company-evidence",
  };
}

// ── Deal checks (structural, not price) ──────────────────────────────────────

// Same Unicode-boundary trap as the clarity cues: written with \b this would
// never fire on a Russian promise of guaranteed returns — the one flag that
// exists for legal reasons rather than for investor convenience.
const PROMISSORY = new RegExp(
  `${LEFT_EDGE}(?:гарантиру[ею]\\p{L}*\\s+(?:доход|прибыл|возврат|окупаем)` +
  `|гарантированн\\p{L}*\\s+(?:доход|прибыл|возврат)` +
  `|guaranteed\\s+(?:returns?|profits?|roi))`,
  "iu",
);

function dealChecks(listing: ListingInput, implied: ImpliedTerms, revenue: number | null, lang: AssessLang): RedFlag[] {
  const en = lang === "en";
  const flags: RedFlag[] = [];
  const { deal, tier } = listing;

  if (PROMISSORY.test(listing.description) || PROMISSORY.test(deal.notes ?? "")) {
    flags.push({
      severity: "high",
      message: en
        ? "The listing promises guaranteed returns. That is not allowed: it is both untrue and, in most jurisdictions, a sign of an illegal investment offer."
        : "В заявке есть обещание гарантированного дохода. Так нельзя: это и неправда, и в большинстве юрисдикций признак незаконного предложения инвестиций.",
    });
  }

  const equity = deal.intent === "raise" ? deal.equityOfferedPct : deal.stakeForSalePct;
  if (equity !== undefined && tier !== "product") {
    if (equity >= 50) {
      flags.push({
        severity: "high",
        message: en
          ? `${equity}% is offered — control passes to the investor at the earliest stage. A next round after that is almost impossible: the founder is left without a stake worth working five years for.`
          : `Отдаётся ${equity}% — контроль уходит инвестору на самом раннем этапе. Следующий раунд после такого почти невозможен: у основателя не останется доли, ради которой он будет работать пять лет.`,
      });
    } else if (equity >= 30) {
      flags.push({
        severity: "medium",
        message: en
          ? `${equity}% for the first cheque is above the market norm (usually 10–20% per round). After two such rounds the founder holds less than half.`
          : `${equity}% за первый чек — выше рыночной нормы (обычно 10–20% за раунд). После двух таких раундов у основателя остаётся меньше половины.`,
      });
    }
  }

  if (tier === "idea" && deal.askUsd !== undefined && deal.askUsd > 250_000) {
    flags.push({
      severity: "medium",
      message: en
        ? `An ask of $${fmt(deal.askUsd)} at the idea stage. Cheques like that go to teams with a track record, not to a description — either show yours or split the ask into stages.`
        : `Запрос $${fmt(deal.askUsd)} на стадии идеи. Такие чеки дают под команду с историей, а не под описание — либо покажите её, либо разбейте запрос на этапы.`,
    });
  }

  if (tier === "idea" && deal.buildBy === "investor") {
    flags.push({
      severity: "info",
      message: en
        ? "The investor takes on the development. Then state explicitly what the founder contributes — otherwise it is unclear what the stake is for."
        : "Разработку берёт на себя инвестор. Тогда стоит явно указать, что вносит основатель — иначе непонятно, за что доля.",
    });
  }

  if (tier === "idea" && revenue !== null && revenue > 0) {
    // "Ничего не построено" и выручка — взаимоисключающие утверждения. Обычно
    // это неверно выбранный уровень (и тогда вся рубрика считает не то, потому
    // что веса на уровне идеи почти не смотрят на доказательства), реже —
    // цифра не про этот проект. Молчать здесь нельзя: балл выйдет осмысленным
    // на вид и бессмысленным по сути.
    flags.push({
      severity: "medium",
      message: en
        ? `The level is "idea only", but revenue of $${fmt(revenue)} is declared. If the product already earns, ` +
          `choose "idea + MVP" or "finished product" — at the idea level the analysis barely looks at numbers, ` +
          `and your revenue is wasted.`
        : `Уровень «только идея», но заявлена выручка $${fmt(revenue)}. Если продукт уже зарабатывает, ` +
        `выберите «идея + MVP» или «готовый продукт» — на уровне идеи разбор почти не учитывает цифры, ` +
        `и ваша выручка пропадает зря.`,
    });
  }

  if (tier === "product" && revenue === null) {
    flags.push({
      severity: "medium",
      message: en
        ? "The product is declared as working, but revenue is not disclosed. A buyer cannot check the main thing — the valuation uses the MVP range."
        : "Продукт заявлен как рабочий, но выручка не раскрыта. Покупатель не может проверить главное — оценка считается по диапазону MVP.",
    });
  }

  if (tier === "product" && revenue !== null && revenue > 0 && implied.postMoneyUsd !== null) {
    const mult = implied.postMoneyUsd / revenue;
    if (mult > 6) {
      flags.push({
        severity: "high",
        message: en
          ? `The price is ${mult.toFixed(1)}× annual revenue. In 2026 products under $1M ARR close around 2.5–4× — above 6× deals almost never happen.`
          : `Цена = ${mult.toFixed(1)}× годовой выручки. В 2026 продукты до $1M ARR закрываются в районе 2.5–4× — выше 6× сделки почти не происходят.`,
      });
    } else if (mult < 0.5) {
      // The opposite inconsistency, and the more informative one: nobody sells a
      // working product for half a year of its own revenue unless something is
      // wrong with the revenue or with the product. Silence here would let an
      // inflated revenue figure sail through as a bargain.
      flags.push({
        severity: "medium",
        message: en
          ? `The price ${fmt(implied.postMoneyUsd)} is less than half of the declared annual revenue ($${fmt(revenue)}). ` +
            `It happens (urgent sale, dependence on one customer, heavy support), but the buyer's first thought will be that the revenue figure is inflated. ` +
            `Explain the reason in the description — otherwise the buyer will do it for you.`
          : `Цена ${fmt(implied.postMoneyUsd)} — меньше половины заявленной годовой выручки ($${fmt(revenue)}). ` +
          `Так бывает (срочная продажа, зависимость от одного клиента, тяжёлая поддержка), но покупатель ` +
          `первым делом решит, что цифра выручки завышена. Объясните причину в описании — иначе это сделает он.`,
      });
    }
  }

  if (listing.metrics?.churnMonthlyPct !== undefined && listing.metrics.churnMonthlyPct > 10) {
    flags.push({
      severity: "medium",
      message: en
        ? `Churn of ${listing.metrics.churnMonthlyPct}%/mo — the base turns over completely within a year. A buyer will pay for the flow, not for the base.`
        : `Отток ${listing.metrics.churnMonthlyPct}%/мес — за год база обновляется полностью. Покупатель заплатит за поток, а не за базу.`,
    });
  }

  return flags;
}

// ── Blind spots — always shown, never optional ───────────────────────────────

function blindSpots(tier: Tier, lang: AssessLang): string[] {
  if (lang === "en") {
    const commonEn = [
      "Team: who is doing this and whether they have ever finished anything — the analysis cannot see this.",
      "Legal: who owns the rights to the code and brand, how the shares are structured, whether there are encumbrances.",
      "Accuracy of figures: everything the founder stated is taken on trust and was not verified.",
      "Live competitors and their prices right now — only sector statistics are taken into account.",
    ];
    if (tier === "idea") {
      return [...commonEn, "Whether someone has already built this — at the idea stage no patent or prior-art search was done."];
    }
    return [...commonEn, "Code quality, tech debt and security — the repository was not read."];
  }
  const common = [
    "Команда: кто это делает и доводил ли раньше что-нибудь до конца — анализ этого не видит.",
    "Юридическая часть: кому принадлежат права на код и бренд, как оформлены доли, есть ли обременения.",
    "Достоверность цифр: всё, что указал основатель, принято на веру и не проверялось.",
    "Живые конкуренты и их цены прямо сейчас — учтена только отраслевая статистика.",
  ];
  if (tier === "idea") {
    return [...common, "Сделал ли кто-то это уже — на стадии идеи проверка патентов и аналогов не проводилась."];
  }
  return [...common, "Качество кода, техдолг и безопасность — репозиторий не читался."];
}

// ── Assembly ─────────────────────────────────────────────────────────────────

function clamp(n: number, lo = 0, hi = 100): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

const BAND_WORDING: Record<Tier, Record<"strong" | "mixed" | "weak", string>> = {
  idea: {
    strong: "Заявка проработана: понятно, кому, зачем и на чём зарабатывать. На этом уровне это максимум, что можно показать до постройки.",
    mixed: "Идея читается, но части картины не хватает — инвестор задаст те же вопросы, что и этот разбор.",
    weak: "По заявке пока нельзя понять, во что вкладываться. Доработайте описание — это бесплатно и меняет всё.",
  },
  mvp: {
    strong: "Есть что показать и внятные условия — разговор с инвестором начнётся с продукта, а не с объяснений.",
    mixed: "Прототип есть, но доказательств спроса мало. Ближайший шаг — цифры, а не новые функции.",
    weak: "Прототип не подкреплён ни спросом, ни внятными условиями сделки.",
  },
  product: {
    strong: "Рабочий продукт с раскрытыми цифрами и ценой в рынке — готов к переговорам о покупке.",
    mixed: "Продукт работает, но цена или цифры вызовут спор. Уточните их до первого разговора.",
    weak: "Как объект покупки заявка не готова: не хватает проверяемых цифр или цена далеко от рынка.",
  },
};

const BAND_WORDING_EN: Record<Tier, Record<"strong" | "mixed" | "weak", string>> = {
  idea: {
    strong: "The listing is well developed: it is clear for whom, why and how it makes money. At this level that is the most that can be shown before building.",
    mixed: "The idea reads, but part of the picture is missing — an investor will ask the same questions as this analysis.",
    weak: "From the listing it is not yet possible to understand what to invest in. Improve the description — it is free and changes everything.",
  },
  mvp: {
    strong: "There is something to show and clear terms — the conversation with an investor will start from the product, not from explanations.",
    mixed: "There is a prototype, but little proof of demand. The next step is numbers, not new features.",
    weak: "The prototype is backed by neither demand nor clear deal terms.",
  },
  product: {
    strong: "A working product with disclosed figures and a market-level price — ready for purchase negotiations.",
    mixed: "The product works, but the price or the figures will cause an argument. Clarify them before the first conversation.",
    weak: "As an object of purchase the listing is not ready: verifiable figures are missing or the price is far from the market.",
  },
};

export function assessListing(listing: ListingInput, lang: AssessLang = "ru"): Assessment {
  const en = lang === "en";
  const signals = listingSignals(listing);
  const detection = listingSectorDetection(listing);
  const sector = detection.sector;
  const revenue = annualRevenueUsd(listing.metrics, signals);

  const clarity = scoreClarity(listing, signals, lang);
  const market = scoreMarket(listing, detection, lang);
  const moat = scoreMoat(listing, sector, signals, lang);
  const evidence = scoreEvidence(listing, signals, lang);

  // The deal band needs a score, and the deal factor needs the band. Break the
  // cycle with the four project factors re-weighted to sum to 1 — the deal
  // terms cannot influence the band they are being compared against.
  const projectOnly = [clarity, market, moat, evidence];
  const projectWeight = projectOnly.reduce((a, f) => a + f.weight, 0);
  const projectScore = clamp(projectOnly.reduce((a, f) => a + f.score * f.weight, 0) / projectWeight);

  const band = valuationBand({ tier: listing.tier, score: projectScore, annualRevenueUsd: revenue, metrics: listing.metrics, lang });
  const implied = impliedTerms(listing.deal, band, lang);
  const checks = dealChecks(listing, implied, revenue, lang);
  const deal = scoreDeal(listing, implied, checks, lang);

  // The price gap is already inside the deal factor's score, so it is appended
  // after scoring rather than passed into it — otherwise an over-ask would be
  // charged twice, once as a low factor and once as a flag penalty. It still
  // belongs in the flag list: that list is what the UI shows as "what stands in
  // the way of a deal", and price is usually the answer.
  const priceFlags: RedFlag[] = [];
  const ratio = implied.ratioToBandHigh;
  if (ratio !== null && ratio > 2) {
    priceFlags.push({
      severity: ratio > 4 ? "high" : "medium",
      message: en
        ? `The requested valuation of $${fmt(implied.postMoneyUsd ?? 0)} is ${ratio.toFixed(1)}× above the upper bound of ` +
          `the market range ($${fmt(band.low)}–$${fmt(band.high)}). An investor will start the conversation with this, if they start it.`
        : `Запрошенная оценка $${fmt(implied.postMoneyUsd ?? 0)} — в ${ratio.toFixed(1)}× выше верхней границы ` +
        `рыночного диапазона ($${fmt(band.low)}–$${fmt(band.high)}). Инвестор начнёт разговор с этого, если начнёт.`,
    });
  }
  const allFlags = [...checks, ...priceFlags];

  const factors = [clarity, market, moat, evidence, deal];
  const score = clamp(factors.reduce((a, f) => a + f.score * f.weight, 0));
  const bandKey = score >= 70 ? "strong" : score >= 45 ? "mixed" : "weak";

  // How much of the composite rests on numbers rather than on prose and priors.
  const evidenceCoverage =
    Math.round(
      (factors
        .filter((f) => f.basis === "company-evidence")
        .reduce((a, f) => a + f.weight, 0)) * 100,
    ) / 100;

  return {
    version: ASSESSMENT_VERSION,
    tier: listing.tier,
    score,
    band: bandKey,
    headline: (en ? BAND_WORDING_EN : BAND_WORDING)[listing.tier][bandKey],
    factors,
    redFlags: allFlags,
    blindSpots: blindSpots(listing.tier, lang),
    deal: {
      band,
      implied,
      ticket: suggestedTicketUsd(listing.tier, listing.deal, TIER_SPECS[listing.tier].ticketUsd, lang),
    },
    sector: {
      id: sector.id,
      label: sector.label,
      tamUsdBn: sector.tamUsdBn,
      cagr: sector.cagr,
      origin: detection.origin,
    },
    sources: marketSourcesFor(lang),
    evidenceCoverage,
    disclaimer: disclaimerFor(lang),
    generatedAt: new Date().toISOString(),
  };
}
