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
import { appSlugForModuleId } from "../data/lemonSqueezyVariants";
import { funnelSummary } from "../lib/paywallDenyLog";

export const entitlementsRouter = Router();

/** Cheapest monthly USD price among the tiers that unlock a module (excluding
 *  free). This is what one denied caller would pay to get in — the unit for
 *  the funnel's revenue-opportunity estimate. Null when nothing paid unlocks
 *  it (shouldn't happen for a gated module, but stays honest if pricing is
 *  misconfigured). */
/**
 * Самый дешёвый способ открыть модуль — из тех, что РЕАЛЬНО можно купить.
 *
 * ⚠️ ПОПРАВКА 02.09.2026. Считался минимум по одним ТАРИФАМ, а у модуля есть
 * второй путь — добавка (`addonMonthly`). Имя обещало минимум, а отдавался
 * минимум по половине путей.
 *
 * Цена ошибки не косметическая: это число умножается на количество отказов и
 * даёт `mrrCeilingUsd` — «сколько денег на столе», по которому решают, что
 * чинить и что продвигать. Замер на живых данных: у `constitution` добавка
 * $9 против дешевейшего тарифа $49, то есть потолок завышался в 5.4 раза.
 *
 * ГРАНИЦА, и она решает: добавка учитывается ТОЛЬКО если её правда можно
 * купить, то есть у модуля есть ссылка варианта (`app_<id>`). Цена добавки
 * объявлена у 31 модуля, а купить можно 8 — для остальных дешевейший тариф
 * и есть настоящий минимум, и учитывать объявленную добавку значило бы
 * занижать потолок обещанием, которого мы не выполняем.
 *
 * Замер по восьми покупаемым: у четырёх добавка дешевле тарифа
 * (cyberchess 19/29, qventure 39/49, qcontract 19/49, constitution 9/49),
 * у одного равна, остальные вне сравнения.
 */
export function minUnlockPriceUsd(moduleId: string): number | null {
  const paidTiers = new Set<string>(
    tiersForModule(moduleId).map(normalizeTier).filter((t) => t !== "free")
  );
  const prices = TIERS
    .filter((t) => paidTiers.has(normalizeTier(t.id)))
    .map((t) => t.priceMonthly)
    .filter((p): p is number => typeof p === "number" && p > 0);

  // Добавка — второй путь, но только там, где у неё есть касса.
  if (appSlugForModuleId(moduleId)) {
    const addon = MODULES_PRICING.find((m) => m.id === moduleId)?.addonMonthly;
    if (typeof addon === "number" && addon > 0) prices.push(addon);
  }

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
    const days = Number(req.query.days) || 30;
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
