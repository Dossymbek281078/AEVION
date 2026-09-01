import { Router } from "express";
import { isPayboxConfigured } from "../lib/payment/payboxProvider";
import { verifyBearerOptional } from "../lib/authJwt";
import { gumroadPaymentProvider } from "../lib/payment/gumroadProvider";
import { makeServiceCapture } from "../lib/sentry/platform";

const capturePaymentsError = makeServiceCapture("payments");

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
  { id: "free", name: "Free", price: 0, currency: "usd", interval: "month", features: ["1 продукт на выбор (лимиты)", "QCoreAI 100K токенов/мес", "Публичный Globus", "Базовая аналитика"] },
  { id: "lite", name: "Lite", price: 1900, currency: "usd", interval: "month", reference: "tier_lite_monthly", permalink: process.env.GUMROAD_PERMALINK_TIER_LITE_MONTHLY, features: ["1 любой продукт AEVION", "Полный доступ к выбранному", "QCoreAI 2M токенов/мес", "Email-поддержка"] },
  { id: "medium", name: "Medium", price: 2900, currency: "usd", interval: "month", reference: "tier_medium_monthly", permalink: process.env.GUMROAD_PERMALINK_TIER_MEDIUM_MONTHLY, features: ["10 готовых продуктов", "CyberChess, HealthAI, Multichat, QCoreAI…", "QCoreAI 10M токенов/мес", "Email-поддержка"] },
  { id: "full", name: "Full", price: 4900, currency: "usd", interval: "month", reference: "tier_full_monthly", permalink: process.env.GUMROAD_PERMALINK_TIER_FULL_MONTHLY, features: ["Все продукты AEVION (30+)", "IP-контур + финтех-стек", "QCoreAI 50M токенов/мес", "Приоритетная поддержка"] },
  { id: "enterprise", name: "Enterprise", price: 0, currency: "usd", interval: "month", features: ["Всё из Full", "Выделенная инфра / on-prem", "SLA до 1 часа", "Customer Success менеджер"] },
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
    capturePaymentsError(e, { route: "gumroad-create-transaction" });
    res.status(500).json({ error: e?.message || "create transaction failed" });
  }
});

paymentsRouter.post("/gumroad/create-subscription", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { reference, email } = req.body || {};
    if (!reference) return res.status(400).json({ error: "reference required (e.g. tier_lite_monthly; see /api/payments/gumroad/plans)" });

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
    capturePaymentsError(e, { route: "gumroad-create-subscription" });
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
  } catch (err) { capturePaymentsError(err, { route: "paybox-init" }); res.status(500).json({ error: "paybox init failed" }); }
});

// ─── POST /api/payments/paybox/callback ──────────────────────────────────────
//
// ⚠ Это НЕ боевой приёмник уведомлений PayBox. Боевой — /api/paybox/webhook:
// он проверяет подпись pg_sig, отбивает повторы и записывает оплату. Именно
// его адрес подставляет payboxProvider.ts в pg_result_url, так что платежи,
// начатые текущим кодом, приходят туда.
//
// Раньше этот обработчик отвечал <pg_status>ok</pg_status> и НЕ ДЕЛАЛ НИЧЕГО.
// Для PayBox «ok» означает «уведомление принято, повторять не нужно» — то есть
// подтверждение оплаты, попавшее сюда по устаревшей настройке в кабинете,
// подтверждалось и выбрасывалось. Молча: ни лога, ни тревоги, ни следа.
//
// Убрать маршрут нельзя — тогда уведомление потеряется так же, только с 404.
// Поэтому: тело сохраняется в Sentry как сообщение (не ошибка — это не сбой
// кода, а неверный адрес в кабинете), и ответ прежний, чтобы PayBox не начал
// повторять в пустоту. Ничего не теряется, и это видно.
paymentsRouter.post("/paybox/callback", (req, res) => {
  // ПРОБА ИЛИ НАСТОЯЩАЯ ОПЛАТА — тревогу поднимаем только на вторую.
  //
  // Замер 28.08.2026: единственное срабатывание за неделю пришло с
  // `browser = curl 8.21.0` — то есть это была ручная проба (наш смоук либо
  // чужой сканер), а не касса. Денежная тревога, которая звонит на пробы,
  // приучает себя не читать; в тот единственный раз, когда на старый адрес
  // придёт настоящая оплата, её отмахнут вместе с шумом.
  //
  // Различаем по телу: PayBox шлёт application/x-www-form-urlencoded, и такой
  // разборщик у нас смонтирован (index.ts, express.urlencoded) — значит у
  // настоящего уведомления поля `pg_*` в теле ЕСТЬ, а у пробы тело пустое.
  //
  // Направление отказа выбрано в сторону тревоги: пробой считается ТОЛЬКО
  // полностью пустое тело. Есть хоть одно поле, пусть и незнакомое, — звоним.
  // Ошибиться молчанием здесь дороже, чем лишним письмом.
  const body = (req.body ?? {}) as Record<string, unknown>;
  const isProbe = Object.keys(body).length === 0;
  if (isProbe) {
    console.warn(
      "[payments] проба на устаревший путь /api/payments/paybox/callback:" +
        " тело пустое, это не уведомление PayBox. Тревога не поднимается.",
    );
    res.setHeader("Content-Type", "text/xml");
    res.send(`<?xml version="1.0" encoding="utf-8"?><response><pg_status>ok</pg_status></response>`);
    return;
  }
  capturePaymentsError(
    new Error("paybox_callback_on_legacy_path"),
    {
      route: "paybox-callback-legacy",
      canonical: "/api/paybox/webhook",
      // Тело целиком: без него уведомление всё равно потеряно, а разобрать
      // потом будет нечего. Карт и секретов PayBox сюда не шлёт — только
      // идентификаторы заказа, сумму и подпись.
      body: JSON.stringify(req.body ?? {}).slice(0, 4000),
    },
  );
  console.error(
    "[payments] уведомление PayBox пришло на устаревший путь /api/payments/paybox/callback;" +
      " боевой приёмник — /api/paybox/webhook. Тело сохранено в Sentry.",
  );
  res.setHeader("Content-Type", "text/xml");
  res.send(`<?xml version="1.0" encoding="utf-8"?><response><pg_status>ok</pg_status></response>`);
});

