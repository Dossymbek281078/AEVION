import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

/**
 * Что охраняет этот файл: «заплатил → получил ровно то, что купил».
 *
 * Три дефекта, найденные 12.08.2026 на живом магазине, все класса «отвечаем
 * 200, а делаем не то» — то есть без жалоб, без повторной доставки и без следа:
 *
 * 1. DevHub Studio Pro продаётся ПОДПИСКОЙ ($149/мес, is_subscription: true —
 *    проверено на витрине), а ссылки `app_devhub` в таблице вариантов не было.
 *    Обратный поиск возвращал null, и подписка за $149 провижинила тариф
 *    «lite» ($19).
 * 2. Отмена подписки на DevHub не забирала доступ: строка помечалась
 *    cancelled, а тариф в DevHubTier оставался "pro" навсегда.
 * 3. Сбой записи в БД глотался внутри, и ответ всё равно был 200 —
 *    магазин считал доставку успешной и не повторял её.
 */

const SECRET = "test-ls-secret-000";
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;
process.env.LEMON_SQUEEZY_VARIANT_DEVHUB_STUDIO_PRO = "9001";
process.env.LEMON_SQUEEZY_VARIANT_LITE_MONTHLY = "9002";

const { mockQuery, mockProvision } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockProvision: vi.fn(),
}));

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/routes/provisioning", () => ({
  provisionSubscription: mockProvision,
  writeSubscription: vi.fn(),
}));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

// eslint-disable-next-line import/first
import { lemonSqueezyWebhookRouter } from "../src/routes/lemonSqueezyWebhook";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter);
  return app;
}

let subCounter = 0;
function post(payload: Record<string, unknown>) {
  const raw = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  return request(makeApp())
    .post("/api/lemonsqueezy/webhook")
    .set("Content-Type", "application/json")
    .set("X-Signature", sig)
    .send(raw);
}

function event(name: string, variantId: string | number, email = "buyer@test.aev") {
  subCounter += 1;
  return {
    meta: { event_name: name },
    data: { id: `sub_${subCounter}`, attributes: { user_email: email, variant_id: variantId } },
  };
}

/** Все запросы к БД, попавшие в DevHubEmailTier, с выставленным тарифом. */
function devhubTiersWritten(): string[] {
  return mockQuery.mock.calls
    .filter((c) => String(c[0]).includes("DevHubEmailTier"))
    .map((c) => String((c[1] as unknown[])?.[1]));
}

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [] });
  mockProvision.mockReset();
  mockProvision.mockResolvedValue({ subscription: { id: "s1" } });
});

describe("Lemon Squeezy: заплатил → получил именно купленное", () => {
  test("подписка на DevHub Studio Pro открывает DevHub, а не тариф lite", async () => {
    const res = await post(event("subscription_created", "9001"));

    expect(res.status).toBe(200);
    expect(res.body.action).toBe("app_activated");
    expect(res.body.appSlug).toBe("devhub");
    // Доступ открывает тариф в DevHubEmailTier — он должен стать "pro".
    expect(devhubTiersWritten()).toContain("pro");
    // И ни в коем случае не платформенный тариф вместо купленного модуля.
    expect(mockProvision).not.toHaveBeenCalled();
  });

  test("отмена подписки на DevHub забирает доступ", async () => {
    const res = await post(event("subscription_cancelled", "9001"));

    expect(res.status).toBe(200);
    expect(res.body.action).toBe("app_cancelled");
    expect(devhubTiersWritten()).toContain("free");
  });

  test("неизвестный товар НЕ превращается в тариф наугад — 500, а не тихий 200", async () => {
    const res = await post(event("subscription_created", "777777"));

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("unmapped_variant");
    expect(res.body.variantId).toBe("777777");
    // Главное: ничего не выдали. Раньше здесь молча провижинился "lite".
    expect(mockProvision).not.toHaveBeenCalled();
  });

  test("известный тариф по-прежнему провижинится", async () => {
    const res = await post(event("subscription_created", "9002"));

    expect(res.status).toBe(200);
    expect(res.body.action).toBe("activated");
    expect(mockProvision).toHaveBeenCalledTimes(1);
    expect(mockProvision.mock.calls[0][0]).toMatchObject({ tierId: "lite", source: "lemonsqueezy" });
  });

  test("сбой записи в БД не отвечает 200 — иначе магазин не повторит доставку", async () => {
    mockQuery.mockRejectedValue(new Error("db down"));

    const res = await post(event("subscription_created", "9001"));

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
  });

  test("возврат ЗАБИРАЕТ доступ к DevHub, а не оставляет его навсегда", async () => {
    // До 13.08.2026 слова «refund» в обработчике не было вовсе: деньги вернули,
    // доступ остался. У Gumroad это обработано, у Lemon Squeezy не было —
    // асимметрия нашлась сверкой двух рельсов.
    const res = await post({
      meta: { event_name: "order_refunded" },
      data: { id: "ord_1", attributes: { user_email: "buyer@test.aev", variant_id: "9001" } },
    });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe("devhub_studio_pro_revoked");
    expect(devhubTiersWritten()).toContain("free");
  });

  test("разовая покупка по-прежнему открывает доступ", async () => {
    const res = await post({
      meta: { event_name: "order_created" },
      data: { id: "ord_2", attributes: { user_email: "buyer@test.aev", variant_id: "9001" } },
    });

    expect(res.body.action).toBe("devhub_studio_pro_activated");
    expect(devhubTiersWritten()).toContain("pro");
  });
});
