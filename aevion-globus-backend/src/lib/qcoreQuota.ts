/**
 * Token quota gate for QCoreAI's token-spending endpoints.
 *
 * Two independent gates, each dormant until explicitly flipped on (mirrors
 * the PAYWALL_MODULES flip pattern in planGate.ts):
 *
 *   - QCOREAI_FREE_QUOTA=1  — enforces the Free tariff's "100 000 tokens /
 *     month" promise. Confirmed live on Railway since 2026-07-20 (see
 *     docs/PAYWALL_FLIP_READINESS.md). Unchanged by the addition below.
 *
 *   - QCOREAI_TIER_QUOTA=1  — additionally enforces every PAID tier's
 *     advertised llmTokensPerMonth cap (data/pricing.ts TIERS[].limits).
 *     Added 2026-07-22 during the billing/repricing audit: those paid-tier
 *     numbers (Lite 2M, Medium 10M, Full 50M, Universe/pro 200M) were pure
 *     display values with no backing code path — a paid subscriber could run
 *     unlimited tokens against the priciest model in the fleet
 *     (services/qcoreai/pricing.ts has real per-provider $/1M-token costs)
 *     with zero cost protection for AEVION. Shipped dormant first — flip
 *     only after confirming real usage doesn't false-positive legitimate
 *     heavy users on tiers that were previously uncapped in practice.
 *
 *   - QCOREAI_PREMIUM_QUOTA=1 — a THIRD, separate gate (enforcePremiumModelQuota,
 *     called explicitly by routes once the model is resolved, unlike the two
 *     above which run at request start): even with the overall llmTokensPerMonth
 *     cap enforced, nothing stops a tier's whole allowance being spent on the
 *     single priciest model in the fleet (e.g. 200M tokens on claude-fable-5 at
 *     ~$50/1M output would cost far more than any subscription price). This
 *     checks a smaller premiumTokensPerMonth sub-cap (TIERS[].limits, ~10% of
 *     the overall cap) against isPremiumModel-flagged usage only. Added
 *     2026-07-22, ships dormant. Wired into qcoreai.ts's single-shot /chat +
 *     /chat-stream call sites (402 pre-dispatch) AND, since 2026-07-26, into
 *     the multi-agent orchestrator via the res-free gate below (the
 *     orchestrator yields a `premium_quota_exceeded` event mid-stream instead
 *     of a 402 — see premiumQuotaGateForRequest/ForPayload). Background
 *     scheduler ticks (no request context) remain ungated.
 *
 * qcoreai carries real per-request AI OPEX, so it is deliberately NOT placed
 * behind the all-or-nothing module paywall (that would break the advertised
 * free quota outright rather than "N free, then upgrade"). Anonymous callers
 * are left unchanged (unmetered) — that is pre-existing behaviour; anon abuse
 * is a separate rate-limit concern.
 */

import type { Request, Response } from "express";
import { resolveUserPlan, resolvePlanFromPayload } from "./planGate";
import { verifyBearerOptional } from "./authJwt";
import { getMonthlyTokens, getMonthlyPremiumTokens } from "../services/qcoreai/store";
import { isPremiumModel } from "../services/qcoreai/pricing";
import { getTier } from "../data/pricing";

const PUBLIC_BASE = (process.env.AEVION_PUBLIC_BASE_URL ?? "https://aevion.app").replace(/\/+$/, "");

/**
 * Оценка одного вызова чата в токенах — для ПРЕДПОЛЁТНОЙ проверки вееров.
 *
 * Учёт токенов здесь пост-фактум (реальный расход известен после ответа),
 * поэтому у любой проверки есть врождённый перелив на один вызов. Гонка
 * 06.09.2026: N параллельных вызовов читали одно used до первой записи —
 * перелив умножался на размер веера (8 у мультичата, слой консилиума, пул
 * batch). Лекарство — требовать запас на ВЕСЬ веер по этой оценке.
 *
 * Число можно ЗАВЫШАТЬ (веер раньше услышит «не хватит») и нельзя занижать
 * (занижение возвращает гонку). 1200 ≈ системный промпт + вопрос + ответ до
 * 200 слов с запасом.
 */
