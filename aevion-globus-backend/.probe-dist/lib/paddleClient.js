"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PADDLE_BASE_URL = exports.IS_PADDLE_SANDBOX = exports.PADDLE_WEBHOOK_SECRET = exports.PADDLE_KEY = void 0;
exports.paddleGet = paddleGet;
exports.paddlePost = paddlePost;
exports.verifyPaddleWebhook = verifyPaddleWebhook;
exports.createPaddleTransaction = createPaddleTransaction;
/**
 * Paddle Billing v2 API client — ОСТАВШИЙСЯ ХВОСТ ВЫВЕДЕННОЙ ИНТЕГРАЦИИ.
 *
 * Paddle снят с эксплуатации 22.07.2026 (PR #779): KYC не пройдена, маршруты
 * `/api/paddle/*` удалены, вебхук в checkout.ts отдаёт громкое 410 вместо тихого
 * 200. Деньги платформы идут через Gumroad.
 *
 * Прежняя шапка гласила «Used by checkout.ts, qstore.ts, revenue.ts» — это уже
 * неправда, и неправда опасная: читающий делает вывод, что Paddle стоит на пути
 * оплаты. Замер 19.08.2026 по всему `src/`, `scripts/` и `tests/`:
 *
 *   единственный потребитель  — revenue.ts, и только ЧТЕНИЕ баланса
 *                               (`PADDLE_KEY`, `IS_PADDLE_SANDBOX`, `paddleGet`);
 *   без потребителей вовсе    — createPaddleTransaction, paddlePost,
 *                               verifyPaddleWebhook, PADDLE_BASE_URL;
 *   checkout.ts               — только 410 и комментарии, ни одного вызова;
 *   qstore.ts                 — ни одного упоминания.
 *
 * Функции записи оставлены намеренно: если KYC когда-нибудь пройдёт, начинать
 * будут с них. Но пока ни одна не вызывается — не считайте их работающими.
 *
 * ⚠️ На проде 19.08.2026 переменная PADDLE_API_KEY ВСЁ ЕЩЁ ЗАДАНА. Видно это по
 * ответу: при пустом ключе ручка баланса отдаёт 200 со `stub: true`, а прод даёт
 * 502 `paddle_api_error` за 1.2 с при таймауте 10 с — то есть Paddle ОТВЕТИЛ и
 * отказал (отозванный ключ), а не промолчал. Отсюда вечно красная денежная
 * проверка: убрать ключ из окружения — и она станет честно зелёной.
 */
const crypto_1 = __importDefault(require("crypto"));
const PADDLE_KEY = () => process.env.PADDLE_API_KEY?.trim() || "";
exports.PADDLE_KEY = PADDLE_KEY;
const PADDLE_WEBHOOK_SECRET = () => process.env.PADDLE_WEBHOOK_SECRET?.trim() || "";
exports.PADDLE_WEBHOOK_SECRET = PADDLE_WEBHOOK_SECRET;
const IS_PADDLE_SANDBOX = () => process.env.PADDLE_SANDBOX !== "false"; // sandbox unless explicitly "false"
exports.IS_PADDLE_SANDBOX = IS_PADDLE_SANDBOX;
const PADDLE_BASE_URL = () => (0, exports.IS_PADDLE_SANDBOX)()
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";
exports.PADDLE_BASE_URL = PADDLE_BASE_URL;
async function paddleGet(path) {
    const key = (0, exports.PADDLE_KEY)();
    if (!key)
        return null;
    try {
        const r = await fetch(`${(0, exports.PADDLE_BASE_URL)()}${path}`, {
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            signal: AbortSignal.timeout(10000),
        });
        if (!r.ok) {
            console.error("[paddle] GET", r.status, path);
            return null;
        }
        return await r.json();
    }
    catch (e) {
        console.error("[paddle] GET failed", e);
        return null;
    }
}
async function paddlePost(path, body) {
    const key = (0, exports.PADDLE_KEY)();
    if (!key)
        return null;
    try {
        const r = await fetch(`${(0, exports.PADDLE_BASE_URL)()}${path}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10000),
        });
        if (!r.ok) {
            console.error("[paddle] POST", r.status, path);
            return null;
        }
        return await r.json();
    }
    catch (e) {
        console.error("[paddle] POST failed", e);
        return null;
    }
}
/** Verifies Paddle webhook HMAC-SHA256 signature (format: ts=...;h1=<hex>) */
function verifyPaddleWebhook(rawBody, signatureHeader, secret) {
    try {
        const parts = Object.fromEntries(signatureHeader.split(";").map((p) => {
            const i = p.indexOf("=");
            return [p.slice(0, i), p.slice(i + 1)];
        }));
        const ts = parts["ts"];
        const h1 = parts["h1"];
        if (!ts || !h1)
            return false;
        const payload = `${ts}:${typeof rawBody === "string" ? rawBody : rawBody.toString("utf8")}`;
        const expected = crypto_1.default.createHmac("sha256", secret).update(payload).digest("hex");
        const a = Buffer.from(h1, "hex");
        const b = Buffer.from(expected, "hex");
        return a.length === b.length && crypto_1.default.timingSafeEqual(a, b);
    }
    catch {
        return false;
    }
}
/** Create a Paddle transaction (checkout session) */
async function createPaddleTransaction(opts) {
    const currency = opts.currency.toLowerCase();
    // Paddle needs a price — create a custom price inline
    const itemBody = {
        price: {
            description: opts.description.slice(0, 255),
            unit_price: { amount: String(opts.amountCents), currency_code: currency.toUpperCase() },
            product: {
                name: opts.description.slice(0, 255),
                tax_category: "standard",
            },
        },
        quantity: 1,
    };
    const txBody = {
        items: [itemBody],
        checkout: { url: opts.successUrl },
        ...(opts.customData ? { custom_data: opts.customData } : {}),
    };
    if (opts.email) {
        // Find or create customer
        const existing = await paddleGet(`/customers?email=${encodeURIComponent(opts.email)}&per_page=1`);
        const customerId = existing?.data?.[0]?.id;
        if (customerId) {
            txBody.customer_id = customerId;
        }
        else {
            const newCust = await paddlePost("/customers", { email: opts.email });
            if (newCust?.data?.id)
                txBody.customer_id = newCust.data.id;
        }
    }
    const tx = await paddlePost("/transactions", txBody);
    if (!tx?.data)
        return null;
    return {
        transactionId: tx.data.id,
        url: tx.data.checkout?.url ?? opts.successUrl,
    };
}
