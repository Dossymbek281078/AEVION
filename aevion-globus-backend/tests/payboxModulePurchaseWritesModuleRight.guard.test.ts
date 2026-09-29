import { describe, test, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Сторож PayBox: покупка одного модуля пишет право НА МОДУЛЬ и не создаёт
 * платформенной подписки.
 *
 * 🔴 Почему это деньги. Тариф с 15.09.2026 — срок доступа ко ВСЕЙ планете
 * ($400/мес): `normalizeTier` превращает lite в `full`, `isModuleEntitled` при
 * full пускает куда угодно. PayBox превращал ссылку приложения в тариф
 * (`app_qskyway_lite` → lite → full, проверено прогоном), то есть покупка
 * QSkyway за $16 открывала планету. Касса выключена на проде, поэтому утечка
 * спала; включать PayBox для Казахстана без этой починки нельзя.
 *
 * Оснастка взята у соседнего теста (`payboxAmountUnitsAreHonest`): подменяется
 * разбор вебхука, поэтому подпись не нужна, а маршрут работает НАСТОЯЩИЙ.
 */

const provisionSubscription = vi.fn();
const parseWebhook = vi.fn();
const upsertAppSubscription = vi.fn();

vi.mock("../src/lib/payment/payboxProvider", () => ({
  payboxPaymentProvider: { parseWebhook: (...a: unknown[]) => parseWebhook(...a) },
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

const { payboxWebhookRouter } = await import("../src/routes/payboxWebhook");

const приложение = () => {
  const a = express();
  a.use((req, _res, next) => {
    (req as unknown as { rawBody: Buffer }).rawBody = Buffer.from("stub", "utf8");
    next();
  });
  a.use(express.urlencoded({ extended: true }));
  return a.use(payboxWebhookRouter);
};

let n = 0;
function оплата(orderId: string, доп: Record<string, string> = {}) {
  n += 1;
  parseWebhook.mockReturnValue({
    eventId: `pb_mod_${n}`,
    result: {
      status: "paid",
      paidAt: null,
      reason: null,
      raw: {
        pg_payment_id: `pb_mod_${n}`,
        pg_order_id: `${orderId}_${n}`,
        pg_user_contact_email: `buyer${n}@test.aev`,
        pg_currency: "KZT",
        pg_amount: "8000",
        ...доп,
      },
    },
  });
  return request(приложение()).post("/webhook").send({});
}

beforeEach(() => {
  provisionSubscription.mockReset();
  provisionSubscription.mockResolvedValue({ subscription: { id: "s1" } });
  upsertAppSubscription.mockReset();
  upsertAppSubscription.mockResolvedValue(undefined);
  parseWebhook.mockReset();
});

describe("PayBox: покупка одного модуля", () => {
  test("ссылка приложения → право на модуль, тариф НЕ выдан", async () => {
    const r = await оплата("app_qskyway_lite");
    expect(r.status).toBe(200);
    expect(r.body.action).toBe("app_activated");

    expect(upsertAppSubscription.mock.calls.length, "право на модуль не записано").toBe(1);
    expect(upsertAppSubscription.mock.calls[0][1]).toBe("qskyway");
    expect(upsertAppSubscription.mock.calls[0][2]).toBe("active");
    expect(
      provisionSubscription.mock.calls.length,
      "создана платформенная подписка — тариф откроет всю планету за цену модуля",
    ).toBe(0);
  });

  test("модуль, переданный полем кассы поверх варианта тарифа, — тоже покупка модуля", async () => {
    const r = await оплата("tier_lite", { pg_param_module: "qright" });
    expect(r.status).toBe(200);
    expect(upsertAppSubscription.mock.calls[0][1]).toBe("qright");
    expect(provisionSubscription.mock.calls.length).toBe(0);
  });

  test("КОНТРОЛЬ: покупка ТАРИФА по-прежнему создаёт платформенную подписку", async () => {
    const r = await оплата("tier_max");
    expect(r.status).toBe(200);
    expect(r.body.action, "у покупателя планеты отобрали оплаченное").toBe("activated");
    expect(provisionSubscription.mock.calls.length).toBe(1);
    expect((provisionSubscription.mock.calls[0][0] as { tierId: string }).tierId).toBe("max");
    expect(upsertAppSubscription.mock.calls.length, "тарифу право на модуль не нужно").toBe(0);
  });
});