export const QUOTA_CALL_ESTIMATE_TOKENS = 1200;

/** Monthly free-tier token allowance for qcoreai. Env-overridable. */
export function freeTokenLimit(): number {
  const raw = process.env.QCOREAI_FREE_TOKENS_PER_MONTH;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 100_000;
}

async function block(
  res: Response,
  opts: { rawTier: string; used: number; limit: number; requiredTiers: string[] },
): Promise<true> {
  res.status(402).json({
    error: "upgrade_required",
    module: "qcoreai",
    plan: opts.rawTier,
    reason: opts.rawTier === "free" ? "free_token_quota_exhausted" : "tier_token_quota_exhausted",
    usedTokens: opts.used,
    limitTokens: opts.limit,
    requiredTiers: opts.requiredTiers,
    upgradeUrl: `${PUBLIC_BASE}/pricing`,
    message:
      opts.rawTier === "free"
        ? `Бесплатный лимит QCoreAI (${opts.limit.toLocaleString("ru-RU")} токенов/мес) исчерпан. Upgrade → ${PUBLIC_BASE}/pricing`
        : `Месячный лимит QCoreAI для вашего тарифа (${opts.limit.toLocaleString("ru-RU")} токенов/мес) исчерпан. Upgrade → ${PUBLIC_BASE}/pricing`,
  });
  return true;
}

/**
 * Enforce the monthly token quota for the caller's tier (free or paid).
 * Returns true if the request was blocked (a 402 response has already been
 * sent — the caller must return); false to proceed. Fails open on any
 * metering error — never blocks traffic or breaks the endpoint because the
 * counter query hiccuped.
 */
export type MonthlyQuotaState = { used: number; limit: number; rawTier: string; requiredTiers: string[] };

/**
 * Состояние месячной квоты вызывающего — ТА ЖЕ политика, что у
 * enforceFreeTokenQuota (флаги, планы, fail-open), но без 402: null значит
 * «не метрируется» (аноним, спящий флаг, безлимит, отказ счётчика).
 * Нужна веерам: они решают ДО старта, хватит ли остатка на всю пачку.
 */
export async function monthlyQuotaHeadroom(req: Request): Promise<MonthlyQuotaState | null> {
  const auth = verifyBearerOptional(req) as { sub?: string } | null;
  if (!auth?.sub) return null; // anonymous — unmetered, unchanged

  const plan = resolveUserPlan(req);

  if (plan.tier === "free") {
    if (process.env.QCOREAI_FREE_QUOTA !== "1") return null; // dormant unless flipped on
    let used = 0;
    try {
      used = await getMonthlyTokens(auth.sub);
    } catch {
      return null; // fail open — a metering failure must not break chat
    }
    return { used, limit: freeTokenLimit(), rawTier: "free", requiredTiers: ["medium", "full", "enterprise"] };
  }

  if (process.env.QCOREAI_TIER_QUOTA !== "1") return null; // dormant unless flipped on

  // Use the RAW tier id (e.g. "pro"/Universe), not the canonical one — "pro"
  // and "full" both normalize to canonical "full" for module-access gating,
  // but they advertise different token caps (200M vs 50M) and must not share
  // one lookup here.
  const tier = getTier(plan.rawTier) ?? getTier(plan.tier);
  const limit = tier?.limits.llmTokensPerMonth;
  if (limit == null) return null; // unlimited (enterprise) or unrecognized tier id

  let used = 0;
  try {
    used = await getMonthlyTokens(auth.sub);
  } catch {
    return null; // fail open — a metering failure must not break chat
  }
  return { used, limit, rawTier: plan.rawTier, requiredTiers: ["enterprise"] };
}

export async function enforceFreeTokenQuota(req: Request, res: Response): Promise<boolean> {
  const state = await monthlyQuotaHeadroom(req);
  if (!state) return false;
  if (state.used < state.limit) return false;
  return block(res, state);
}

/**
 * Enforce the caller's tier's premium-model token sub-cap (see the module
 * doc above). Call AFTER the route has resolved which provider/model will
 * actually serve the request, and BEFORE dispatching to it — unlike
 * enforceFreeTokenQuota, this needs to know the model up front. Returns true
 * if blocked (402 already sent); false to proceed. Fails open on any
 * metering error, on a non-premium model, and on anonymous callers.
 */
