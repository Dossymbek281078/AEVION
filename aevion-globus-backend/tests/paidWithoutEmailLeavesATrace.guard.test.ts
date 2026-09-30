import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "node:crypto";

/**
 * Сторож: ОПЛАТА, КОТОРУЮ НЕКОМУ ВЫДАТЬ, обязана быть слышной У НАС.
 *
 * Повод 30.09.2026. Вебхук кассы отвечал на письмо без адреса покупателя одним
 * кодом 400. Со стороны Lemon Squeezy это выглядит как повтор доставки, и пока
 * повторы идут, кажется, что всё под контролем. Но повторы кончаются, а у нас об
 * этой оплате не остаётся НИ ОДНОГО следа: ни в журнале, ни в Sentry. Деньги
 * прошли, доступ не выдан, и узнать об этом было неоткуда.
 *
 * Проверяется ОТВЕТ РУЧКИ и НАШ канал тревог, а не функция рядом: ровно на этом
 * за смену трижды попались зелёные сторожа, охранявшие помощника вместо вывода.
 */

const SECRET = "test-ls-secret-trace";
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;

const { тревоги } = vi.hoisted(() => ({ тревоги: vi.fn() }));

vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => тревоги }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: vi.fn().mockResolvedValue({ rows: [] }) }) }));
vi.mock("../src/routes/provisioning", () => ({
  provisionSubscription: vi.fn().mockResolvedValue({ subscription: { id: "s1" } }),
  writeSubscription: vi.fn(),
}));

// eslint-disable-next-line import/first
import { lemonSqueezyWebhookRouter } from "../src/routes/lemonSqueezyWebhook";

function послать(payload: Record<string, unknown>) {
  const raw = JSON.stringify(payload);
  const подпись = crypto.createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  const app = express();
  app.use(express.json());
  app.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter);
  return request(app)
    .post("/api/lemonsqueezy/webhook")
    .set("Content-Type", "application/json")
    .set("X-Signature", подпись)
    .send(raw);
}

const оплатаБезАдреса = (адрес?: string) => ({
  meta: { event_name: "subscription_created" },
  data: {
    id: "sub_no_email_1",
    attributes: { variant_id: "9999", total: 3200, ...(адрес ? { user_email: адрес } : {}) },
  },
});

beforeEach(() => тревоги.mockReset());

describe("оплата без адреса покупателя", () => {
  test("отказ 400 И след в нашем канале тревог", async () => {
    const о = await послать(оплатаБезАдреса());

    expect(о.status, "письмо без адреса обязано быть отвергнуто").toBe(400);

    // Главное утверждение: след. Без него правка была бы комментарием.
    const поводы = тревоги.mock.calls.map((c) => String((c[0] as Error)?.message ?? c[0]));
    expect(
      поводы.some((п) => п.includes("ls_paid_without_email")),
      `оплата без адреса не оставила следа у нас; тревоги: ${JSON.stringify(поводы)}`,
    ).toBe(true);

    // И номер заказа назван — по нему покупателя находят в кабинете кассы.
    expect(поводы.join(" ")).toContain("sub_no_email_1");
  });

  test("контроль: письмо С адресом этой тревоги НЕ поднимает", async () => {
    // Без этого контроля сторож зеленел бы и на «тревога всегда», то есть
    // охранял бы шум, а не событие.
    await послать(оплатаБезАдреса("buyer@test.aev"));
    const поводы = тревоги.mock.calls.map((c) => String((c[0] as Error)?.message ?? c[0]));
    expect(
      поводы.some((п) => п.includes("ls_paid_without_email")),
      `ложная тревога на нормальной оплате: ${JSON.stringify(поводы)}`,
    ).toBe(false);
  });
});
