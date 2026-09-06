/**
 * QVenture — Comparable funding rounds
 * ────────────────────────────────────
 * Surfaces recent comparable deals for a sector + stage so a valuation isn't
 * anchored only on the static sector table.
 *
 * Two honest modes — we never fabricate deals dressed as live data:
 *   • "live"        — a real web search (Serper) returns actual results, and the
 *                     LLM extracts {company, amount, date, url} FROM those real
 *                     snippets. Every comp carries a source URL. Requires
 *                     SERPER_API_KEY.
 *   • "illustrative"— no search key, but an LLM provider is configured: the model
 *                     recalls notable rounds from training data. Clearly labeled
 *                     "model-recalled, not live-verified", no source URLs.
 *   • "unavailable" — nothing configured.
 */

import { callProvider, pickConfiguredProvider, getProviders, type ChatMessage } from "../../services/qcoreai/providers";

export interface Comparable {
  company: string;
  amountText: string;      // e.g. "$12M", "$4.5M seed"
  amountUsd: number | null;
  round: string;           // e.g. "Seed", "Series A"
  date: string;            // e.g. "2025-03", "Q1 2025", "2024"
  url: string | null;      // source (live mode only)
}

export interface ComparablesResult {
  mode: "live" | "illustrative" | "unavailable";
  comps: Comparable[];
  disclaimer: string;
  query: string;
  /** True when served from the live-results cache rather than a fresh search. */
  cached?: boolean;
}

// ── Live-result cache ──────────────────────────────────────────────────────
// A successful *live* (Serper-backed) result is cached per sector×stage for a
// day. This (1) makes live mode consistent — an intermittent Serper timeout or
// an empty LLM extraction no longer silently downgrades a sector to illustrative
// on the next request — and (2) conserves paid Serper credits: funding-round
// data changes on the order of days, not minutes, so one live fetch per
// sector/stage/day is plenty. Only live results are cached; illustrative /
// unavailable are not, so the next call retries live.
const LIVE_TTL_MS = 24 * 60 * 60 * 1000;
// Образцовый ответ тоже кладём в кэш, но на час, а не на сутки.
// Причина: до 20.08.2026 он не кэшировался ВООБЩЕ, и каждый запрос к
// публичной ручке без входа означал отдельный платный вызов модели —
// включая повторные с тем же сектором. Замер: 6.5-11.6 с на ответ.
// Час, а не сутки, чтобы появление SERPER_API_KEY не осталось незамеченным:
// иначе живой режим был бы заперт суточным образцовым ответом.
const ILLUSTRATIVE_TTL_MS = 60 * 60 * 1000;

// Пустой ответ держим всего пять минут. Он бывает двух происхождений:
// модель ничего не вернула по бессмысленному сектору (платный вызов УЖЕ
// сделан, и повтор стоил бы ещё одного) либо провайдер отказал. Первое
// кэшировать надо, второе — нельзя надолго, иначе восстановление
// провайдера останется незамеченным. Пять минут закрывают перебор
// случайных секторов, не пряча починку.
const UNAVAILABLE_TTL_MS = 5 * 60 * 1000;

function ttlFor(mode: ComparablesResult["mode"]): number {
  if (mode === "live") return LIVE_TTL_MS;
  if (mode === "illustrative") return ILLUSTRATIVE_TTL_MS;
  return UNAVAILABLE_TTL_MS;
}
const liveCache = new Map<string, { at: number; result: ComparablesResult }>();

function cacheKey(sectorLabel: string, stage: string): string {
  return `${sectorLabel.toLowerCase()}|${stage.toLowerCase()}`;
}

function providerModel(provider: string): string {
  return getProviders().find((p) => p.id === provider)?.defaultModel || "claude-opus-4-8";
}

function parseJsonArray(reply: string): Record<string, unknown>[] {
  const start = reply.indexOf("[");
  const end = reply.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const arr = JSON.parse(reply.slice(start, end + 1));
    return Array.isArray(arr) ? (arr as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}

function toComp(o: Record<string, unknown>, allowUrl: boolean): Comparable | null {
  const company = typeof o.company === "string" ? o.company.trim() : "";
  if (!company) return null;
  const amountText = typeof o.amountText === "string" ? o.amountText.trim() : "";
  const amountUsd = typeof o.amountUsd === "number" && isFinite(o.amountUsd) && o.amountUsd > 0 ? o.amountUsd : null;
  const round = typeof o.round === "string" ? o.round.trim() : "";
  const date = typeof o.date === "string" ? o.date.trim() : "";
  const url = allowUrl && typeof o.url === "string" && /^https?:\/\//.test(o.url) ? o.url : null;
  return { company: company.slice(0, 80), amountText: amountText.slice(0, 40), amountUsd, round: round.slice(0, 24), date: date.slice(0, 16), url };
}

/** Live web search via Serper (google.serper.dev). Returns raw organic hits. */
async function serperSearch(query: string): Promise<Array<{ title: string; snippet: string; link: string; date?: string }>> {
  const key = process.env.SERPER_API_KEY?.trim();
  if (!key) return [];
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num: 10 }),
    signal: AbortSignal.timeout(13000),
  });
  if (!res.ok) return [];
  const j = (await res.json()) as { organic?: Array<{ title?: string; snippet?: string; link?: string; date?: string }> };
  return (j.organic ?? [])
    .filter((o) => o.title && o.link)
    .map((o) => ({ title: String(o.title), snippet: String(o.snippet ?? ""), link: String(o.link), date: o.date }));
}

