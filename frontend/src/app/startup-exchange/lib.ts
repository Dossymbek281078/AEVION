/**
 * StartupX — shared types and API access for the exchange UI.
 *
 * The shapes here mirror aevion-globus-backend/src/lib/startupx/*. They are
 * intentionally not re-derived: the backend is the source of truth for tier
 * rules, market sources and the disclaimer, and the UI reads them from
 * /api/startupx/tiers rather than keeping a second copy that can drift.
 */

import { apiUrl } from "@/lib/apiBase";

export type Tier = "idea" | "mvp" | "product";
export type DealIntent = "raise" | "sell_stake" | "sell_full";
export type BuildBy = "founder" | "investor" | "shared";

export interface TierSpec {
  id: Tier;
  label: string;
  offer: string;
  intents: DealIntent[];
  ticketUsd: { low: number; high: number };
  minDescription: number;
  requiresDemoUrl: boolean;
}

export interface DealTerms {
  intent: DealIntent;
  askUsd?: number;
  equityOfferedPct?: number;
  buildBy?: BuildBy;
  askingPriceUsd?: number;
  stakeForSalePct?: number;
  stakePriceUsd?: number;
  notes?: string;
}

export interface ListingMetrics {
  mrrUsd?: number;
  arrUsd?: number;
  users?: number;
  payingCustomers?: number;
  growthMomPct?: number;
  churnMonthlyPct?: number;
  grossMarginPct?: number;
  teamSize?: number;
  monthsInDevelopment?: number;
}

export interface AssessmentFactor {
  key: string;
  label: string;
  weight: number;
  score: number;
  rationale: string;
  basis: "company-evidence" | "sector-prior" | "text-only";
}

export interface RedFlag {
  severity: "high" | "medium" | "info";
  message: string;
}

export interface ValuationBand {
  low: number;
  base: number;
  high: number;
  basis: string;
  method: "revenue-multiple" | "stage-band";
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
  deal: {
    band: ValuationBand;
    implied: { postMoneyUsd: number | null; ratioToBandHigh: number | null; formula: string | null };
    ticket: { low: number; high: number; note: string };
  };
  sector: {
    id: string;
    label: string;
    tamUsdBn: number;
    cagr: number;
    /** Откуда взялась отрасль: указал основатель, определили по тексту, или общий запас. */
    origin: "declared" | "detected" | "fallback";
  };
  sources: Array<{ publisher: string; year: number; claim: string; url: string }>;
  evidenceCoverage: number;
  disclaimer: string;
  generatedAt: string;
}

export interface Listing {
  id: number;
  title: string;
  description: string;
  tier: Tier;
  tierLabel: string;
  stage: string;
  sector: string | null;
  geography: string | null;
  demo_url: string | null;
  repo_url: string | null;
  deal: DealTerms | null;
  metrics: ListingMetrics | null;
  assessment: Assessment | null;
  assessment_score: number | null;
  contact_method: string | null;
  content_hash: string | null;
  qright_protected: boolean;
  /** Сколько раз открывали страницу заявки (открытия, не уникальные посетители). */
  views: number;
  /** Причина снятия оператором площадки — видна основателю, если это произошло. */
  removed_reason?: string | null;
  /** "public" | "withdrawn" — снятая заявка не видна в ленте, но открыта по личной ссылке. */
  visibility: string;
  created_at: string;
  interest_count?: number;
}

export interface ListingDraft {
  title: string;
  description: string;
  tier: Tier;
  sector?: string;
  geography?: string;
  demoUrl?: string;
  repoUrl?: string;
  deal: DealTerms;
  metrics?: ListingMetrics;
  founderEmail?: string;
  contactMethod?: string;
}

