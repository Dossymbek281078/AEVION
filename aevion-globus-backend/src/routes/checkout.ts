import { Router } from "express";
import { gumroadPaymentProvider } from "../lib/payment/gumroadProvider";
import {
  TIERS, getTier, getModulePrice, resolvePromoCode,
  type TierId, type BillingPeriod,
} from "../data/pricing";
import { provisionSubscription, countSubscriptions } from "./provisioning";

export const checkoutRouter = Router();

/**
 * Gumroad checkout с graceful stub-fallback.
 *
 * Gumroad — единственный KYC-пройденный процессинг (Stripe/Paddle/LemonSqueezy
 * заблокированы). Цена фиксируется в продукте Gumroad; здесь мы строим публичный
 * URL продукта по permalink'у из env. Провижининг подписки выполняется централизованно
 * в POST /api/gumroad/webhook (см. routes/gumroadWebhook.ts) — отдельного вебхука здесь нет.
 *
 * ENV (permalink на tier:period; без него — graceful stub):
 *   GUMROAD_PERMALINK_TIER_PRO_MONTHLY, ..._PRO_ANNUAL,
 *   GUMROAD_PERMALINK_TIER_BUSINESS_MONTHLY, ..._BUSINESS_ANNUAL
 *   GUMROAD_DEFAULT_PERMALINK — catch-all, если конкретный не задан
 */

const FRONTEND_URL = process.env.FRONTEND_URL?.trim() || "http://localhost:3000";

/** A Gumroad checkout is "real" only when a product permalink is configured. */
function gumroadPermalinkConfigured(reference: string): boolean {
  const envKey = `GUMROAD_PERMALINK_${reference.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  return Boolean(process.env[envKey] || process.env.GUMROAD_DEFAULT_PERMALINK);
}

interface CheckoutBody {
  tierId: TierId;
  period?: "monthly" | "annual";
  seats?: number;
  modules?: string[];
  promoCode?: string;
  email?: string;
  trial?: boolean;
}

// ── POST /session ─────────────────────────────────────────────────────────────
checkoutRouter.post("/session", async (req, res) => {
  try {
    const body = (req.body ?? {}) as CheckoutBody;

    if (!body.tierId || !["free", "lite", "medium", "full", "enterprise"].includes(body.tierId)) {
      return res.status(400).json({ error: "invalid_tier" });
    }
    const tier = getTier(body.tierId)!;
    const period: BillingPeriod = body.period === "annual" ? "annual" : "monthly";
    const seats = Math.max(1, Math.min(1000, body.seats ?? 1));

    if (tier.id === "free") {
      return res.json({
        url: `${FRONTEND_URL}/pricing/checkout/success?stub=true&tier=free`,
        mode: "stub",
      });
    }

    if (tier.id === "enterprise") {
      return res.json({
        url: `${FRONTEND_URL}/pricing/contact?tier=enterprise`,
        mode: "stub",
      });
    }

    const tierUsd = period === "annual" ? (tier.priceAnnualTotal ?? 0) : (tier.priceMonthly ?? 0);

    let totalUsd = tierUsd;

    // Extra seats
    const baseSeats = tier.limits.seats ?? 1;
    const extraSeats = Math.max(0, seats - baseSeats);
    if (extraSeats > 0) {
      totalUsd += 5 * extraSeats * (period === "annual" ? 12 : 1);
    }

    // Add-on modules
    for (const mid of body.modules ?? []) {
      const m = getModulePrice(mid);
      if (!m || m.includedIn.includes(tier.id)) continue;
      if (!m.addonMonthly) continue;
      totalUsd += m.addonMonthly * (period === "annual" ? 12 : 1);
    }

    // Promo code discount
    let discountUsd = 0;
    if (body.promoCode) {
      const { promo } = resolvePromoCode(body.promoCode, tier.id);
      if (promo) {
        const subtotal = totalUsd;
        discountUsd = promo.kind === "percent"
          ? Math.round(subtotal * promo.amount) / 100
          : Math.min(subtotal, promo.amount * (period === "annual" ? 12 : 1));
        totalUsd = Math.max(0, totalUsd - discountUsd);
      }
    }

    const trialDays = body.trial && (tier.id === "lite" || tier.id === "medium" || tier.id === "full") ? 14 : 0;
    const totalCents = Math.round(totalUsd * 100);

    const reference = `tier_${tier.id}_${period}`;

    // Free / fully discounted — no checkout needed, provision directly
    if (totalCents <= 0) {
      if (body.email) {
        provisionSubscription({
          email: body.email, tierId: tier.id, period, seats,
          modules: body.modules ?? [], trialDays, amountUsd: 0,
          promoCode: body.promoCode, source: "gumroad_zero",
        }).catch((e) => console.error("[provisioning] zero-price failed", e));
      }
      return res.json({
        url: `${FRONTEND_URL}/pricing/checkout/success?gumroad=true&tier=${tier.id}&period=${period}&total=0`,
        mode: "zero",
        provider: "gumroad",
      });
    }

    // Stub-режим — для этого tier:period ещё не задан Gumroad-permalink
    if (!gumroadPermalinkConfigured(reference)) {
      if (body.email) {
        provisionSubscription({
          email: body.email,
          tierId: tier.id,
          period,
          seats,
          modules: body.modules ?? [],
          trialDays,
          amountUsd: totalUsd,
          promoCode: body.promoCode,
          source: "stub_checkout",
        }).catch((e) => console.error("[stub_provisioning] failed", e));
      }
      return res.json({
        url: `${FRONTEND_URL}/pricing/checkout/success?stub=true&tier=${tier.id}&period=${period}&total=${totalCents}`,
        mode: "stub",
        provider: "gumroad",
      });
    }

    // Реальный Gumroad checkout — публичный URL продукта по permalink'у.
    // Цена фиксирована в продукте Gumroad; провижининг — на ping продукта
    // (POST /api/gumroad/webhook).
    const intent = await gumroadPaymentProvider.createIntent({
      reference,
      amountCents: totalCents,
      currency: "USD",
      description: `AEVION ${tier.name} ${period === "annual" ? "Annual" : "Monthly"}`,
      email: body.email ?? null,
    });

    res.json({
      url: intent.checkoutUrl,
      mode: "real",
      provider: "gumroad",
      intentId: intent.intentId,
    });
  } catch (e: unknown) {
    console.error("[checkout/session] failed", e);
    res.status(500).json({ error: "checkout_failed", message: e instanceof Error ? e.message : String(e) });
  }
});

// ── POST /webhook ─────────────────────────────────────────────────────────────
// Paddle webhook removed. Gumroad sale provisioning is handled centrally by
// POST /api/gumroad/webhook (routes/gumroadWebhook.ts). Keep this path as a
// 410 so any stale Paddle webhook config fails loudly instead of silently 200.
checkoutRouter.post("/webhook", (_req, res) => {
  res.status(410).json({
    error: "gone",
    message: "Paddle webhook removed — Gumroad sales are provisioned at POST /api/gumroad/webhook",
  });
});

// ── GET /subscriptions/count ──────────────────────────────────────────────────
checkoutRouter.get("/subscriptions/count", (_req, res) => {
  res.json({ total: countSubscriptions() });
});

// ── GET /healthz ──────────────────────────────────────────────────────────────
checkoutRouter.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    provider: "gumroad",
    webhook: "/api/gumroad/webhook",
    frontendUrl: FRONTEND_URL,
  });
});
