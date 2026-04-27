import { Router } from "express";
import Stripe from "stripe";
import { TIERS, MODULES_PRICING, getTier, getModulePrice, resolvePromoCode, type TierId, type BillingPeriod } from "../data/pricing";
import { provisionSubscription, countSubscriptions } from "./provisioning";

export const checkoutRouter = Router();

/**
 * Stripe Checkout с graceful stub-fallback.
 *
 * Если STRIPE_SECRET_KEY задан — создаём реальную checkout-session.
 * Если нет — возвращаем stub-ссылку на /pricing/checkout/success?stub=true,
 * чтобы UX-flow можно было прокликать без реальных ключей.
 *
 * Это тот же паттерн, что у QCoreAI (OpenAI key → real, нет → stub).
 */

const SK = process.env.STRIPE_SECRET_KEY?.trim();
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET?.trim();
const FRONTEND_URL = process.env.FRONTEND_URL?.trim() || "http://localhost:3000";

const stripe = SK ? new Stripe(SK, { apiVersion: "2026-04-22.dahlia" }) : null;

interface CheckoutBody {
  tierId: TierId;
  modules?: string[];
  seats?: number;
  period?: BillingPeriod;
  email?: string;
  promoCode?: string;
  trial?: boolean;
}

/**
 * POST /api/pricing/checkout/session
 * Body: { tierId, modules?, seats?, period?, email? }
 *
 * Возвращает: { url, mode: 'real' | 'stub', sessionId? }
 *
 * Free и Enterprise — отдельные сценарии: free создаёт фейковый success,
 * enterprise редиректит на /pricing/contact (нет self-service).
 */
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
      // Free — сразу к success без оплаты
      return res.json({
        url: `${FRONTEND_URL}/pricing/checkout/success?stub=true&tier=free`,
        mode: "stub",
      });
    }

    if (tier.id === "enterprise") {
      // Enterprise — никакого self-service, направляем в форму
      return res.json({
        url: `${FRONTEND_URL}/pricing/contact?tier=enterprise`,
        mode: "stub",
      });
    }

    // Считаем сумму в центах (для Stripe — int)
    const tierUsd = period === "annual"
      ? (tier.priceAnnualTotal ?? 0)
      : (tier.priceMonthly ?? 0);

    const lineItems: Array<{
      name: string;
      description?: string;
      amountCents: number;
      qty: number;
    }> = [];

    if (tierUsd > 0) {
      lineItems.push({
        name: `AEVION ${tier.name}`,
        description:
          period === "annual"
            ? `Годовая подписка (12 мес, экономия 16%)`
            : `Месячная подписка`,
        amountCents: Math.round(tierUsd * 100),
        qty: 1,
      });
    }

    // Доп seats (поверх базовых лимитов)
    const baseSeats = tier.limits.seats ?? 1;
    const extraSeats = Math.max(0, seats - baseSeats);
    if (extraSeats > 0) {
      lineItems.push({
        name: `Дополнительные пользователи`,
        description: `${extraSeats} × $5/мес${period === "annual" ? " × 12 мес" : ""}`,
        amountCents: 5 * 100 * (period === "annual" ? 12 : 1),
        qty: extraSeats,
      });
    }

    // Add-on модули
    for (const mid of body.modules ?? []) {
      const m = getModulePrice(mid);
      if (!m || m.includedIn.includes(tier.id)) continue;
      if (m.addonMonthly === null || m.addonMonthly === 0) continue;
      lineItems.push({
        name: `Модуль ${m.id}`,
        description: m.oneLiner,
        amountCents: m.addonMonthly * 100 * (period === "annual" ? 12 : 1),
        qty: 1,
      });
    }

    if (lineItems.length === 0) {
      return res.status(400).json({ error: "empty_cart" });
    }

    // Promo-код: применяется как отрицательная line item, чтобы Stripe видел итог
    let promoLine: { name: string; description: string; amountCents: number; qty: number } | null = null;
    if (body.promoCode) {
      const { promo } = resolvePromoCode(body.promoCode, tier.id);
      if (promo) {
        const subtotalCents = lineItems.reduce((s, l) => s + l.amountCents * l.qty, 0);
        const promoCents =
          promo.kind === "percent"
            ? Math.round((subtotalCents * promo.amount) / 100)
            : Math.min(subtotalCents, promo.amount * 100 * (period === "annual" ? 12 : 1));
        // Stripe не принимает отрицательные line items в Checkout — используем coupon
        promoLine = {
          name: `Промо ${promo.code}`,
          description: promo.description,
          amountCents: -promoCents,
          qty: 1,
        };
      }
    }

    const trialDays = body.trial && (tier.id === "pro" || tier.id === "business") ? 14 : 0;

    // Stub-fallback: нет ключа Stripe — эмулируем checkout
    if (!stripe) {
      let total = lineItems.reduce((s, l) => s + l.amountCents * l.qty, 0);
      if (promoLine) total = Math.max(0, total + promoLine.amountCents * promoLine.qty);
      const trialQs = trialDays > 0 ? `&trial=${trialDays}` : "";

      // Если email указан — сразу провизим подписку (для smoke-flow без webhook'a)
      if (body.email) {
        provisionSubscription({
          email: body.email,
          tierId: tier.id,
          period,
          seats,
          modules: body.modules ?? [],
          trialDays,
          amountUsd: total / 100,
          promoCode: body.promoCode,
          source: "stub_checkout",
        }).catch((e) => console.error("[stub_provisioning] failed", e));
      }

      return res.json({
        url: `${FRONTEND_URL}/pricing/checkout/success?stub=true&tier=${tier.id}&period=${period}&total=${total}${trialQs}`,
        mode: "stub",
        lineItems,
        promo: promoLine,
        trialDays: trialDays || undefined,
      });
    }

    // Реальный Stripe Checkout. Promo конвертируется в Stripe coupon на лету.
    let discounts: Array<{ coupon: string }> | undefined;
    if (promoLine) {
      const coupon = await stripe.coupons.create({
        amount_off: -promoLine.amountCents,
        currency: "usd",
        name: promoLine.name,
        duration: "once",
      });
      discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems.map((l) => ({
        price_data: {
          currency: "usd",
          unit_amount: l.amountCents,
          product_data: {
            name: l.name,
            ...(l.description ? { description: l.description } : {}),
          },
        },
        quantity: l.qty,
      })),
      ...(discounts ? { discounts } : { allow_promotion_codes: true }),
      success_url: `${FRONTEND_URL}/pricing/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/pricing/checkout/cancel?tier=${tier.id}`,
      customer_email: body.email,
      metadata: {
        tierId: tier.id,
        period,
        seats: String(seats),
        modules: (body.modules ?? []).join(","),
        promoCode: body.promoCode ?? "",
        trialDays: String(trialDays),
      },
    });

    res.json({
      url: session.url,
      mode: "real",
      sessionId: session.id,
    });
  } catch (e: unknown) {
    console.error("[checkout/session] failed", e);
    res.status(500).json({
      error: "checkout_failed",
      message: e instanceof Error ? e.message : String(e),
    });
  }
});