// ─── GET /api/payments/paybox/status/:orderId ────────────────────────────────
//
// Раньше отвечало { status: "pending", amount: null } на ЛЮБОЙ идентификатор —
// включая заказ, которого не существует, и заказ, который давно оплачен.
// Никакого обращения ни к PayBox, ни к нашей базе здесь нет и не было.
//
// «pending» — не безобидная заглушка, а утверждение о деньгах: спрашивающий
// читает его как «платёж идёт, ждите». Проверено на проде 20.08.2026: два
// заведомо разных заказа получили один и тот же ответ.
//
// Честного ответа у этого маршрута быть не может, поэтому он его и не даёт.
// Статус оплаты живёт там, куда приходит боевой вебхук.
paymentsRouter.get("/paybox/status/:orderId", (req, res) => {
  res.status(501).json({
    error: "not_implemented",
    orderId: req.params.orderId,
    message:
      "Этот маршрут не знает статуса оплаты и раньше отвечал «pending» на любой заказ. " +
      "Состояние платежа определяется по уведомлению на /api/paybox/webhook.",
  });
});

/* ═══ Kaspi ═══ */

paymentsRouter.get("/kaspi/config", (_req, res) => {
  res.json({ configured: false, comingSoon: true, info:
      // 01.09.2026: здесь звали писать на почтовый ящик нашего домена. Записи MX
      // у него нет, письма туда не доходят, а ответ ручки выглядел рабочим способом связаться.
      "Kaspi Pay requires a merchant agreement. Contact us at " +
      `${process.env.FRONTEND_URL?.replace(/[/]+$/, "") || "https://aevion.app"}/pricing/contact`, });
});

/* ═══ General ═══ */

paymentsRouter.get("/health", (_req, res) => {
  // Выражение ДОСЛОВНО то же, что в checkout.ts, включая секрет вебхука:
  // это одно утверждение о мире, и два его написания разъезжаются молча.
  // Без секрета вебхук LemonSqueezy — заглушка на 200 OK, то есть деньги
  // возьмутся, а купленное не выдастся; выдача есть у Gumroad, и выбор
  // идёт как `lsReady ? ls : gumroad`.
  const lsReady =
    Boolean(process.env.LEMON_SQUEEZY_API_KEY?.trim()) &&
    Boolean(process.env.LEMON_SQUEEZY_STORE_ID?.trim());
  // Кто ОСНОВНОЙ — решает способность выдать купленное, а не взять деньги.
  const lsCanDeliver =
    lsReady && Boolean(process.env.LEMON_SQUEEZY_WEBHOOK_SECRET?.trim());
  res.json({
    // `primary` раньше стояло у Gumroad КОНСТАНТОЙ true. Поле выглядело
    // замером, а было литералом — и после перехода на LemonSqueezy оно
    // начало лгать: /api/pricing/checkout/healthz отвечал
    // primaryProvider "lemonsqueezy", а эта ручка в тот же миг —
    // gumroad primary true. Две наши собственные ручки спорили о том,
    // кто принимает деньги, и верили бы более короткой.
    //
    // Выражение взято ОДИН В ОДИН из checkout.ts (/healthz), а не
    // придумано заново: второй способ отвечать на тот же вопрос и есть
    // причина расхождения.
    lemonsqueezy: { configured: lsReady, primary: lsCanDeliver },
    gumroad: { configured: Boolean(GUMROAD_TOKEN()), primary: !lsCanDeliver },
    // Готовность PayBox спрашиваем у ЕГО ЖЕ модуля, а не пересобираем здесь:
    // ему нужны И идентификатор продавца, И PAYBOX_SECRET (без секрета нельзя
    // ни подписать запрос, ни проверить ответ). Своя проверка по одному
    // продавцу расходилась бы с checkout/healthz, который зовёт эту функцию.
    // Сегодня обе отвечают «нет», и разница невидима — она проявится в день,
    // когда данные PayBox заданы наполовину: эта ручка объявит кассу для
    // тенге готовой, а платить будет нельзя.
    paybox: { configured: isPayboxConfigured() },
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