export async function enforcePremiumModelQuota(
  req: Request,
  res: Response,
  provider: string,
  model: string,
): Promise<boolean> {
  const payload = verifyBearerOptional(req) as Record<string, unknown> | null;
  const hit = await checkPremiumQuotaForPayload(payload, provider, model);
  if (!hit) return false;

  const plan = resolvePlanFromPayload(payload);
  res.status(402).json({
    error: "upgrade_required",
    module: "qcoreai",
    plan: plan.rawTier,
    reason: "premium_model_quota_exhausted",
    usedTokens: hit.usedTokens,
    limitTokens: hit.limitTokens,
    requiredTiers: ["enterprise"],
    upgradeUrl: `${PUBLIC_BASE}/pricing`,
    message: `Месячный лимит на топовые модели для вашего тарифа (${hit.limitTokens.toLocaleString("ru-RU")} токенов/мес) исчерпан — обычные модели остаются доступны. Upgrade → ${PUBLIC_BASE}/pricing`,
  });
  return true;
}

/* ───── Orchestrator premium-quota gate (res-free) ─────────────────────────
   The multi-agent orchestrator can't 402 mid-run (the SSE/WS stream is
   already open), so instead of Request/Response it takes a gate callback on
   OrchestratorInput and yields a `premium_quota_exceeded` event when the
   gate trips. The check itself is IDENTICAL to enforcePremiumModelQuota
   above — one policy, two delivery mechanisms. */

export type PremiumQuotaHit = { usedTokens: number; limitTokens: number };
/** projectedCalls — размер ПАРАЛЛЕЛЬНОЙ группы, которую этот вызов открывает:
 *  слой консилиума из 8 премиум-моделей обязан пройти проверку с запасом на
 *  все восемь, иначе N одновременных проверок читают одно used до первой
 *  записи и предел переливается ×N (гонка 06.09.2026). */
export type PremiumQuotaGate = (provider: string, model: string, projectedCalls?: number) => Promise<PremiumQuotaHit | null>;

async function checkPremiumQuotaForPayload(
  payload: Record<string, unknown> | null,
  provider: string,
  model: string,
  projectedCalls = 1,
): Promise<PremiumQuotaHit | null> {
  if (process.env.QCOREAI_PREMIUM_QUOTA !== "1") return null; // dormant unless flipped on
  if (!isPremiumModel(provider, model)) return null; // not a premium model — nothing to check

  const sub = payload && typeof payload.sub === "string" ? payload.sub : null;
  if (!sub) return null; // anonymous — unmetered, unchanged

  const plan = resolvePlanFromPayload(payload);
  const tier = getTier(plan.rawTier) ?? getTier(plan.tier);
  const limit = tier?.limits.premiumTokensPerMonth;
  if (limit == null) return null; // no sub-cap for this tier (free's overall cap already bounds it; enterprise unlimited)

  let used = 0;
  try {
    used = await getMonthlyPremiumTokens(sub);
  } catch {
    return null; // fail open — a metering failure must not break the run
  }
  // Запас на всю параллельную группу: последний вызов группы стартует с тем
  // же used, что и первый, — значит проверять надо худший случай.
  const reserve = Math.max(0, projectedCalls - 1) * QUOTA_CALL_ESTIMATE_TOKENS;
  if (used + reserve < limit) return null;

  return { usedTokens: used, limitTokens: limit };
}

/** Gate for orchestrator runs started from an Express route. */
export function premiumQuotaGateForRequest(req: Request): PremiumQuotaGate {
  const payload = verifyBearerOptional(req) as Record<string, unknown> | null;
  return premiumQuotaGateForPayload(payload);
}

/** Gate for orchestrator runs started outside Express (e.g. the WS server). */
export function premiumQuotaGateForPayload(payload: Record<string, unknown> | null): PremiumQuotaGate {
  return (provider, model, projectedCalls) => checkPremiumQuotaForPayload(payload, provider, model, projectedCalls);
}
