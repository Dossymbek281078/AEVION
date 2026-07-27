/**
 * QVenture — Pitch-deck extraction
 * ────────────────────────────────
 * Turns an uploaded pitch-deck PDF into the structured fields the analyzer
 * takes (name, sector, stage, description, traction, ask). Extracts raw text
 * with pdf-parse, then structures it with the configured LLM (live on prod),
 * degrading to a deterministic heuristic when no provider is configured or the
 * model call fails — so the feature works offline / with no AI key.
 */

import { callProvider, pickConfiguredProvider, getProviders, type ChatMessage } from "../../services/qcoreai/providers";
import { listSectors } from "./sectors";
import { STAGES } from "./engine";
import { parsePlanSignals, metricStatedAsIntention, figureAppearsInText, type ChurnPeriod } from "./signals";
import { asRatePeriod, asGrowthPeriod } from "../metrics/periods";
import { detectCurrencyFirst, toUsd, UNITS_PER_USD, type MoneyCurrency } from "../metrics/currency";

export interface DeckFinancials {
  arrUsd: number | null;
  grossMarginPct: number | null;
  ltvCacRatio: number | null;
  churnPct: number | null;
  /** Period the churn figure is quoted over — 4% annual and 4% monthly are different companies. */
  churnPeriod: ChurnPeriod | null;
  customers: number | null;
  growthPct: number | null;
  /** Period the growth figure is quoted over — 9% MoM and 9% YoY are different companies. */
  growthPeriod: GrowthPeriod | null;
  bottomUpTamUsd: number | null;
}

type GrowthPeriod = "MoM" | "YoY" | "WoW" | "unspecified";

// Accept a period only if the model returned one of the allowed labels — never
// coerce. "unspecified" is dropped so the deterministic parse can still supply one.
const churnPeriodOf = (v: unknown): ChurnPeriod | null => {
  const p = asRatePeriod(v);
  return p && p !== "unspecified" ? p : null;
};
/** Accept an ISO currency code only if we hold a rate for it. */
function asMoneyCurrency(v: unknown): MoneyCurrency | null {
  return typeof v === "string" && v.toUpperCase() in UNITS_PER_USD ? (v.toUpperCase() as MoneyCurrency) : null;
}
const growthPeriodOf = (v: unknown): GrowthPeriod | null => {
  const p = asGrowthPeriod(v);
  return p && p !== "unspecified" ? p : null;
};

export interface DeckProjectionPoint {
  year: number;
  revenueUsd: number;
}

export interface DeckFields {
  name: string;
  sector: string;
  stage: string;
  geography: string;
  askUsd: number | null;
  description: string;
  tractionNotes: string;
  /** Exact financials pulled from the deck → pre-fill the structured form fields. */
  financials: DeckFinancials;
  /** Multi-year revenue projection pulled from the deck (may be empty). */
  projections: DeckProjectionPoint[];
  aiUsed: boolean;
  textChars: number;
}

const EMPTY_FIN: DeckFinancials = {
  arrUsd: null, grossMarginPct: null, ltvCacRatio: null, churnPct: null, churnPeriod: null,
  customers: null, growthPct: null, growthPeriod: null, bottomUpTamUsd: null,
};

/** Deterministic financials from the deck text via the shared signal parser. */
function parsedFinancials(text: string): DeckFinancials {
  const s = parsePlanSignals(text);
  return {
    arrUsd: s.revenueUsd, grossMarginPct: s.grossMarginPct, ltvCacRatio: s.ltvCacRatio,
    churnPct: s.churnPct, churnPeriod: s.churnPeriod, customers: s.customers,
    growthPct: s.growthPct, growthPeriod: s.growthPeriod, bottomUpTamUsd: s.bottomUpTamUsd,
  };
}

/** Extract plain text from a PDF buffer (pdf-parse v2). */
export async function extractPdfText(buf: Buffer): Promise<string> {
  const { PDFParse } = (await import("pdf-parse")) as { PDFParse: new (o: { data: Uint8Array }) => { getText(): Promise<{ text?: string }>; destroy?(): Promise<void> } };
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const r = await parser.getText();
    return (r.text || "").replace(/\u0000/g, "").trim();
  } finally {
    try { await parser.destroy?.(); } catch { /* ignore */ }
  }
}

function heuristicFields(text: string): Omit<DeckFields, "aiUsed" | "textChars"> {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const name = (lines[0] || "").slice(0, 80) || "Untitled";
  const metricLines = lines
    .filter((l) => /\$|%|\bARR\b|\bMRR\b|MoM|YoY|LTV|CAC|retention|churn|\busers?\b|\bcustomers?\b|pilots?/i.test(l))
    .slice(0, 6);
  const lower = text.toLowerCase();
  let sector = "other";
  for (const s of listSectors()) {
    const first = s.label.toLowerCase().split(/[\s/]+/)[0];
    if (lower.includes(s.id.replace(/_/g, " ")) || (first.length > 3 && lower.includes(first))) { sector = s.id; break; }
  }
  return {
    name,
    sector,
    stage: "seed",
    geography: "US",
    askUsd: null,
    description: text.replace(/\s+/g, " ").slice(0, 1400),
    tractionNotes: metricLines.join(" | "),
    financials: parsedFinancials(text),
    projections: [],
  };
}

