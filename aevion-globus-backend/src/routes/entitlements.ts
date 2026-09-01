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
import { MODULES_PRICING, TIERS } from "../data/pricing";
import { funnelSummary } from "../lib/paywallDenyLog";

export const entitlementsRouter = Router();

/** Cheapest monthly USD price among the tiers that unlock a module (excluding
 *  free). This is what one denied caller would pay to get in — the unit for
 *  the funnel's revenue-opportunity estimate. Null when nothing paid unlocks
 *  it (shouldn't happen for a gated module, but stays honest if pricing is
 *  misconfigured). */
function minUnlockPriceUsd(moduleId: string): number | null {
  const paidTiers = new Set<string>(
    tiersForModule(moduleId).map(normalizeTier).filter((t) => t !== "free")
  );
  const prices = TIERS
    .filter((t) => paidTiers.has(normalizeTier(t.id)))
    .map((t) => t.priceMonthly)
    .filter((p): p is number => typeof p === "number" && p > 0);
  return prices.length ? Math.min(...prices) : null;
}

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
    // `Number(x) || 30` не останавливает отрицательные: «zzz» даёт 30, а «-5»
    // проходит как есть и уезжает в окно выборки. Класс известный, поэтому
    // ограничиваем разумными пределами. Проверить ПОСЛЕДСТВИЕ в проекции
    // выручки нечем (в тестовой среде данных нет и всё равно ноль), но само
    // ограничение проверяемо и очевидно правильно.
    const запрошено = Math.floor(Number(req.query.days));
    const days = Number.isFinite(запрошено) ? Math.min(365, Math.max(1, запрошено)) : 30;
    const summary = await funnelSummary(days);
    // Enrich each module with a revenue-opportunity ceiling: how many callers
    // hit the wall × the cheapest unlock price. It's a CEILING (denies are
    // requests, not unique would-be buyers, and not everyone converts) —
    // labeled as such in the UI — but it turns "N denials" into "up to $X/mo
    // if we convert this demand", which is the number that actually drives
    // which module to unblock/discount next.
    const byModule = summary.byModule.map((m) => {
      const unlockPriceUsd = minUnlockPriceUsd(m.module);
      return {
        ...m,
        unlockPriceUsd,
        mrrCeilingUsd: unlockPriceUsd != null ? m.denies * unlockPriceUsd : null,
      };
    });
    const mrrCeilingUsd = byModule.reduce((s, m) => s + (m.mrrCeilingUsd ?? 0), 0);
    res.json({ ...summary, byModule, mrrCeilingUsd, generatedAt: new Date().toISOString() });
  } catch {
    res.status(500).json({ error: "funnel failed" });
  }
});