/**
 * POST /api/pricing/checkout/webhook
 * Stripe → AEVION webhook (raw body required для verifySignature).
 *
 * В реальном проекте: подключить provisioning (создать аккаунт, активировать тариф,
 * выслать welcome-email, добавить в реестр QRight).
 * Сейчас — только логируем event и подтверждаем 200.
 */
checkoutRouter.post("/webhook", (req, res) => {
  if (!stripe || !WEBHOOK_SECRET) {
    // В stub-режиме принимаем что угодно для smoke-тестов
    console.log("[checkout/webhook] STUB mode — event accepted without verification");
    return res.json({ received: true, mode: "stub" });
  }

  const sig = req.headers["stripe-signature"] as string | undefined;
  if (!sig) {
    return res.status(400).json({ error: "missing_signature" });
  }

  // Stripe SDK 22 namespace типы не reach-abble через default import, поэтому
  // используем минимальную структурную типизацию для нужных нам полей.
  let event: {
    type: string;
    data: { object: { id?: string; metadata?: Record<string, string>; amount_total?: number | null } };
  };
  try {
    event = stripe.webhooks.constructEvent(
      (req as unknown as { rawBody?: Buffer }).rawBody ?? JSON.stringify(req.body),
      sig,
      WEBHOOK_SECRET,
    ) as typeof event;
  } catch (e) {
    console.error("[checkout/webhook] signature verification failed", e);
    return res.status(400).json({ error: "invalid_signature" });
  }

  // Webhook handler — асинхронный provisioning. Stripe ожидает 200 в течение 30s,
  // поэтому fire-and-forget: ack сразу, провайдинг — в фоне.
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as unknown as {
      id: string;
      customer_email?: string | null;
      customer_details?: { email?: string | null };
      amount_total?: number | null;
      metadata?: Record<string, string>;
    };
    const email = session.customer_email || session.customer_details?.email;
    const m = session.metadata ?? {};
    if (email && m.tierId) {
      provisionSubscription({
        email,
        tierId: m.tierId as TierId,
        period: (m.period as BillingPeriod) || "monthly",
        seats: m.seats ? parseInt(m.seats, 10) : 1,
        modules: m.modules ? m.modules.split(",").filter(Boolean) : [],
        trialDays: m.trialDays ? parseInt(m.trialDays, 10) : 0,
        amountUsd: session.amount_total ? session.amount_total / 100 : undefined,
        promoCode: m.promoCode || undefined,
        stripeSessionId: session.id,
        source: "stripe_webhook",
      })
        .then((r) => {
          console.log(
            `[provisioning] subscription=${r.subscription.id} tier=${r.subscription.tierId} email_${r.emailMode}=${r.emailSent}${r.emailError ? " err=" + r.emailError : ""}`,
          );
        })
        .catch((e) => console.error("[provisioning] failed", e));
    } else {
      console.warn("[checkout/webhook] session.completed without email or tier", session.id);
    }
  } else if (event.type === "checkout.session.expired") {
    console.log("[checkout/webhook] session.expired", event.data.object.id);
  }

  res.json({ received: true });
});

/**
 * GET /api/pricing/checkout/subscriptions/count
 * Счётчик активированных подписок — открыто (не PII).
 */
checkoutRouter.get("/subscriptions/count", (_req, res) => {
  res.json({ total: countSubscriptions() });
});

/**
 * GET /api/pricing/checkout/healthz
 * Видимость режима для CI/UI: real/stub + наличие webhook secret.
 */
checkoutRouter.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    mode: stripe ? "real" : "stub",
    webhookConfigured: !!WEBHOOK_SECRET,
    frontendUrl: FRONTEND_URL,
  });
});
