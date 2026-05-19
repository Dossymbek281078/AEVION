import { Router } from "express";
import { verifyBearerOptional } from "../lib/authJwt";

export const paymentsRouter = Router();

const PADDLE_KEY = () => process.env.PADDLE_API_KEY?.trim() || "";
const PADDLE_SANDBOX = () => process.env.PADDLE_SANDBOX !== "false";
const PADDLE_BASE = () => PADDLE_SANDBOX() ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";
const PAYBOX_MERCHANT = () => process.env.PAYBOX_MERCHANT_ID?.trim() || "";
const PAYBOX_SECRET = () => process.env.PAYBOX_SECRET_KEY?.trim() || "";

/* ═══ Plans definition ═══ */

const PLANS = [
  { id: "free", name: "Free", price: 0, currency: "usd", interval: "month", features: ["5 QCoreAI runs/day", "3 DevHub projects", "1 GB QMedia storage", "Basic analytics"] },
  { id: "pro", name: "Pro", price: 1900, currency: "usd", interval: "month", priceId: process.env.PADDLE_PRICE_PRO_MONTHLY, features: ["Unlimited QCoreAI runs", "Unlimited DevHub projects", "50 GB QMedia storage", "AI Memory", "Priority support", "Advanced analytics", "API keys", "Organizations"] },
  { id: "enterprise", name: "Enterprise", price: 9900, currency: "usd", interval: "month", priceId: process.env.PADDLE_PRICE_BIZ_MONTHLY, features: ["Everything in Pro", "Custom AI models", "SLA 99.9%", "Dedicated support", "Custom integrations", "On-premise option"] },
];

/* ═══ Paddle ═══ */

paymentsRouter.get("/paddle/config", (_req, res) => {
  res.json({
    configured: Boolean(PADDLE_KEY()),
    sandbox: PADDLE_SANDBOX(),
    provider: "paddle",
  });
});

paymentsRouter.get("/paddle/plans", (_req, res) => {
  res.json({ plans: PLANS });
});

paymentsRouter.post("/paddle/create-transaction", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { amount, currency = "USD", description, priceId, successUrl } = req.body || {};
    if (!amount || typeof amount !== "number" || amount < 50) {
      return res.status(400).json({ error: "amount required (min 50 cents)" });
    }

    if (!PADDLE_KEY()) {
      return res.json({
        checkoutUrl: `https://buy.paddle.com/stub?amount=${amount}`,
        transactionId: `txn_stub_${Date.now()}`,
        mode: "stub",
      });
    }

    const body: Record<string, unknown> = priceId
      ? { items: [{ price_id: priceId, quantity: 1 }] }
      : {
          items: [{
            quantity: 1,
            price: {
              name: (description || "AEVION Payment").slice(0, 200),
              unit_price: { amount: String(Math.round(amount)), currency_code: String(currency).toUpperCase().slice(0, 3) },
              tax_mode: "exclusive",
            },
          }],
        };

    if (successUrl) (body as any).checkout = { url: successUrl };

    const r = await fetch(`${PADDLE_BASE()}/transactions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${PADDLE_KEY()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(400).json({ error: (err as any)?.error?.detail || "Paddle error" });
    }
    const data = await r.json() as { data?: { id: string; checkout?: { url: string } } };
    const tx = data.data;
    if (!tx?.id) return res.status(500).json({ error: "no transaction id from Paddle" });

    res.json({
      checkoutUrl: tx.checkout?.url ?? `${PADDLE_BASE().replace("api.", "")}/checkout/${tx.id}`,
      transactionId: tx.id,
      provider: "paddle",
      sandbox: PADDLE_SANDBOX(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "create transaction failed" });
  }
});

paymentsRouter.post("/paddle/create-subscription", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { priceId, email, successUrl } = req.body || {};
    if (!priceId) return res.status(400).json({ error: "priceId required (get from /api/payments/paddle/plans)" });

    if (!PADDLE_KEY()) {
      return res.json({ checkoutUrl: `https://buy.paddle.com/stub?price=${priceId}`, mode: "stub" });
    }

    const body: Record<string, unknown> = {
      items: [{ price_id: priceId, quantity: 1 }],
      ...(email ? { customer: { email } } : {}),
      ...(successUrl ? { checkout: { url: successUrl } } : {}),
    };

    const r = await fetch(`${PADDLE_BASE()}/transactions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${PADDLE_KEY()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(400).json({ error: (err as any)?.error?.detail || "Paddle error" });
    }
    const data = await r.json() as { data?: { id: string; checkout?: { url: string } } };
    const tx = data.data;
    res.json({
      checkoutUrl: tx?.checkout?.url ?? null,
      transactionId: tx?.id,
      provider: "paddle",
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "create subscription failed" });
  }
});

/* ═══ Legacy Stripe aliases (redirect to Paddle) ═══ */

paymentsRouter.get("/stripe/config", (_req, res) => {
  res.json({ configured: false, migrated: true, provider: "paddle", message: "Stripe removed — use /api/payments/paddle/*" });
});
paymentsRouter.get("/stripe/plans", (_req, res) => res.redirect("/api/payments/paddle/plans"));
paymentsRouter.post("/stripe/create-payment-intent", (_req, res) => {
  res.status(410).json({ error: "Stripe removed — use POST /api/payments/paddle/create-transaction" });
});
paymentsRouter.post("/stripe/create-subscription", (_req, res) => {
  res.status(410).json({ error: "Stripe removed — use POST /api/payments/paddle/create-subscription" });
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
    paddle: { configured: Boolean(PADDLE_KEY()), sandbox: PADDLE_SANDBOX() },
    paybox: { configured: Boolean(PAYBOX_MERCHANT()) },
    kaspi: { configured: false },
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
