/*
 * 🔴 19.10.2026, вариант «Б»: план на срок приходит в вебхук вариантом tier_lite
 * (помесячно) или tier_<t> (вперёд) с custom_data {term, billing}. Ступень — из term,
 * но только при сумме, равной ожидаемой для пары. Подделанный/непонятный term или
 * сумма ниже ожидаемой — отказ без выдачи (409/400); ключ дедупликации отпущен.
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

const SECRET = "test-ls-secret-plan";
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;
process.env.LEMON_SQUEEZY_VARIANT_LITE = "8101";
process.env.LEMON_SQUEEZY_VARIANT_MAX = "8112";

const { mockQuery, mockProvision } = vi.hoisted(() => ({ mockQuery: vi.fn(), mockProvision: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/routes/provisioning", () => ({ provisionSubscription: mockProvision, writeSubscription: vi.fn() }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

// eslint-disable-next-line import/first
import { lemonSqueezyWebhookRouter } from "../src/routes/lemonSqueezyWebhook";

function makeApp() { const app = express(); app.use(express.json()); app.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter); return app; }
let n = 0;
function post(custom: Record<string, string> | undefined, variantId: string, totalCents: number, event = "subscription_created") {
  n += 1;
  const payload = {
    meta: { event_name: event, ...(custom ? { custom_data: custom } : {}) },
    data: { id: `sub_plan_${n}`, attributes: { user_email: "buyer@test.aev", variant_id: variantId, total: totalCents } },
  };
  const raw = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  return request(makeApp()).post("/api/lemonsqueezy/webhook").set("Content-Type", "application/json").set("X-Signature", sig).send(raw);
}

beforeEach(() => {
  mockQuery.mockReset(); mockQuery.mockResolvedValue({ rows: [] });
  mockProvision.mockReset(); mockProvision.mockResolvedValue({ subscription: { id: "s1" } });
});

describe("вебхук: план по custom_data.term", () => {
  test("Lite-вариант + term=medium/monthly + $225 → ступень medium на 3 месяца", async () => {
    const r = await post({ term: "medium", billing: "monthly" }, "8101", 22500);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.tierId).toBe("medium");
    expect(mockProvision).toHaveBeenCalledTimes(1);
    expect(mockProvision.mock.calls[0][0]).toMatchObject({ tierId: "medium", termMonths: 3, amountUsd: 225 });
  });
  test("Lite-вариант + term=max/monthly + $150 → ступень max на 12 месяцев", async () => {
    const r = await post({ term: "max", billing: "monthly" }, "8101", 15000);
    expect(r.status).toBe(200);
    expect(mockProvision.mock.calls[0][0]).toMatchObject({ tierId: "max", termMonths: 12 });
  });
  test("Max-вариант + term=max/prepaid + $1575 → ступень max", async () => {
    const r = await post({ term: "max", billing: "prepaid" }, "8112", 157500);
    expect(r.status).toBe(200);
    expect(mockProvision.mock.calls[0][0]).toMatchObject({ tierId: "max", termMonths: 12, amountUsd: 1575 });
  });
  test("🔴 подделанный term: max/prepaid при списанных $150 → 409, доступ НЕ выдан", async () => {
    const r = await post({ term: "max", billing: "prepaid" }, "8101", 15000);
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("plan_amount_mismatch");
    expect(mockProvision).not.toHaveBeenCalled();
  });
  test("🔴 term без billing / чужой term → 400, доступ НЕ выдан", async () => {
    expect((await post({ term: "max" }, "8101", 15000)).status).toBe(400);
    expect((await post({ term: "enterprise", billing: "monthly" }, "8101", 15000)).status).toBe(400);
    expect((await post({ billing: "monthly" }, "8101", 25000)).status).toBe(400);
    expect(mockProvision).not.toHaveBeenCalled();
  });
  test("цент недоплаты — отказ, переплата — выдача (скидочных кодов на плане нет)", async () => {
    expect((await post({ term: "medium", billing: "monthly" }, "8101", 22499)).status).toBe(409);
    expect(mockProvision).not.toHaveBeenCalled();
    expect((await post({ term: "medium", billing: "monthly" }, "8101", 22600)).status).toBe(200);
    expect(mockProvision).toHaveBeenCalledTimes(1);
  });
  test("КОНТРОЛЬ: без custom_data Lite-вариант по-прежнему выдаёт lite на 1 месяц", async () => {
    const r = await post(undefined, "8101", 25000);
    expect(r.status).toBe(200);
    expect(mockProvision.mock.calls[0][0]).toMatchObject({ tierId: "lite", termMonths: 1 });
  });
  test("отказ отпускает ключ дедупликации: тот же платёж с верной суммой проходит", async () => {
    const custom = { term: "medium", billing: "monthly" };
    const r1 = await post(custom, "8101", 10000);
    expect(r1.status).toBe(409);
    n -= 1; // тот же id подписки
    const r2 = await post(custom, "8101", 22500);
    expect(r2.status).toBe(200);
  });
});