export async function fetchComparables(sectorLabel: string, stage: string): Promise<ComparablesResult> {
  const currentYear = new Date().getFullYear();
  const query = `recent ${sectorLabel} startup ${stage} funding round ${currentYear} ${currentYear - 1}`;
  const provider = pickConfiguredProvider(process.env.QVENTURE_PROVIDER);

  // Serve a still-fresh cached live result before spending a Serper credit.
  const key = cacheKey(sectorLabel, stage);
  const hit = liveCache.get(key);
  if (hit && Date.now() - hit.at < ttlFor(hit.result.mode)) {
    return { ...hit.result, cached: true };
  }

  // ── Live mode: real search + LLM extraction from real snippets ──────────────
  try {
    const hits = await serperSearch(query);
    if (hits.length > 0 && provider !== "stub") {
      const corpus = hits.map((h, i) => `[${i + 1}] ${h.title}${h.date ? ` (${h.date})` : ""}\n${h.snippet}\nSOURCE: ${h.link}`).join("\n\n");
      const messages: ChatMessage[] = [
        { role: "system", content: "You extract real startup funding rounds from search results. Only include a deal if the snippet clearly states it. Never invent. Return ONLY a JSON array." },
        { role: "user", content:
          `From these search results about ${sectorLabel} ${stage} deals, extract up to 5 real funding rounds as a JSON array of ` +
          `{company, amountText, amountUsd (number or null), round, date, url (the SOURCE link for that deal)}. ` +
          `Skip anything not clearly a funding round. If none qualify, return [].\n\nRESULTS:\n${corpus}` },
      ];
      const { reply } = await callProvider(provider, messages, providerModel(provider), 0.1, undefined, undefined, { module: "qventure-comparables" });
      const comps = parseJsonArray(reply).map((o) => toComp(o, true)).filter((c): c is Comparable => c !== null).slice(0, 5);
      if (comps.length > 0) {
        const result: ComparablesResult = {
          mode: "live",
          comps,
          disclaimer: "Live comparable rounds extracted from recent web search — verify each via its source link before relying on it.",
          query,
        };
        liveCache.set(key, { at: Date.now(), result });
        return result;
      }
    }
  } catch {
    // fall through to illustrative
  }

  // ── Illustrative mode: LLM recall, clearly labeled ──────────────────────────
  if (provider !== "stub") {
    try {
      const messages: ChatMessage[] = [
        { role: "system", content: "You list notable startup funding rounds you are confident actually happened. Do not invent companies. Return ONLY a JSON array." },
        { role: "user", content:
          `List up to 5 notable ${sectorLabel} ${stage} funding rounds you're confident occurred, as a JSON array of ` +
          `{company, amountText, amountUsd (number or null), round, date (approx year/quarter)}. ` +
          `Only include real, well-known rounds. If unsure, include fewer.` },
      ];
      const { reply } = await callProvider(provider, messages, providerModel(provider), 0.2, undefined, undefined, { module: "qventure-benchmark" });
      const comps = parseJsonArray(reply).map((o) => toComp(o, false)).filter((c): c is Comparable => c !== null).slice(0, 5);
      if (comps.length > 0) {
        const result: ComparablesResult = {
          mode: "illustrative",
          comps,
          disclaimer: "Illustrative — recalled by the model from training data, not live-verified and possibly dated. Add SERPER_API_KEY to switch to live web search.",
          query,
        };
        liveCache.set(key, { at: Date.now(), result });
        return result;
      }
    } catch {
      // fall through
    }
  }

  const unavailable: ComparablesResult = {
    mode: "unavailable",
    comps: [],
    disclaimer: "Live comparable rounds need a market-data source. Set SERPER_API_KEY (or a configured AI provider) to enable this.",
    query,
  };
  liveCache.set(key, { at: Date.now(), result: unavailable });
  return unavailable;
}
