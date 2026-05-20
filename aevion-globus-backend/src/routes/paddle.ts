/**
 * AEVION — Paddle Billing v2 integration
 *
 * Замена Stripe для казахстанских и международных платежей.
 * Paddle = Merchant of Record → они платят налоги, ты получаешь выплаты на KZ банк.
 *
 * Sandbox:    sandbox-api.paddle.com  (PADDLE_SANDBOX=true)
 * Production: api.paddle.com
 *
 * ENV:
 *   PADDLE_API_KEY         — secret key из Paddle dashboard → Developer → API keys
 *   PADDLE_WEBHOOK_SECRET  — из Paddle dashboard → Notifications → endpoint secret
 *   PADDLE_SANDBOX         — "true" для тестовой среды (по умолчанию true пока не задано)
 *
 * Все запросы graceful-stub при отсутствии PADDLE_API_KEY.
 */

import { Router } from "express";
import crypto from "crypto";
import { provisionSubscription } from "./provisioning";
import type { TierId, BillingPeriod } from "../data/pricing";
// paddleClient exports are re-used below; local helpers kept for backward compat

export const paddleRouter = Router();

// ─── ENV ─────────────────────────────────────────────────────────────────────

const PADDLE_KEY = () => process.env.PADDLE_API_KEY?.trim() || "";
const PADDLE_WEBHOOK_SECRET = () => process.env.PADDLE_WEBHOOK_SECRET?.trim() || "";
const IS_SANDBOX = () => process.env.PADDLE_SANDBOX !== "false"; // sandbox by default
const BASE_URL = () =>
  IS_SANDBOX()
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";
const FRONTEND_URL = () =>
  process.env.FRONTEND_URL?.trim() || "http://localhost:3000";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function paddleGet(path: string): Promise<unknown | null> {
  const key = PADDLE_KEY();
  if (!key) return null;
  try {
    const r = await fetch(`${BASE_URL()}${path}`, {
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    });
    if (!r.ok) {
      console.error("[paddle]", r.status, await r.text().catch(() => ""));
      return null;
    }
    return await r.json();
  } catch (e) {
    console.error("[paddle] GET failed", e);
    return null;
  }
}

