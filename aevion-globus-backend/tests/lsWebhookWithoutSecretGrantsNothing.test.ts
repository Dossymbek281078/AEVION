import { describe, test, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Сторож: вебхук Lemon Squeezy без секрета НИЧЕГО не выдаёт.
 *
 * ЗАЧЕМ. Из четырёх входящих вебхуков два я проверил вызовом (PayBox и
 * PayPal), а два — ЧТЕНИЕМ кода. Чтение говорит: без секрета обработчик
 * отвечает { ok: true, mode: "stub" } и выходит. Но «прочитал и понял» и
 * «проверено» — разные утверждения, а цена ошибки здесь наибольшая: по этому
 * вебхуку выдаётся купленное, и если он однажды начнёт выдавать без проверки
 * подписи, доступ получит всякий, кто пришлёт правдоподобный JSON.
 */
const { mockQuery, mockProvision } = vi.hoisted(() => ({
  mockQuery: vi.fn(async () => ({ rows: [] })),
  mockProvision: vi.fn(async () => ({ subscription: {}, emailSent: false })),
}));

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/routes/provisioning", () => ({
  provisionSubscription: mockProvision,
  writeSubscription: vi.fn(),
}));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

const { lemonSqueezyWebhookRouter } = await import("../src/routes/lemonSqueezyWebhook");

const app = express();
app.use(express.json());
app.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter);

const событие = {
  meta: { event_name: "order_created", custom_data: { reference: "tier_lite_monthly" } },
  data: { id: "12345", attributes: { user_email: "buyer@example.com", variant_id: 1 } },
};

beforeEach(() => {
  mockProvision.mockClear();
  delete process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
});

describe("вебхук без секрета ничего не выдаёт", () => {
  test("событие принимается вежливо, но доступ не выдаётся", async () => {
    const r = await request(app)
      .post("/api/lemonsqueezy/webhook")
      .set("x-signature", "any-signature-value")
      .send(событие);

    // Контроль прибора: маршрут вообще существует и ответил, иначе «не
    // выдано» было бы правдой и на несуществующем адресе.
    expect(r.status, `маршрут ответил ${r.status}`).toBeLessThan(500);
    expect(
      mockProvision,
      "без секрета выдали доступ — подделать событие сможет кто угодно"
    ).not.toHaveBeenCalled();
  });

  test("ответ называет себя заглушкой, а не успехом выдачи", async () => {
    const r = await request(app)
      .post("/api/lemonsqueezy/webhook")
      .set("x-signature", "any-signature-value")
      .send(событие);
    expect(JSON.stringify(r.body)).toContain("stub");
  });
});