export interface Offer {
  id: number;
  investorEmail: string;
  message: string | null;
  intent: DealIntent | null;
  ticketUsd: number | null;
  equityPct: number | null;
  createdAt: string;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export class ApiError extends Error {
  issues: ValidationIssue[];
  constructor(message: string, issues: ValidationIssue[] = []) {
    super(message);
    this.issues = issues;
  }
}

/**
 * Сервер отвечает кодом (`rate_limited`), а человек читает предложение. Без
 * этого перевода основатель видел в красной строке «rate_limited» и не понимал,
 * сломалось ли что-то у него или у нас.
 */
const ERROR_TEXT: Record<string, string> = {
  rate_limited: "Слишком много запросов подряд. Подождите минуту и повторите.",
  daily_publish_limit: "С этого адреса сегодня уже опубликовано максимум заявок. Следующая — завтра.",
  validation_failed: "Проверьте отмеченные поля.",
  assessment_failed: "Не удалось посчитать разбор. Попробуйте ещё раз.",
  // 503, а не «не найдено»: заявка на месте, недоступна база. Разница для
  // основателя — между «подожду минуту» и «моя заявка пропала».
  database_unavailable: "База сейчас недоступна — заявки на месте. Обновите страницу через минуту.",
  not_found: "Заявка не найдена — возможно, её сняли с публикации.",
  idea_not_found: "Заявка не найдена — возможно, её сняли с публикации.",
  invalid_id: "Ссылка на заявку испорчена.",
  invalid_token: "Ссылка не подходит к этой заявке. Откройте её из письма с ключом.",
  forbidden: "Нет прав на это действие.",
  update_failed: "Не удалось сохранить правку. Попробуйте ещё раз.",
  withdraw_failed: "Не удалось снять заявку. Попробуйте ещё раз.",
  offers_unavailable: "Предложения сейчас недоступны. Попробуйте позже.",
  report_failed: "Жалоба не отправилась. Попробуйте ещё раз.",
  reason_required: "Выберите причину.",
  reason_invalid: "Выберите причину из списка.",
};

export function humanError(code: string | undefined, status: number): string {
  if (code && ERROR_TEXT[code]) return ERROR_TEXT[code];
  if (code && !/^[a-z0-9_]+$/.test(code)) return code; // сервер уже прислал текст
  return `Ошибка ${status}. Попробуйте ещё раз.`;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(apiUrl(`/api/startupx${path}`), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  let payload: unknown = null;
  try {
    payload = await resp.json();
  } catch {
    throw new ApiError(`Сервер ответил ${resp.status} без данных`);
  }
  const body = payload as { success?: boolean; data?: T; error?: string; issues?: ValidationIssue[] };
  if (!resp.ok || body?.success === false) {
    throw new ApiError(humanError(body?.error, resp.status), body?.issues ?? []);
  }
  return body.data as T;
}

export const startupxApi = {
  tiers: () =>
    call<{
      tiers: TierSpec[];
      intents: DealIntent[];
      /** Sector list the assessment scores against — the form offers only these. */
      sectors: Array<{ id: string; label: string }>;
      sources: Assessment["sources"];
      assessmentVersion: number;
      disclaimer: string;
    }>("/tiers"),

  stats: () =>
    call<{
      total: number;
      byTier: Record<string, number>;
      recentCount: number;
      assessed: number;
      avgScore: number;
    }>("/stats"),

  list: (params: { tier?: Tier | ""; sector?: string; q?: string; limit: number; offset: number; sort?: "recent" | "score" }) => {
    const q = new URLSearchParams();
    q.set("limit", String(params.limit));
    q.set("offset", String(params.offset));
    if (params.tier) q.set("tier", params.tier);
    if (params.sector) q.set("sector", params.sector);
    if (params.q) q.set("q", params.q);
    if (params.sort) q.set("sort", params.sort);
    return call<{ listings: Listing[]; total: number }>(`/ideas?${q.toString()}`);
  },

  get: (id: number) => call<Listing>(`/ideas/${id}`),

  /** Free analysis of a draft — nothing is stored. */
  assess: (draft: ListingDraft) =>
    call<{ assessment: Assessment; stored: boolean }>("/assess", {
      method: "POST",
      body: JSON.stringify(draft),
    }),

  publish: (draft: ListingDraft) =>
    call<{
      id: number;
      contentHash: string;
      /** Shown to the founder exactly once — the only key to their offers. */
      manageToken: string;
      listing: Listing;
      assessment: Assessment;
    }>("/ideas", {
      method: "POST",
      body: JSON.stringify(draft),
    }),

  /** The founder's inbox for one listing. Requires the token issued on publish. */
  offers: (id: number, token: string) =>
    call<{ listing: Listing; offers: Offer[] }>(`/ideas/${id}/offers?token=${encodeURIComponent(token)}`),

  /** Correct the terms of a published listing. Text and tier are frozen. */
  updateTerms: (id: number, token: string, patch: { deal: DealTerms; metrics?: ListingMetrics; demoUrl?: string; repoUrl?: string }) =>
    call<{ listing: Listing; assessment: Assessment }>(`/ideas/${id}?token=${encodeURIComponent(token)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  /** Жалоба посетителя. Ничего не скрывает — показывает оператору, куда смотреть. */
  report: (id: number, payload: { reason: string; note?: string }) =>
    call<{ received: boolean }>(`/ideas/${id}/report`, { method: "POST", body: JSON.stringify(payload) }),

  /** Take the listing off the public feed. The row and its offers are kept. */
  withdraw: (id: number, token: string) =>
    call<{ id: number; visibility: string }>(`/ideas/${id}?token=${encodeURIComponent(token)}`, {
      method: "DELETE",
    }),

  interest: (
    id: number,
    payload: { investorEmail: string; message?: string; intent?: DealIntent; ticketUsd?: number; equityPct?: number },
  ) =>
    call<{ id: number; ideaId: number }>(`/ideas/${id}/interest`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

// ── Formatting ───────────────────────────────────────────────────────────────

/** Деньги коротко. ".0" не несёт информации, поэтому не показывается. */
export function usd(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const short = (value: number, digits: number): string => {
    const rounded = value.toFixed(digits);
    return rounded.endsWith(".0") ? rounded.slice(0, -2) : rounded;
  };
  if (Math.abs(n) >= 1_000_000) return `$${short(n / 1_000_000, n >= 10_000_000 ? 0 : 1)}M`;
  if (Math.abs(n) >= 1_000) return `$${short(n / 1_000, n >= 100_000 ? 0 : 1)}K`;
  return `$${Math.round(n)}`;
}

export const TIER_ACCENT: Record<Tier, string> = {
  idea: "#7c3aed",
  mvp: "#0d9488",
  product: "#b45309",
};

export const BAND_STYLE: Record<Assessment["band"], { label: string; color: string; bg: string }> = {
  strong: { label: "Сильная заявка", color: "#166534", bg: "#dcfce7" },
  mixed: { label: "Есть пробелы", color: "#92400e", bg: "#fef3c7" },
  weak: { label: "Не готова", color: "#991b1b", bg: "#fee2e2" },
};

/**
 * Reading a label out of a lookup table by a key that came from the server.
 *
 * `MAP[key]` answers for `constructor`, `toString`, `valueOf` and `__proto__`
 * on every JavaScript object, so a stray value would render a function into the
 * page instead of a word. Values are validated on write, so this is defence in
 * depth — the kind that costs one line.
 */
export function labelOf<T extends string>(map: Record<T, string>, key: string | null | undefined, fallback: string): string {
  if (!key || !Object.prototype.hasOwnProperty.call(map, key)) return fallback;
  return map[key as T];
}

export const INTENT_LABEL: Record<DealIntent, string> = {
  raise: "Привлекает инвестиции за долю",
  sell_stake: "Продаёт долю",
  sell_full: "Продаёт проект целиком",
};

export const BUILD_BY_LABEL: Record<BuildBy, string> = {
  founder: "дорабатывает основатель",
  investor: "разработку берёт инвестор",
  shared: "делают вместе",
};

/** One line describing what the founder is asking for, from the deal terms. */
export function dealHeadline(deal: DealTerms | null): string {
  if (!deal) return "Условия сделки не указаны";
  if (deal.intent === "raise") {
    if (deal.askUsd && deal.equityOfferedPct) {
      return `${usd(deal.askUsd)} за ${deal.equityOfferedPct}%`;
    }
    return "Привлекает инвестиции";
  }
  if (deal.intent === "sell_stake") {
    if (deal.stakePriceUsd && deal.stakeForSalePct) {
      return `${deal.stakeForSalePct}% за ${usd(deal.stakePriceUsd)}`;
    }
    return "Продаёт долю";
  }
  return deal.askingPriceUsd ? `Продажа целиком — ${usd(deal.askingPriceUsd)}` : "Продажа целиком";
}