async function paddlePost(path: string, body: unknown): Promise<unknown | null> {
  const key = PADDLE_KEY();
  if (!key) return null;
  try {
    const r = await fetch(`${BASE_URL()}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      console.error("[paddle]", r.status, await r.text().catch(() => ""));
      return null;
    }
    return await r.json();
  } catch (e) {
    console.error("[paddle] POST failed", e);
    return null;
  }
}

/** Проверяет подпись Paddle webhook (HMAC-SHA256) */
function verifyPaddleSignature(
  rawBody: Buffer | string,
  signatureHeader: string,
  secret: string,
): boolean {
  try {
    // format: ts=1234567890;h1=<hex>
    const parts = Object.fromEntries(
      signatureHeader.split(";").map((p) => p.split("=")),
    );
    const ts = parts["ts"];
    const h1 = parts["h1"];
    if (!ts || !h1) return false;
    const payload = `${ts}:${typeof rawBody === "string" ? rawBody : rawBody.toString("utf8")}`;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
    return crypto.timingSafeEqual(
      Buffer.from(h1, "hex"),
      Buffer.from(expected, "hex"),
    );
  } catch {
    return false;
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /api/paddle/health
 * Проверяет конфигурацию и доступность Paddle API.
 */
paddleRouter.get("/health", async (_req, res) => {
  const key = PADDLE_KEY();
  if (!key) {
    return res.json({
      configured: false,
      sandbox: IS_SANDBOX(),
      message: "PADDLE_API_KEY not set. Get it: paddle.com → Developer → Authentication",
    });
  }
  const data = await paddleGet("/customers?per_page=1") as { data?: unknown[] } | null;
  res.json({
    configured: true,
    sandbox: IS_SANDBOX(),
    baseUrl: BASE_URL(),
    webhookConfigured: Boolean(PADDLE_WEBHOOK_SECRET()),
    apiReachable: data !== null,
  });
});

/**
 * GET /api/paddle/plans
 * Список тарифов AEVION с Paddle Price IDs — для фронтенда.
 */
paddleRouter.get("/plans", (_req, res) => {
  const { PADDLE_PLANS } = require("../data/paddlePrices");
  res.json({ plans: PADDLE_PLANS, sandbox: IS_SANDBOX() });
});

/**
 * GET /api/paddle/products
 * Список продуктов/цен из Paddle dashboard.
 */
paddleRouter.get("/products", async (_req, res) => {
  if (!PADDLE_KEY()) {
    return res.json({ stub: true, products: [], message: "PADDLE_API_KEY not set" });
  }
  const data = await paddleGet("/products?include=prices&status=active") as {
    data?: {
      id: string; name: string; description?: string; status: string;
      prices?: { id: string; unit_price: { amount: string; currency_code: string }; billing_cycle?: { interval: string; frequency: number } }[];
    }[];
  } | null;
  if (!data) return res.status(502).json({ error: "paddle_api_error" });
  res.json({ products: data.data ?? [], sandbox: IS_SANDBOX() });
});

/**
 * POST /api/paddle/checkout
 * Создаёт Paddle Transaction → возвращает checkout URL.
 *
 * Body: {
 *   priceId: string,        // Paddle Price ID (pri_xxx из dashboard)
 *   quantity?: number,
 *   email?: string,
 *   appId?: string,         // для атрибуции по приложению
 *   tierId?: string,
 *   successUrl?: string,
 * }
 */
paddleRouter.post("/checkout", async (req, res) => {
  const { priceId, quantity = 1, email, appId, tierId, successUrl } = req.body || {};

  if (!priceId) {
    return res.status(400).json({ error: "priceId required (get from /api/paddle/products)" });
  }

  // Stub-режим: нет ключа
  if (!PADDLE_KEY()) {
    const stubUrl = `${FRONTEND_URL()}/pricing/checkout/success?stub=true&provider=paddle&appId=${appId || "platform"}`;
    return res.json({
      mode: "stub",
      url: stubUrl,
      message: "PADDLE_API_KEY not set — stub checkout",
    });
  }

  const txBody: Record<string, unknown> = {
    items: [{ price_id: priceId, quantity }],
    checkout: {
      url: successUrl || `${FRONTEND_URL()}/pricing/checkout/success`,
    },
    custom_data: {
      app_id: appId || "platform",
      tier_id: tierId || "",
    },
  };

  if (email) {
    // Найти или создать customer
    const existing = await paddleGet(
      `/customers?email=${encodeURIComponent(email)}&per_page=1`,
    ) as { data?: { id: string }[] } | null;
    const customerId = existing?.data?.[0]?.id;

    if (customerId) {
      txBody.customer_id = customerId;
    } else {
      const newCustomer = await paddlePost("/customers", { email }) as { data?: { id: string } } | null;
      if (newCustomer?.data?.id) txBody.customer_id = newCustomer.data.id;
    }
  }

  const tx = await paddlePost("/transactions", txBody) as {
    data?: { id: string; checkout?: { url: string } };
  } | null;

  if (!tx?.data) {
    return res.status(502).json({ error: "paddle_transaction_failed" });
  }

  res.json({
    mode: "real",
    transactionId: tx.data.id,
    url: tx.data.checkout?.url ?? `${FRONTEND_URL()}/pricing/checkout/success?tx=${tx.data.id}`,
    sandbox: IS_SANDBOX(),
  });
});

/**
 * POST /api/paddle/webhook
 * Принимает Paddle события (subscription.activated, transaction.completed и т.д.)
 * Верифицирует подпись → провизионирует подписку.
 */
paddleRouter.post("/webhook", (req, res) => {
  const secret = PADDLE_WEBHOOK_SECRET();

  // Stub-режим — нет секрета
  if (!secret) {
    console.log("[paddle/webhook] no secret — accepting without verification (stub)");
    return res.json({ received: true, mode: "stub" });
  }

  const sig = req.headers["paddle-signature"] as string | undefined;
  if (!sig) return res.status(400).json({ error: "missing paddle-signature header" });

  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
  if (!rawBody) return res.status(400).json({ error: "raw body not available" });

  if (!verifyPaddleSignature(rawBody, sig, secret)) {
    console.error("[paddle/webhook] signature verification failed");
    return res.status(400).json({ error: "invalid_signature" });
  }

  const event = req.body as {
    event_type?: string;
    data?: {
      id?: string;
      customer_email?: string;
      custom_data?: Record<string, string>;
      status?: string;
      items?: { price?: { id: string; billing_cycle?: { interval: string } }; quantity?: number }[];
      total?: string;
    };
  };

  const et = event.event_type || "";
  console.log("[paddle/webhook] event:", et, event.data?.id);

  if (et === "transaction.completed" || et === "subscription.activated") {
    const d = event.data;
    const email = d?.customer_email;
    const custom = d?.custom_data ?? {};
    const tierId = (custom.tier_id || "pro") as TierId;
    const appId = custom.app_id || "platform";
    const item = d?.items?.[0];
    const interval = item?.price?.billing_cycle?.interval;
    const period: BillingPeriod = interval === "year" ? "annual" : "monthly";
    const amountUsd = d?.total ? parseFloat(d.total) / 100 : undefined;

    if (email && tierId) {
      provisionSubscription({
        email,
        tierId,
        period,
        seats: item?.quantity ?? 1,
        modules: [],
        trialDays: 0,
        amountUsd,
        source: `paddle_webhook_${et}`,
      })
        .then((r) => console.log(`[paddle/provisioning] ok tier=${r.subscription.tierId} app=${appId}`))
        .catch((e) => console.error("[paddle/provisioning] failed", e));
    }
  }

  res.json({ received: true });
});

/**
 * GET /api/paddle/subscription/:id
 * Статус подписки по Paddle subscription ID.
 */
paddleRouter.get("/subscription/:id", async (req, res) => {
  if (!PADDLE_KEY()) {
    return res.json({ stub: true, message: "PADDLE_API_KEY not set" });
  }
  const data = await paddleGet(`/subscriptions/${req.params.id}`) as { data?: unknown } | null;
  if (!data) return res.status(404).json({ error: "subscription_not_found" });
  res.json(data);
});

/**
 * GET /api/paddle/customer/:email
 * Найти customer по email.
 */
paddleRouter.get("/customer/:email", async (req, res) => {
  if (!PADDLE_KEY()) {
    return res.json({ stub: true, message: "PADDLE_API_KEY not set" });
  }
  const data = await paddleGet(
    `/customers?email=${encodeURIComponent(req.params.email)}&per_page=5`,
  ) as { data?: unknown[] } | null;
  if (!data) return res.status(502).json({ error: "paddle_api_error" });
  res.json({ customers: data.data ?? [] });
});

/**
 * GET /api/paddle/transactions
 * Последние транзакции (для Revenue Hub).
 */
paddleRouter.get("/transactions", async (req, res) => {
  if (!PADDLE_KEY()) {
    return res.json({ stub: true, transactions: [], message: "PADDLE_API_KEY not set" });
  }
  const limit = Math.min(50, parseInt(String(req.query.per_page || "20")));
  const data = await paddleGet(`/transactions?per_page=${limit}&order_by=id[DESC]`) as {
    data?: {
      id: string; status: string; customer_id?: string;
      custom_data?: Record<string, string>;
      total?: string; currency_code?: string;
      created_at?: string;
    }[];
  } | null;
  if (!data) return res.status(502).json({ error: "paddle_api_error" });

  const txs = (data.data ?? []).map((t) => ({
    id: t.id,
    appId: t.custom_data?.app_id || "platform",
    status: t.status,
    amountUsd: t.total ? parseFloat(t.total) / 100 : 0,
    currency: t.currency_code ?? "USD",
    createdAt: t.created_at,
  }));

  // group by appId
  const byApp: Record<string, { count: number; totalUsd: number }> = {};
  for (const t of txs) {
    if (t.status === "completed") {
      if (!byApp[t.appId]) byApp[t.appId] = { count: 0, totalUsd: 0 };
      byApp[t.appId].count++;
      byApp[t.appId].totalUsd += t.amountUsd;
    }
  }

  res.json({ transactions: txs, byApp, sandbox: IS_SANDBOX() });
});

/**
 * GET /api/paddle/setup-guide
 * Пошаговая инструкция по настройке Paddle для KZ.
 */
paddleRouter.get("/setup-guide", (_req, res) => {
  res.json({
    steps: [
      {
        step: 1,
        title: "Регистрация на Paddle",
        url: "https://paddle.com",
        instructions: [
          "Перейди на paddle.com → Get started",
          "Email + пароль — никакой US адрес не нужен на этом шаге",
          "Business type: Individual или Company",
          "Country: Kazakhstan",
        ],
      },
      {
        step: 2,
        title: "Получить API ключ",
        url: "https://sandbox-vendors.paddle.com/authentication",
        instructions: [
          "Dashboard → Developer → Authentication → Generate API Key",
          "Скопируй secret key (начинается с pdl_sdbx_ для sandbox)",
          "Добавь в Railway: PADDLE_API_KEY=pdl_sdbx_...",
          "Добавь в Railway: PADDLE_SANDBOX=true",
        ],
      },
      {
        step: 3,
        title: "Создать продукты и цены",
        url: "https://sandbox-vendors.paddle.com/catalog/products",
        instructions: [
          "Catalog → Products → New Product",
          "Для каждого AEVION тарифа (Pro $19/mo, Business $49/mo) создай Price",
          "Скопируй Price ID (pri_xxx) — нужен для /api/paddle/checkout",
        ],
      },
      {
        step: 4,
        title: "Настроить webhook",
        url: "https://sandbox-vendors.paddle.com/notifications",
        instructions: [
          "Notifications → New destination",
          "URL: https://aevion-production-a70c.up.railway.app/api/paddle/webhook",
          "Events: transaction.completed, subscription.activated, subscription.cancelled",
          "Скопируй signing secret → Railway: PADDLE_WEBHOOK_SECRET=pdl_ntfset_...",
        ],
      },
      {
        step: 5,
        title: "Привязать KZ банк для выплат",
        url: "https://vendors.paddle.com/settings/payouts",
        instructions: [
          "Settings → Payouts → Add bank account",
          "SWIFT/BIC вашего банка (Halyk: HSBKKZKX, Kaspi: CASPKZKA, Jusan: TSESKZKA)",
          "IBAN или номер счёта",
          "Minimum payout threshold: $50",
        ],
      },
    ],
    envVars: [
      { key: "PADDLE_API_KEY", example: "pdl_sdbx_apikey_xxx", required: true },
      { key: "PADDLE_WEBHOOK_SECRET", example: "pdl_ntfset_xxx", required: false },
      { key: "PADDLE_SANDBOX", example: "true", required: false, default: "true" },
    ],
    sandboxDashboard: "https://sandbox-vendors.paddle.com",
    prodDashboard: "https://vendors.paddle.com",
    note: "Sandbox полностью бесплатен для тестирования. Когда всё работает — меняй PADDLE_SANDBOX=false и ключ на production.",
  });
});
