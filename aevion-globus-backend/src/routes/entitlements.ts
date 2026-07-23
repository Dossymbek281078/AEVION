/**
 * Platform entitlements + paywall policy.
 *
 *   GET /api/me/entitlements  — per-module access map for the caller's plan.
 *       The frontend reads this to render locks/unlocks consistently with what
 *       the server actually enforces (same resolver as requireModule()).
 *
 *   GET /api/paywall/policy   — public, plan-independent: which tiers unlock
 *       each module and whether the paywall is currently enforced for it.
 */

import { Router } from "express";
import {
  getEntitlements,
  tiersForModule,
  paywallEnabledFor,
  normalizeTier,
} from "../lib/planGate";
import { MODULES_PRICING } from "../data/pricing";
import { funnelSummary } from "../lib/paywallDenyLog";

export const entitlementsRouter = Router();

/** Caller-specific entitlements (resolves JWT / subscription). */
entitlementsRouter.get("/me/entitlements", (req, res) => {
  res.json({ ...getEntitlements(req), generatedAt: new Date().toISOString() });
});

/** Public paywall policy — no auth, safe to cache on the edge. */
entitlementsRouter.get("/paywall/policy", (_req, res) => {
  const modules = MODULES_PRICING.map((m) => ({
    module: m.id,
    requiredTiers: tiersForModule(m.id)
      .map(normalizeTier)
      .filter((t) => t !== "free"),
    enforced: paywallEnabledFor(m.id),
  }));
  res.json({
    modules,
    enforcedCount: modules.filter((m) => m.enforced).length,
    generatedAt: new Date().toISOString(),
  });
});

/** Public deny funnel — aggregate demand signal for paid modules.
 *  How many anonymous/free callers hit each module's 402 wall (module +
 *  tier counts only, никаких user ids). ?days=N clamped 1–90, default 30. */
entitlementsRouter.get("/paywall/funnel", async (req, res) => {
  try {
    const days = Number(req.query.days) || 30;
    res.json({ ...(await funnelSummary(days)), generatedAt: new Date().toISOString() });
  } catch {
    res.status(500).json({ error: "funnel failed" });
  }
});
