import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

/**
 * Сторож: покупка ОДНОГО модуля не открывает всю планету.
 *
 * 🔴 УТЕЧКА, найденная 29.09.2026 рассуждением от двух верных фактов.
 *
 * Факт первый: у четырёх модулей нет своего товара в кассе, поэтому они
 * продаются вариантом «AEVION Planet — Lite» с подменой цены — QSkyway за $16,
 * QRight и QSign за $24, Биржа за $40 (checkout.ts, `fallbackVariantForReference`).
 * В `custom_data.module` при этом уезжает слаг купленного приложения.
 *
 * Факт второй: с 15.09.2026 тариф — это СРОК, а не набор. `normalizeTier`
 * превращает lite/medium/pro/full/max в `full`, а `isModuleEntitled` первой же
 * строкой отвечает `true` для `full` (planGate.ts).
 *
 * Сложенные вместе, они дают: вебхук пишет подписку с `tierId: "lite"`, план
 * нормализуется в `full`, и покупатель QSkyway за **$16 получает доступ ко всей
 * планете** — включая Multichat, который продаётся за $40 и единственный сейчас
 * закрыт стеной. Ветка `plan.tier === "lite"`, которая должна была ограничить
 * доступ выбранным модулем, для нормализованного плана недостижима.
 *
 * Стоимость ошибки прямая: планета Lite стоит $400 в месяц, и её содержимое
 * уходило за $16. Это не гипотеза о поведении людей, а два числа в одном пути.
 *
 * ЧТО ОХРАНЯЕТСЯ:
 *   1. покупка одного модуля запасным путём даёт право ровно на него;
 *   2. она НЕ даёт права на соседний платный модуль (собственно утечка);
 *   3. контроль: покупка самой планеты (без выбранного модуля) по-прежнему
 *      открывает всё — иначе «починка» отобрала бы оплаченное у тех, кто купил
 *      тариф, и это было бы хуже утечки.
 */

const SECRET = "test-ls-secret-one-module";
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;
process.env.LEMON_SQUEEZY_VARIANT_LITE = "8001";

const { mockQuery, mockProvision, mockUpsertApp } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockProvision: vi.fn(),
  mockUpsertApp: vi.fn(),
}));

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/routes/provisioning", () => ({
  provisionSubscription: mockProvision,
  writeSubscription: vi.fn(),
}));
vi.mock("../src/lib/appEntitlements", async (orig) => {
  const настоящий = (await orig()) as Record<string, unknown>;
  return { ...настоящий, upsertAppSubscription: mockUpsertApp };
});
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

const { lemonSqueezyWebhookRouter } = await import("../src/routes/lemonSqueezyWebhook");
const { normalizeTier, isModuleEntitled } = await import("../src/lib/planGate");

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter);
  return a;
}

let счётчик = 0;
/** Покупка через ЗАПАСНОЙ путь: вариант тарифа lite + выбранный модуль. */
function купилМодуль(слаг: string) {
  счётчик += 1;
  const payload = {
    meta: {
      event_name: "subscription_created",
      custom_data: { reference: "tier_lite", module: слаг },
    },
    data: {
      id: `sub_mod_${счётчик}`,
      attributes: { user_email: `buyer${счётчик}@test.aev`, variant_id: "8001", total: 1600 },
    },
  };
  const raw = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  return request(приложение())
    .post("/api/lemonsqueezy/webhook")
    .set("Content-Type", "application/json")
    .set("X-Signature", sig)
    .send(raw);
}

/** Покупка САМОЙ планеты: тот же вариант, но модуль не выбран. */
function купилПланету() {
  счётчик += 1;
  const payload = {
    meta: { event_name: "subscription_created", custom_data: { reference: "tier_lite" } },
    data: {
      id: `sub_planet_${счётчик}`,
      attributes: { user_email: `planet${счётчик}@test.aev`, variant_id: "8001", total: 40000 },
    },
  };
  const raw = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  return request(приложение())
    .post("/api/lemonsqueezy/webhook")
    .set("Content-Type", "application/json")
    .set("X-Signature", sig)
    .send(raw);
}

/** Тариф, записанный в платформенную подписку (если она вообще писалась). */
function записанныйТариф(): string | null {
  const call = mockProvision.mock.calls.at(-1);
  if (!call) return null;
  const arg = call[0] as { tierId?: string } | undefined;
  return arg?.tierId ?? null;
}

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [] });
  mockProvision.mockReset();
  mockProvision.mockResolvedValue({ subscription: { id: "s1" } });
  mockUpsertApp.mockReset();
  mockUpsertApp.mockResolvedValue(undefined);
});

describe("покупка одного модуля", () => {
  test("право пишется на сам модуль, а не тарифом на всю планету", async () => {
    const r = await купилМодуль("qskyway");
    expect(r.status).toBe(200);

    expect(
      mockUpsertApp.mock.calls.length,
      "куплен один модуль — значит и право должно быть на один модуль",
    ).toBeGreaterThan(0);
    expect(mockUpsertApp.mock.calls[0][1], "право выдано не тому модулю").toBe("qskyway");

    expect(
      записанныйТариф(),
      "платформенный тариф за покупку ОДНОГО модуля не пишется: lite нормализуется в full и открывает всё",
    ).toBeNull();
  });

  test("КОНТРОЛЬ УТЕЧКИ: $16 за QSkyway не открывают Multichat за $40", async () => {
    await купилМодуль("qskyway");

    // Собираем план ровно так, как его собрал бы planGate из записанного права.
    const тариф = записанныйТариф();
    const планИзТарифа = {
      tier: normalizeTier(тариф),
      rawTier: тариф ?? "free",
      email: "buyer@test.aev",
      reason: "test",
      chosenModules: ["qskyway"],
    };
    expect(
      isModuleEntitled(планИзТарифа, "multichat-engine"),
      "покупатель QSkyway за $16 получил доступ к Multichat — планета уходит за цену модуля",
    ).toBe(false);
  });

  test("КОНТРОЛЬ: покупка САМОЙ планеты по-прежнему открывает всё", async () => {
    const r = await купилПланету();
    expect(r.status).toBe(200);

    expect(записанныйТариф(), "тариф планеты обязан записаться").toBe("lite");
    const план = {
      tier: normalizeTier(записанныйТариф()),
      rawTier: "lite",
      email: "planet@test.aev",
      reason: "test",
      chosenModules: [] as string[],
    };
    expect(
      isModuleEntitled(план, "multichat-engine"),
      "у купившего тариф отобрали оплаченное — это хуже утечки",
    ).toBe(true);
  });
  test("отмена такой покупки снимает право на модуль, а не понижает тариф", async () => {
    await купилМодуль("qskyway");
    mockUpsertApp.mockClear();

    счётчик += 1;
    const payload = {
      meta: { event_name: "subscription_cancelled", custom_data: { reference: "tier_lite", module: "qskyway" } },
      data: { id: "sub_mod_cancel", attributes: { user_email: "buyer@test.aev", variant_id: "8001" } },
    };
    const raw = JSON.stringify(payload);
    const sig = crypto.createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
    const r = await request(приложение())
      .post("/api/lemonsqueezy/webhook")
      .set("Content-Type", "application/json")
      .set("X-Signature", sig)
      .send(raw);

    expect(r.status).toBe(200);
    const снятия = mockUpsertApp.mock.calls.filter((c) => c[2] === "cancelled");
    expect(снятия.length, "право на модуль осталось активным после отмены").toBeGreaterThan(0);
    expect(снятия[0][1]).toBe("qskyway");
  });
});
