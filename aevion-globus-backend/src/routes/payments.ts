import { Router } from "express";
import { verifyBearerOptional } from "../lib/authJwt";

export const paymentsRouter = Router();

const STRIPE_KEY = () => process.env.STRIPE_SECRET_KEY?.trim() || "";
const PAYBOX_MERCHANT = () => process.env.PAYBOX_MERCHANT_ID?.trim() || "";
const PAYBOX_SECRET = () => process.env.PAYBOX_SECRET_KEY?.trim() || "";

/* ═══ Plans definition ═══ */

const PLANS = [
  { id: "free", name: "Free", price: 0, currency: "usd", interval: "month", features: ["5 QCoreAI runs/day", "3 DevHub projects", "1 GB QMedia storage", "Basic analytics"] },
  { id: "pro", name: "Pro", price: 1900, currency: "usd", interval: "month", features: ["Unlimited QCoreAI runs", "Unlimited DevHub projects", "50 GB QMedia storage", "AI Memory", "Priority support", "Advanced analytics", "API keys", "Organizations"] },
  { id: "enterprise", name: "Enterprise", price: 9900, currency: "usd", interval: "month", features: ["Everything in Pro", "Custom AI models", "SLA 99.9%", "Dedicated support", "Custom integrations", "On-premise option"] },
];

/* ═══ Stripe ═══ */

paymentsRouter.get("/stripe/config", (_req, res) => {
  const key = STRIPE_KEY();
  res.json({
    publishableKey: key ? (key.replace(/^sk_/, "pk_").replace(/_[a-zA-Z0-9]+$/, "_...")) : null,
    testMode: key.startsWith("sk_test_"),
    configured: Boolean(key),
  });
});

paymentsRouter.get("/stripe/plans", (_req, res) => {
  res.json({ plans: PLANS });
});

paymentsRouter.post("/stripe/create-payment-intent", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { amount, currency, description } = req.body || {};
    if (!amount || typeof amount !== "number" || amount < 50) return res.status(400).json({ error: "amount required (min 50 cents)" });
    const key = STRIPE_KEY();
    if (!key) {
      return res.json({ clientSecret: "pi_test_stub_secret", paymentIntentId: "pi_test_stub", amount, currency: currency || "usd", mode: "stub" });
    }
    const params = new URLSearchParams({
      amount: String(Math.round(amount)),
      currency: String(currency || "usd"),
      "automatic_payment_methods[enabled]": "true",
      ...(description ? { description: String(description).slice(0, 500) } : {}),
    });
    const r = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(400).json({ error: (err as any)?.error?.message || "Stripe error" });
    }
    const pi = await r.json() as any;
    res.json({ clientSecret: pi.client_secret, paymentIntentId: pi.id, amount: pi.amount, currency: pi.currency });
  } catch { res.status(500).json({ error: "create payment intent failed" }); }
});

paymentsRouter.post("/stripe/create-subscription", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { priceId } = req.body || {};
    if (!priceId) return res.status(400).json({ error: "priceId required" });
    const key = STRIPE_KEY();
    if (!key) {
      return res.json({ subscriptionId: "sub_test_stub", status: "active", clientSecret: "seti_test_stub_secret", mode: "stub" });
    }
    res.json({ subscriptionId: "sub_pending", status: "incomplete", clientSecret: null, message: "Full subscription flow requires Stripe customer setup" });
  } catch { res.status(500).json({ error: "create subscription failed" }); }
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

paymentsRouter.post("/paybox/callback", async (req, res) => {
  res.setHeader("Content-Type", "text/xml");
  res.send(`<?xml version="1.0" encoding="utf-8"?><response><pg_status>ok</pg_status></response>`);
});

paymentsRouter.get("/paybox/status/:orderId", async (req, res) => {
  res.json({ orderId: req.params.orderId, status: "pending", amount: null });
});

/* ═══ Kaspi ═══ */

paymentsRouter.get("/kaspi/config", (_req, res) => {
  res.json({ configured: false, comingSoon: true, info: "Kaspi Pay requires a merchant agreement. Contact partners@aevion.app" });
});

/* ═══ General ═══ */

paymentsRouter.get("/health", (_req, res) => {
  res.json({
    stripe: { configured: Boolean(STRIPE_KEY()), testMode: STRIPE_KEY().startsWith("sk_test_") },
    paybox: { configured: Boolean(PAYBOX_MERCHANT()) },
    kaspi: { configured: false },
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
