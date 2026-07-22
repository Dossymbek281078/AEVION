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
 * qcoreai carries real per-request AI OPEX, so it is deliberately NOT placed
 * behind the all-or-nothing module paywall (that would break the advertised
 * free quota outright rather than "N free, then upgrade"). Anonymous callers
 * are left unchanged (unmetered) — that is pre-existing behaviour; anon abuse
 * is a separate rate-limit concern.
 */

import type { Request, Response } from "express";
import { resolveUserPlan } from "./planGate";
import { verifyBearerOptional } from "./authJwt";
import { getMonthlyTokens } from "../services/qcoreai/store";
import { getTier } from "../data/pricing";

const PUBLIC_BASE = (process.env.AEVION_PUBLIC_BASE_URL ?? "https://aevion.app").replace(/\/+$/, "");

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
export async function enforceFreeTokenQuota(req: Request, res: Response): Promise<boolean> {
  const auth = verifyBearerOptional(req) as { sub?: string } | null;
  if (!auth?.sub) return false; // anonymous — unmetered, unchanged

  const plan = resolveUserPlan(req);

  if (plan.tier === "free") {
    if (process.env.QCOREAI_FREE_QUOTA !== "1") return false; // dormant unless flipped on
    let used = 0;
    try {
      used = await getMonthlyTokens(auth.sub);
    } catch {
      return false; // fail open — a metering failure must not break chat
    }
    const limit = freeTokenLimit();
    if (used < limit) return false;
    return block(res, { rawTier: "free", used, limit, requiredTiers: ["medium", "full", "enterprise"] });
  }

  if (process.env.QCOREAI_TIER_QUOTA !== "1") return false; // dormant unless flipped on

  // Use the RAW tier id (e.g. "pro"/Universe), not the canonical one — "pro"
  // and "full" both normalize to canonical "full" for module-access gating,
  // but they advertise different token caps (200M vs 50M) and must not share
  // one lookup here.
  const tier = getTier(plan.rawTier) ?? getTier(plan.tier);
  const limit = tier?.limits.llmTokensPerMonth;
  if (limit == null) return false; // unlimited (enterprise) or unrecognized tier id

  let used = 0;
  try {
    used = await getMonthlyTokens(auth.sub);
  } catch {
    return false; // fail open — a metering failure must not break chat
  }
  if (used < limit) return false;

  return block(res, { rawTier: plan.rawTier, used, limit, requiredTiers: ["enterprise"] });
}
