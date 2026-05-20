import { Router } from "express";
import {
  PADDLE_KEY, PADDLE_WEBHOOK_SECRET, IS_PADDLE_SANDBOX,
  paddlePost, paddleGet, verifyPaddleWebhook,
} from "../lib/paddleClient";
import {
  TIERS, getTier, getModulePrice, resolvePromoCode,
  type TierId, type BillingPeriod,
} from "../data/pricing";
import { provisionSubscription, countSubscriptions } from "./provisioning";

export const checkoutRouter = Router();

/**
 * Paddle Billing checkout с graceful stub-fallback.
 *
 * Если PADDLE_API_KEY задан — создаём реальную Paddle Transaction.
 * Если нет — возвращаем stub-ссылку для UX-flow без реальных ключей.
 *
 * ENV:
 *   PADDLE_API_KEY         — secret key из Paddle dashboard
 *   PADDLE_WEBHOOK_SECRET  — webhook endpoint secret
 *   PADDLE_SANDBOX         — "true"(default)/"false" для prod
 */

const FRONTEND_URL = process.env.FRONTEND_URL?.trim() || "http://localhost:3000";

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

    if (!body.tierId || !["free", "pro", "business", "enterprise"].includes(body.tierId)) {
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

    const trialDays = body.trial && (tier.id === "pro" || tier.id === "business") ? 14 : 0;
    const totalCents = Math.round(totalUsd * 100);

    // Stub-режим — нет Paddle ключа
    if (!PADDLE_KEY()) {
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
        provider: "paddle",
      });
    }

    if (totalCents <= 0) {
      // Free / fully discounted
      if (body.email) {
        provisionSubscription({
          email: body.email, tierId: tier.id, period, seats,
          modules: body.modules ?? [], trialDays, amountUsd: 0,
          promoCode: body.promoCode, source: "paddle_zero",
        }).catch((e) => console.error("[provisioning] zero-price failed", e));
      }
      return res.json({
        url: `${FRONTEND_URL}/pricing/checkout/success?paddle=true&tier=${tier.id}&period=${period}&total=0`,
        mode: "zero",
        provider: "paddle",
      });
    }

    // Реальный Paddle Checkout — используем каталожные priceId если заданы, иначе inline price
    const PADDLE_PRICES: Record<string, string | undefined> = {
      "pro:monthly":   process.env.PADDLE_PRICE_PRO_MONTHLY,
      "pro:annual":    process.env.PADDLE_PRICE_PRO_ANNUAL,
      "business:monthly": process.env.PADDLE_PRICE_BIZ_MONTHLY,
      "business:annual":  process.env.PADDLE_PRICE_BIZ_ANNUAL,
    };
    const catalogPriceId = PADDLE_PRICES[`${tier.id}:${period}`];

    const customData: Record<string, string> = {
      tierId: tier.id,
      period,
      seats: String(seats),
      modules: (body.modules ?? []).join(","),
      promoCode: body.promoCode ?? "",
      trialDays: String(trialDays),
      source: "aevion_checkout",
    };

    // Build items: prefer catalog priceId, fall back to inline price
    const item: Record<string, unknown> = catalogPriceId
      ? { price_id: catalogPriceId, quantity: 1 }
      : {
          price: {
            description: `AEVION ${tier.name} ${period === "annual" ? "Annual" : "Monthly"}`,
            unit_price: { amount: String(totalCents), currency_code: "USD" },
            product: { name: `AEVION ${tier.name}`, tax_category: "standard" },
          },
          quantity: 1,
        };

    // Find or create Paddle customer
    const txBody: Record<string, unknown> = {
      items: [item],
      checkout: {
        url: `${FRONTEND_URL}/pricing/checkout/success?tier=${tier.id}&period=${period}`,
      },
      custom_data: customData,
    };

    if (body.email) {
      const existing = await paddleGet(
        `/customers?email=${encodeURIComponent(body.email)}&per_page=1`
      ) as { data?: { id: string }[] } | null;
      const customerId = existing?.data?.[0]?.id;
      if (customerId) {
        txBody.customer_id = customerId;
      } else {
        const newCust = await paddlePost("/customers", { email: body.email }) as { data?: { id: string } } | null;
        if (newCust?.data?.id) txBody.customer_id = newCust.data.id;
      }
    }

    const tx = await paddlePost("/transactions", txBody) as {
      data?: { id: string; checkout?: { url: string } };
    } | null;

    if (!tx?.data) {
      return res.status(502).json({ error: "paddle_transaction_failed" });
    }

    res.json({
      url: tx.data.checkout?.url ?? `${FRONTEND_URL}/pricing/checkout/success?tx=${tx.data.id}`,
      mode: "real",
      provider: "paddle",
      transactionId: tx.data.id,
      sandbox: IS_PADDLE_SANDBOX(),
    });
  } catch (e: unknown) {
    console.error("[checkout/session] failed", e);
    res.status(500).json({ error: "checkout_failed", message: e instanceof Error ? e.message : String(e) });
  }
});

