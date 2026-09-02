import { describe, test, expect, beforeEach, afterAll, vi } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Сторож: КАЖДЫЙ обработчик кассы отсекает повторную доставку.
 *
 * ЗАЧЕМ. Дедупликация была проверена как МЕХАНИЗМ (tests/webhookDedup.test.ts),
 * но не как поведение маршрута. Замер 02.09.2026: обезвредил проверку повтора
 * внутри каждого из четырёх обработчиков (`if (false)`, синтаксически
 * корректно) и прогнал все тесты кассы, исключив юнит-тест модуля, —
 * НЕ ПОЙМАНО ни у одной из четырёх.
 *
 * Последствие не гипотетическое, оно описано автором дедупликации:
 * provisionSubscription не ищет подписку по идентификатору платежа, поэтому
 * повтор пишет ВТОРУЮ подписку в журнал и шлёт покупателю ВТОРОЕ
 * приветственное письмо. Законный повтор приходит после каждого передеплоя.
 *
 * Проверяется ровно то, чего не хватало: первый вебхук проходит, второй с тем
 * же идентификатором получает ответ «повтор». Механизм дедупликации при этом
 * настоящий — подменены только провайдеры, чтобы не подписывать запросы.
 */
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));

import crypto from "node:crypto";
const LS_SECRET = "test-ls-secret-replay";
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = LS_SECRET;
process.env.GUMROAD_PRODUCT_REPLAYTEST = "tier_medium_monthly";
process.env.LEMON_SQUEEZY_VARIANT_LITE_MONTHLY = "9002";

const { полезная } = vi.hoisted(() => ({ полезная: { id: "" } }));

vi.mock("../src/lib/payment/payboxProvider", () => ({
  payboxPaymentProvider: {
    parseWebhook: () => ({
      result: { status: "paid", reason: null, raw: { pg_user_contact_email: "b@example.test", pg_order_id: "tier_medium_monthly", pg_payment_id: полезная.id } },
      eventId: полезная.id,
    }),
  },
}));
vi.mock("../src/lib/payment/paypalProvider", () => ({
  verifyPaypalWebhook: async () => true,
  paypalPaymentProvider: {
    parseWebhook: () => ({
      result: { status: "paid", reason: null, raw: { payer: { email_address: "b@example.test" }, custom_id: "tier_medium_monthly", id: полезная.id } },
      eventId: полезная.id,
    }),
  },
}));
vi.mock("../src/lib/payment/gumroadProvider", () => ({
  verifyGumroadSaleDetailed: async () => ({ ok: true, verified: true }),
  gumroadPaymentProvider: {
    parseWebhook: () => ({
      result: { status: "paid", reason: null, raw: { email: "b@example.test", sale_id: полезная.id, product_id: "replaytest" } },
      eventId: полезная.id,
    }),
  },
}));

let каталог: string | null = null;
const сохранено = process.env.SUBSCRIPTIONS_FILE;

beforeEach(() => {
  каталог ??= mkdtempSync(join(tmpdir(), "aevion-replay-"));
  // Пишем в свой файл: сторож не должен трогать боевые данные.
  process.env.SUBSCRIPTIONS_FILE = join(каталог, "subs.jsonl");
});

afterAll(() => {
  if (сохранено === undefined) delete process.env.SUBSCRIPTIONS_FILE;
  else process.env.SUBSCRIPTIONS_FILE = сохранено;
  if (каталог) rmSync(каталог, { recursive: true, force: true });
});

type Касса = { имя: string; путь: string; роутер: string; тело?: () => unknown };

const КАССЫ: Касса[] = [
  { имя: "paybox", путь: "/api/paybox", роутер: "payboxWebhookRouter" },
  { имя: "paypal", путь: "/api/paypal", роутер: "paypalWebhookRouter" },
  { имя: "gumroad", путь: "/api/gumroad", роутер: "gumroadWebhookRouter" },
  {
    имя: "lemonsqueezy",
    путь: "/api/lemonsqueezy",
    роутер: "lemonSqueezyWebhookRouter",
    // LemonSqueezy разбирает тело сам, без провайдера.
    тело: () => ({ meta: { event_name: "subscription_created" }, data: { id: полезная.id, attributes: { user_email: "b@example.test", variant_id: 9002 } } }),
  },
];


async function послать(к: Касса) {
  const мод = await import(`../src/routes/${к.роутер.replace("Router", "")}`);
  const роутер = (мод as Record<string, unknown>)[к.роутер];
  const a = express();
  a.use(express.json());
  a.use((req, _r, next) => {
    (req as unknown as { rawBody: Buffer }).rawBody = Buffer.from(JSON.stringify(к.тело?.() ?? {}));
    next();
  });
  a.use(к.путь, роутер as express.Router);
  const r = request(a).post(`${к.путь}/webhook`);
  if (!к.тело) return r.send();
  const сырое = JSON.stringify(к.тело());
  const подпись = crypto.createHmac("sha256", LS_SECRET).update(сырое, "utf8").digest("hex");
  return r.set("x-signature", подпись).set("content-type", "application/json").send(сырое);
}

// Имя кассы подставляем сами: vitest не раскрывает $поле с кириллическим
// именем, и отчёт получался безымянным — «сломано что-то из четырёх».
describe.each(КАССЫ.map((к) => [к.имя, к] as const))("повтор доставки отсекается: %s", (имя, к) => {
  test("второй такой же вебхук помечен как повтор", async () => {
    const { __resetWebhookDedupCache } = await import("../src/lib/webhookDedup");
    __resetWebhookDedupCache();
    полезная.id = `replay-${к.имя}-1`;

    const первый = await послать(к);
    expect(первый.status, `[${имя}] первая доставка не прошла — проверять нечего. Ответ: ${первый.status} ${JSON.stringify(первый.body)}`).toBe(200);
    expect(
      первый.body?.deduped,
      `[${имя}] ПЕРВАЯ доставка помечена повтором — значит проверка ничего не доказывает`
    ).not.toBe(true);

    const второй = await послать(к);
    expect(
      второй.body?.deduped,
      `[${имя}] повторная доставка НЕ отсечена: она запишет вторую подписку и пошлёт покупателю второе письмо. Ответы: #1=${первый.status} ${JSON.stringify(первый.body)} #2=${второй.status} ${JSON.stringify(второй.body)}`
    ).toBe(true);
  });
});