/** Structure deck text into analyzer fields (LLM when available, else heuristic). */
export async function extractDeckFields(text: string): Promise<DeckFields> {
  const clean = text.slice(0, 12000);
  const heur = heuristicFields(clean);
  const provider = pickConfiguredProvider(process.env.QVENTURE_PROVIDER);

  if (provider === "stub" || !clean) {
    return { ...heur, aiUsed: false, textChars: text.length };
  }

  try {
    const sectorIds = listSectors().map((s) => s.id).join(", ");
    const messages: ChatMessage[] = [
      { role: "system", content: "You extract structured fields from a startup pitch deck. Return ONLY compact minified JSON, no prose, no code fences." },
      {
        role: "user",
        content:
          `Extract JSON with keys: name (company/product), sector (one of: ${sectorIds}), ` +
          `stage (one of: ${STAGES.join(", ")}), geography (country/region, default "US"), ` +
          `askUsd (number the company is raising, or null), description (2-4 sentence plain-English summary of what it does and its wedge), ` +
          `tractionNotes (revenue/growth/retention/pilot metrics as a single string, or ""), ` +
          `financials (object with numeric-or-null keys: arrUsd, grossMarginPct, ltvCacRatio, churnPct, customers, growthPct, bottomUpTamUsd — only what the deck states, else null; ` +
          `plus churnPeriod ("monthly"|"quarterly"|"annual"|"weekly"|null — exactly as the deck quotes churn, never guessed) ` +
          `and growthPeriod ("MoM"|"YoY"|"WoW"|null — exactly as the deck quotes growth, never guessed)), ` +
          `projections (array of {year:number, revenueUsd:number} from any revenue forecast table, else []). ` +
          `currency (ISO code the deck quotes money in — "USD", "EUR", "GBP", "KZT", … — or null if it never marks one; do NOT convert, report the currency as written), ` +
          `Use plain numbers (e.g. 3000000 not "$3M"). Pick the closest sector; if unclear use "other".\n\nPITCH DECK TEXT:\n${clean}`,
      },
    ];
    const model = getProviders().find((p) => p.id === provider)?.defaultModel || "claude-opus-4-8";
    const { reply } = await callProvider(provider, messages, model, 0.2);

    const start = reply.indexOf("{");
    const end = reply.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("no json");
    const parsed = JSON.parse(reply.slice(start, end + 1)) as Record<string, unknown>;

    const str = (v: unknown, fb: string): string => (typeof v === "string" && v.trim() ? v.trim() : fb);
    const num = (v: unknown): number | null => (typeof v === "number" && isFinite(v) && v > 0 ? v : null);
    const sector = listSectors().some((s) => s.id === parsed.sector) ? String(parsed.sector) : heur.sector;
    const stage = (STAGES as readonly string[]).includes(String(parsed.stage)) ? String(parsed.stage) : "seed";
    const askRaw = num(parsed.askUsd);

    // Structured financials: LLM value when present, else the deterministic parse (never invent).
    const rawFin = (parsed.financials && typeof parsed.financials === "object" ? parsed.financials : {}) as Record<string, unknown>;
    const financials: DeckFinancials = {
      arrUsd: num(rawFin.arrUsd) ?? heur.financials.arrUsd,
      grossMarginPct: num(rawFin.grossMarginPct) ?? heur.financials.grossMarginPct,
      ltvCacRatio: num(rawFin.ltvCacRatio) ?? heur.financials.ltvCacRatio,
      churnPct: num(rawFin.churnPct) ?? heur.financials.churnPct,
      churnPeriod: churnPeriodOf(rawFin.churnPeriod) ?? heur.financials.churnPeriod,
      customers: num(rawFin.customers) ?? heur.financials.customers,
      growthPct: num(rawFin.growthPct) ?? heur.financials.growthPct,
      growthPeriod: growthPeriodOf(rawFin.growthPeriod) ?? heur.financials.growthPeriod,
      bottomUpTamUsd: num(rawFin.bottomUpTamUsd) ?? heur.financials.bottomUpTamUsd,
    };

    // The LLM reports figures as written and names the currency; converting is
    // ours to do, deterministically, from the checked-in rate table. Doing it in
    // the model would put an exchange rate inside a generated number — exactly
    // what the "numbers never from an LLM" contract exists to prevent.
    //
    // Only the model's own figures are converted here. The heuristic fallback
    // comes from parsePlanSignals, which already converted — running both would
    // divide by the rate twice and shrink a €3M company to €3.4M/0.88 twice over.
    const deckCurrency = asMoneyCurrency(parsed.currency) ?? detectCurrencyFirst(clean.toLowerCase());
    const money = (raw: unknown, fallback: number | null): number | null => {
      const v = num(raw);
      if (v === null) return fallback;
      return deckCurrency && deckCurrency !== "USD" ? toUsd(v, deckCurrency) : v;
    };
    financials.arrUsd = money(rawFin.arrUsd, heur.financials.arrUsd);
    financials.bottomUpTamUsd = money(rawFin.bottomUpTamUsd, heur.financials.bottomUpTamUsd);

    // A deck that says "$2-4M ARR" hands the model a choice it should not be
    // making: whichever end it picks becomes an exact figure, and the structured
    // field then overrides the deterministic parse that had read the band
    // properly. Where the parser recognised a range, its conservative reading
    // wins — the same rule the engine applies everywhere else.
    const banded = parsePlanSignals(clean);
    if (banded.parseNotes.some((n) => /^Revenue was disclosed as a range/.test(n)) && banded.revenueUsd !== null) {
      financials.arrUsd = banded.revenueUsd;
    }
    if (banded.parseNotes.some((n) => /^Bottom-up TAM was disclosed as a range/.test(n)) && banded.bottomUpTamUsd !== null) {
      financials.bottomUpTamUsd = banded.bottomUpTamUsd;
    }

    // Same rule, one step further. A model asked for "only what the deck states"
    // will read "we target $10M ARR next year" and report 10000000 — and that
    // figure enters the engine having skipped every guard the deterministic
    // reader applies, because those guards live in the parser it went around.
    //
    // So where the deck states a metric as an INTENTION and the parser
    // therefore has nothing, the model's number is dropped rather than trusted.
    // This does not touch figures the deck states as fact, which is the whole
    // reason the model is here.
    // Before the intention check, a blunter one: does the figure appear in the
    // deck at all? A model asked for "only what the deck states" can still
    // return a number the deck never contains — computed, remembered, or simply
    // wrong — and nothing downstream would know. Checked against the figure as
    // the MODEL reported it, before conversion, because a euro deck will not
    // contain the dollar equivalent we derived from it.
    const RAW_FIGURE_FIELDS: Array<[keyof DeckFinancials, unknown, number | null]> = [
      ["arrUsd", rawFin.arrUsd, heur.financials.arrUsd],
      ["grossMarginPct", rawFin.grossMarginPct, heur.financials.grossMarginPct],
      ["ltvCacRatio", rawFin.ltvCacRatio, heur.financials.ltvCacRatio],
      ["churnPct", rawFin.churnPct, heur.financials.churnPct],
      ["customers", rawFin.customers, heur.financials.customers],
      ["growthPct", rawFin.growthPct, heur.financials.growthPct],
      ["bottomUpTamUsd", rawFin.bottomUpTamUsd, heur.financials.bottomUpTamUsd],
    ];
    for (const [field, raw, fallback] of RAW_FIGURE_FIELDS) {
      if (typeof raw === "number" && isFinite(raw) && raw > 0 && !figureAppearsInText(clean, raw)) {
        (financials[field] as number | null) = fallback;
      }
    }

    const INTENTION_VETO: Array<[keyof DeckFinancials, RegExp, number | null]> = [
      ["arrUsd", /(?:arr|mrr|revenues?)/i, banded.revenueUsd],
      ["grossMarginPct", /gross\s*margins?/i, banded.grossMarginPct],
      ["churnPct", /churn/i, banded.churnPct],
      ["customers", /(?:customers|users|subscribers)/i, banded.customers],
      ["growthPct", /grow(?:th|ing)?/i, banded.growthPct],
      ["bottomUpTamUsd", /(?:tam|addressable market)/i, banded.bottomUpTamUsd],
    ];
    for (const [field, metric, parsed] of INTENTION_VETO) {
      if (parsed === null && financials[field] !== null && metricStatedAsIntention(clean, metric)) {
        (financials[field] as number | null) = null;
      }
    }
    // The ask is money too: a "€8M seed" is not an $8M seed.
    const askUsd = money(parsed.askUsd, askRaw);

    // Revenue projection table: keep only clean {year, revenueUsd} points, sorted, deduped by year.
    const projections: DeckProjectionPoint[] = Array.isArray(parsed.projections)
      ? (parsed.projections as unknown[])
          .map((p) => (p && typeof p === "object" ? (p as Record<string, unknown>) : {}))
          // Projection rows are money as well — a EUR forecast table converts too,
          // otherwise the growth check compares a EUR out-year to a USD base.
          .map((p) => ({ year: Number(p.year), revenueUsd: toUsd(Number(p.revenueUsd), deckCurrency) }))
          .filter((p) => Number.isFinite(p.year) && p.year > 1900 && p.year < 2100 && Number.isFinite(p.revenueUsd) && p.revenueUsd >= 0)
          .filter((p, i, arr) => arr.findIndex((q) => q.year === p.year) === i)
          .sort((a, b) => a.year - b.year)
          .slice(0, 6)
      : [];

    return {
      name: str(parsed.name, heur.name).slice(0, 120),
      sector,
      stage,
      geography: str(parsed.geography, "US").slice(0, 60),
      askUsd,
      description: str(parsed.description, heur.description).slice(0, 2000),
      tractionNotes: str(parsed.tractionNotes, heur.tractionNotes).slice(0, 1500),
      financials,
      projections,
      aiUsed: true,
      textChars: text.length,
    };
  } catch {
    return { ...heur, aiUsed: false, textChars: text.length };
  }
}
