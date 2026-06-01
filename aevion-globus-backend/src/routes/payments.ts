import { Router } from "express";
import { verifyBearerOptional } from "../lib/authJwt";
import { gumroadPaymentProvider } from "../lib/payment/gumroadProvider";

export const paymentsRouter = Router();

const GUMROAD_TOKEN = () => process.env.GUMROAD_ACCESS_TOKEN?.trim() || "";
const PAYBOX_MERCHANT = () => process.env.PAYBOX_MERCHANT_ID?.trim() || "";
const PAYBOX_SECRET = () => process.env.PAYBOX_SECRET_KEY?.trim() || "";

/** A Gumroad checkout is "real" only when a product permalink is configured. */
function gumroadConfigured(reference: string): boolean {
  const envKey = `GUMROAD_PERMALINK_${reference.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  return Boolean(process.env[envKey] || process.env.GUMROAD_DEFAULT_PERMALINK);
}

/* ═══ Plans definition ═══ */

const PLANS = [
  { id: "free", name: "Free", price: 0, currency: "usd", interval: "month", features: ["5 QCoreAI runs/day", "3 DevHub projects", "1 GB QMedia storage", "Basic analytics"] },
  { id: "pro", name: "Pro", price: 1900, currency: "usd", interval: "month", reference: "tier_pro_monthly", permalink: process.env.GUMROAD_PERMALINK_TIER_PRO_MONTHLY, features: ["Unlimited QCoreAI runs", "Unlimited DevHub projects", "50 GB QMedia storage", "AI Memory", "Priority support", "Advanced analytics", "API keys", "Organizations"] },
  { id: "enterprise", name: "Enterprise", price: 9900, currency: "usd", interval: "month", reference: "tier_business_monthly", permalink: process.env.GUMROAD_PERMALINK_TIER_BUSINESS_MONTHLY, features: ["Everything in Pro", "Custom AI models", "SLA 99.9%", "Dedicated support", "Custom integrations", "On-premise option"] },
];

/* ═══ Gumroad (only KYC-cleared processor; Stripe/Paddle blocked) ═══ */

paymentsRouter.get("/gumroad/config", (_req, res) => {
  res.json({
    configured: Boolean(GUMROAD_TOKEN()),
    provider: "gumroad",
  });
});

paymentsRouter.get("/gumroad/plans", (_req, res) => {
  res.json({ plans: PLANS });
});

// Build a Gumroad checkout URL for an ad-hoc amount. Gumroad price is fixed in
// the product, so `amount` is informational; we route by `reference` (→ permalink
// via GUMROAD_PERMALINK_<REFERENCE>). Stub when no permalink is configured.
paymentsRouter.post("/gumroad/create-transaction", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { amount, currency = "USD", description, reference = "default", email } = req.body || {};
    if (!amount || typeof amount !== "number" || amount < 50) {
      return res.status(400).json({ error: "amount required (min 50 cents)" });
    }

    if (!gumroadConfigured(String(reference))) {
      return res.json({
        checkoutUrl: `https://app.gumroad.com/l/stub?amount=${amount}`,
        intentId: `gumroad_stub_${auth.sub.slice(0, 8)}`,
        mode: "stub",
        provider: "gumroad",
      });
    }

    const intent = await gumroadPaymentProvider.createIntent({
      reference: String(reference),
      amountCents: Math.round(amount),
      currency: String(currency).toUpperCase().slice(0, 3),
      description: (description || "AEVION Payment").slice(0, 200),
      email: email ? String(email) : null,
    });

    res.json({
      checkoutUrl: intent.checkoutUrl,
      intentId: intent.intentId,
      provider: "gumroad",
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "create transaction failed" });
  }
});

paymentsRouter.post("/gumroad/create-subscription", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { reference, email } = req.body || {};
    if (!reference) return res.status(400).json({ error: "reference required (e.g. tier_pro_monthly; see /api/payments/gumroad/plans)" });

    if (!gumroadConfigured(String(reference))) {
      return res.json({ checkoutUrl: `https://app.gumroad.com/l/stub?ref=${reference}`, mode: "stub", provider: "gumroad" });
    }

    const intent = await gumroadPaymentProvider.createIntent({
      reference: String(reference),
      amountCents: 0,
      currency: "USD",
      description: `AEVION membership (${reference})`,
      email: email ? String(email) : null,
    });
    res.json({
      checkoutUrl: intent.checkoutUrl,
      intentId: intent.intentId,
      provider: "gumroad",
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "create subscription failed" });
  }
});

/* ═══ Legacy aliases (Stripe & Paddle removed — both KYC-blocked) ═══ */