// ── POST /webhook ─────────────────────────────────────────────────────────────
checkoutRouter.post("/webhook", (req, res) => {
  const secret = PADDLE_WEBHOOK_SECRET();

  if (!secret) {
    console.log("[checkout/webhook] STUB — no PADDLE_WEBHOOK_SECRET");
    return res.json({ received: true, mode: "stub" });
  }

  const sig = req.headers["paddle-signature"] as string | undefined;
  if (!sig) return res.status(400).json({ error: "missing paddle-signature header" });

  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
  if (!rawBody) return res.status(400).json({ error: "raw body not available" });

  if (!verifyPaddleWebhook(rawBody, sig, secret)) {
    console.error("[checkout/webhook] signature mismatch");
    return res.status(400).json({ error: "invalid_signature" });
  }

  let event: { event_type: string; data: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "invalid_json" });
  }

  // Paddle events: transaction.completed → provision subscription
  if (event.event_type === "transaction.completed") {
    const tx = event.data as {
      id?: string;
      custom_data?: Record<string, string>;
      customer?: { email?: string };
      details?: { totals?: { grand_total?: string } };
    };
    const m = tx.custom_data ?? {};
    const email = tx.customer?.email;
    const amountCents = parseInt(tx.details?.totals?.grand_total ?? "0", 10);

    if (email && m.tierId) {
      provisionSubscription({
        email,
        tierId: m.tierId as TierId,
        period: (m.period as BillingPeriod) || "monthly",
        seats: m.seats ? parseInt(m.seats, 10) : 1,
        modules: m.modules ? m.modules.split(",").filter(Boolean) : [],
        trialDays: m.trialDays ? parseInt(m.trialDays, 10) : 0,
        amountUsd: amountCents / 100,
        promoCode: m.promoCode || undefined,
        paddleTransactionId: tx.id,
        source: "paddle_webhook",
      }).then((r) => {
        console.log(`[provisioning] paddle tx=${tx.id} tier=${r.subscription.tierId} email=${email}`);
      }).catch((e) => console.error("[provisioning] failed", e));
    }
  } else if (event.event_type === "subscription.activated" || event.event_type === "subscription.updated") {
    console.log(`[checkout/webhook] ${event.event_type}`, (event.data as { id?: string }).id);
  }

  res.json({ received: true, provider: "paddle" });
});

// ── GET /subscriptions/count ──────────────────────────────────────────────────
checkoutRouter.get("/subscriptions/count", (_req, res) => {
  res.json({ total: countSubscriptions() });
});

// ── GET /healthz ──────────────────────────────────────────────────────────────
checkoutRouter.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    mode: PADDLE_KEY() ? "real" : "stub",
    provider: "paddle",
    sandbox: IS_PADDLE_SANDBOX(),
    webhookConfigured: !!PADDLE_WEBHOOK_SECRET(),
    frontendUrl: FRONTEND_URL,
  });
});
