/**
 * Free-tier token quota gate for QCoreAI's token-spending endpoints.
 *
 * The Free tariff advertises "100 000 tokens / month" on qcoreai. Because
 * qcoreai carries real per-request AI OPEX, it is deliberately NOT placed
 * behind the all-or-nothing module paywall (that would break the advertised
 * free quota). Instead this gate enforces exactly the promise: an authenticated
 * free-tier user who has spent the monthly allowance gets a 402
 * upgrade_required (same shape as the module paywall), deep-linking to
 * /pricing. Paid tiers (medium+) bypass. Anonymous callers are left unchanged
 * (unmetered) — that is pre-existing behaviour; anon abuse is a separate
 * rate-limit concern.
 *
 * SAFETY — dormant by default. Only active when env QCOREAI_FREE_QUOTA=1, so
 * merging/shipping is a no-op until the quota is deliberately switched on
 * (mirrors the PAYWALL_MODULES flip pattern in planGate.ts).
 */

import type { Request, Response } from "express";
import { resolveUserPlan } from "./planGate";
import { verifyBearerOptional } from "./authJwt";
import { getMonthlyTokens } from "../services/qcoreai/store";

const PUBLIC_BASE = (process.env.AEVION_PUBLIC_BASE_URL ?? "https://aevion.app").replace(/\/+$/, "");

/** Monthly free-tier token allowance for qcoreai. Env-overridable. */
export function freeTokenLimit(): number {
  const raw = process.env.QCOREAI_FREE_TOKENS_PER_MONTH;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 100_000;
}

/**
 * Enforce the free-tier monthly token quota. Returns true if the request was
 * blocked (a 402 response has already been sent — the caller must return);
 * false to proceed. Fails open on any metering error — never blocks paid
 * traffic or breaks the endpoint because the counter query hiccuped.
 */
export async function enforceFreeTokenQuota(req: Request, res: Response): Promise<boolean> {
  if (process.env.QCOREAI_FREE_QUOTA !== "1") return false; // dormant unless flipped on

  const auth = verifyBearerOptional(req) as { sub?: string } | null;
  if (!auth?.sub) return false; // anonymous — unmetered, unchanged

  const plan = resolveUserPlan(req);
  if (plan.tier !== "free") return false; // paid — no free-token cap

  let used = 0;
  try {
    used = await getMonthlyTokens(auth.sub);
  } catch {
    return false; // fail open — a metering failure must not break chat
  }

  const limit = freeTokenLimit();
  if (used < limit) return false;

  res.status(402).json({
    error: "upgrade_required",
    module: "qcoreai",
    plan: "free",
    reason: "free_token_quota_exhausted",
    usedTokens: used,
    limitTokens: limit,
    requiredTiers: ["medium", "full", "enterprise"],
    upgradeUrl: `${PUBLIC_BASE}/pricing`,
    message: `Бесплатный лимит QCoreAI (${limit.toLocaleString("ru-RU")} токенов/мес) исчерпан. Upgrade → ${PUBLIC_BASE}/pricing`,
  });
  return true;
}