paymentsRouter.get("/stripe/config", (_req, res) => {
  res.json({ configured: false, migrated: true, provider: "gumroad", message: "Stripe removed — use /api/payments/gumroad/*" });
});
paymentsRouter.get("/stripe/plans", (_req, res) => res.redirect("/api/payments/gumroad/plans"));
paymentsRouter.get("/paddle/config", (_req, res) => {
  res.json({ configured: false, migrated: true, provider: "gumroad", message: "Paddle removed (KYC blocked) — use /api/payments/gumroad/*" });
});
paymentsRouter.get("/paddle/plans", (_req, res) => res.redirect("/api/payments/gumroad/plans"));
paymentsRouter.post("/stripe/create-payment-intent", (_req, res) => {
  res.status(410).json({ error: "Stripe removed — use POST /api/payments/gumroad/create-transaction" });
});
paymentsRouter.post("/stripe/create-subscription", (_req, res) => {
  res.status(410).json({ error: "Stripe removed — use POST /api/payments/gumroad/create-subscription" });
});
paymentsRouter.post("/paddle/create-transaction", (_req, res) => {
  res.status(410).json({ error: "Paddle removed (KYC blocked) — use POST /api/payments/gumroad/create-transaction" });
});
paymentsRouter.post("/paddle/create-subscription", (_req, res) => {
  res.status(410).json({ error: "Paddle removed (KYC blocked) — use POST /api/payments/gumroad/create-subscription" });
});

/* ═══ PayBox (Kazakhstan) ═══ */

paymentsRouter.get("/paybox/config", (_req, res) => {
  res.json({ merchantId: PAYBOX_MERCHANT() || null, configured: Boolean(PAYBOX_MERCHANT()), testMode: true, supportedCurrencies: ["KZT", "RUB", "USD"] });
});

paymentsRouter.post("/paybox/init", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { amount, currency, description } = req.body || {};
    if (!amount || typeof amount !== "number") return res.status(400).json({ error: "amount required" });
    const orderId = `aevion-${Date.now()}-${auth.sub.slice(0, 8)}`;
    if (!PAYBOX_MERCHANT()) {
      return res.json({ paymentUrl: `https://api.paybox.money/stub?order=${orderId}&amount=${amount}`, orderId, amount, currency: currency || "KZT", mode: "stub" });
    }
    const params: Record<string, string> = {
      pg_merchant_id: PAYBOX_MERCHANT(),
      pg_amount: String(amount),
      pg_description: description ? String(description).slice(0, 255) : "AEVION payment",
      pg_order_id: orderId,
      pg_currency: String(currency || "KZT"),
      pg_testing_mode: "1",
      pg_salt: Math.random().toString(36).slice(2),
      pg_result_url: `${process.env.BACKEND_URL || "https://api.aevion.app"}/api/payments/paybox/callback`,
    };
    const sorted = Object.keys(params).sort().map(k => params[k]).join(";");
    params.pg_sig = require("crypto").createHash("md5").update(`payment.php;${sorted};${PAYBOX_SECRET()}`).digest("hex");
    const formBody = new URLSearchParams(params).toString();
    const r = await fetch("https://api.paybox.money/payment.php", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: formBody });
    const text = await r.text();
    const urlMatch = text.match(/<pg_redirect_url>(.*?)<\/pg_redirect_url>/);
    if (urlMatch?.[1]) return res.json({ paymentUrl: urlMatch[1], orderId, amount });
    res.json({ paymentUrl: `https://api.paybox.money/stubpay?order=${orderId}`, orderId, amount, mode: "fallback" });
  } catch { res.status(500).json({ error: "paybox init failed" }); }
});

paymentsRouter.post("/paybox/callback", (_req, res) => {
  res.setHeader("Content-Type", "text/xml");
  res.send(`<?xml version="1.0" encoding="utf-8"?><response><pg_status>ok</pg_status></response>`);
});

paymentsRouter.get("/paybox/status/:orderId", (req, res) => {
  res.json({ orderId: req.params.orderId, status: "pending", amount: null });
});

/* ═══ Kaspi ═══ */

paymentsRouter.get("/kaspi/config", (_req, res) => {
  res.json({ configured: false, comingSoon: true, info: "Kaspi Pay requires a merchant agreement. Contact partners@aevion.app" });
});

/* ═══ General ═══ */

paymentsRouter.get("/health", (_req, res) => {
  res.json({
    gumroad: { configured: Boolean(GUMROAD_TOKEN()), primary: true },
    paybox: { configured: Boolean(PAYBOX_MERCHANT()) },
    kaspi: { configured: false },
    paddle: { configured: false, migrated: true },
    stripe: { configured: false, migrated: true },
  });
});

paymentsRouter.get("/currencies", (_req, res) => {
  res.json({ currencies: [
    { code: "USD", name: "US Dollar", symbol: "$" },
    { code: "KZT", name: "Kazakhstani Tenge", symbol: "₸" },
    { code: "RUB", name: "Russian Ruble", symbol: "₽" },
    { code: "EUR", name: "Euro", symbol: "€" },
  ]});
});
