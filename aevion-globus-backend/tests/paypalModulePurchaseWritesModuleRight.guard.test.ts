import { describe, test, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Сторож PayPal: покупка одного модуля пишет право НА МОДУЛЬ и не создаёт
 * платформенной подписки.
 *
 * Пара к `payboxModulePurchaseWritesModuleRight`. Отдельный файл, а не «ещё один
 * случай» в соседнем: охранять одну кассу и оставить вторую — та самая
 * асимметрия, из-за которой класс и живёт. Правило у касс общее
 * (lib/payment/purchasedModule), но ПОРЯДОК проверок в каждом рельсе свой, и
 * именно порядок здесь решает: развилка обязана стоять ДО проверки «похожа ли
 * ссылка на подписку», иначе оплаченная покупка модуля возвращала бы
 * `ignored: not_a_subscription_reference` — деньги без доступа.
 *
 * 🔴 Почему это деньги: тариф с 15.09.2026 означает срок доступа ко ВСЕЙ планете
 * ($400/мес), поэтому покупка модуля, записанная тарифом, отдаёт планету за цену
 * модуля. Замер и починка на Lemon Squeezy — коммит dc5d45658.
 */

const provisionSubscription = vi.fn();
const upsertAppSubscription = vi.fn();

let полезная: Record<string, unknown> = {};
vi.mock("../src/lib/payment/paypalProvider", () => ({
  verifyPaypalWebhook: async () => true,
  paypalPaymentProvider: {
    parseWebhook: () => ({
      result: { status: "paid", reason: null, raw: полезная },
      eventId: String(полезная.id ?? ""),
    }),
  },
}));
vi.mock("../src/routes/provisioning", async (orig) => {
  const настоящий = (await orig()) as Record<string, unknown>;
  return {
    ...настоящий,
    provisionSubscription: (...a: unknown[]) => provisionSubscription(...a),
    writeSubscription: vi.fn(),
  };
});
vi.mock("../src/lib/appEntitlements", async (orig) => {
  const настоящий = (await orig()) as Record<string, unknown>;
  return { ...настоящий, upsertAppSubscription: (...a: unknown[]) => upsertAppSubscription(...a) };
});
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

const { paypalWebhookRouter } = await import("../src/routes/paypalWebhook");

let счётчик = 0;
async function оплата(custom: Record<string, unknown>) {
  счётчик += 1;
  полезная = {
    id: `pp-mod-${счётчик}`,
    payer: { email_address: `Buyer${счётчик}@Example.com` },
    custom_id: JSON.stringify(custom),
  };
  const a = express();
  a.use((req, _res, next) => {
    (req as unknown as { rawBody: Buffer }).rawBody = Buffer.from("x");
    next();
  });
  a.use("/api/paypal", paypalWebhookRouter);
  return request(a).post("/api/paypal/webhook").send();
}

beforeEach(() => {
  provisionSubscription.mockReset();
  provisionSubscription.mockResolvedValue({ subscription: { id: "s1" } });
  upsertAppSubscription.mockReset();
  upsertAppSubscription.mockResolvedValue(undefined);
});

describe("PayPal: покупка одного модуля", () => {
  test("ссылка приложения → право на модуль, тариф НЕ выдан", async () => {
    const res = await оплата({ reference: "app_qskyway_lite" });
    expect(res.status).toBe(200);
    expect(res.body.action).toBe("app_activated");

    expect(upsertAppSubscription.mock.calls.length, "право на модуль не записано").toBe(1);
    expect(upsertAppSubscription.mock.calls[0][1]).toBe("qskyway");
    expect(upsertAppSubscription.mock.calls[0][2]).toBe("active");
    expect(
      provisionSubscription.mock.calls.length,
      "создана платформенная подписка — планета уйдёт за цену модуля",
    ).toBe(0);
    expect(
      upsertAppSubscription.mock.calls[0][0],
      "адрес не приведён к нижнему регистру — право не найдётся при чтении",
    ).toBe(`buyer${счётчик}@example.com`);
  });

  test("модуль поверх варианта тарифа — тоже покупка модуля", async () => {
    const res = await оплата({ reference: "tier_lite", module: "qright" });
    expect(res.status).toBe(200);
    expect(upsertAppSubscription.mock.calls[0][1]).toBe("qright");
    expect(provisionSubscription.mock.calls.length).toBe(0);
  });

  test("КОНТРОЛЬ: покупка ТАРИФА по-прежнему создаёт платформенную подписку", async () => {
    const res = await оплата({ reference: "tier_max" });
    expect(res.status).toBe(200);
    expect(res.body.action, "у покупателя планеты отобрали оплаченное").toBe("activated");
    expect(provisionSubscription.mock.calls.length).toBe(1);
    expect(upsertAppSubscription.mock.calls.length).toBe(0);
  });

  test("КОНТРОЛЬ: модуль БЕЗ своего товара остаётся покупкой тарифа", async () => {
    // qcoreai отдельным товаром не продаётся: право на такое имя записать можно,
    // а прочитать нельзя (appSubscriptionState переводит id через список
    // продаваемых). Поэтому доступ ему даёт тариф, как и до правки.
    const res = await оплата({ reference: "tier_lite", module: "qcoreai" });
    expect(res.status).toBe(200);
    expect(res.body.action).toBe("activated");
    expect(provisionSubscription.mock.calls.length).toBe(1);
  });
});
