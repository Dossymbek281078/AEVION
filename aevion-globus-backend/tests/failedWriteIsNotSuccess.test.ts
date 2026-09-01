import { describe, test, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Сторож: отказ записи подписки НЕ выглядит успехом.
 *
 * ЗАЧЕМ. Запись тарифа проглатывала ошибку: писала в журнал, отправляла в
 * Sentry — и возвращалась как при успехе. Дальше выдача слала человеку письмо
 * «доступ открыт», вебхук отвечал кассе 200 activated, касса считала доставку
 * успешной и БОЛЬШЕ НЕ ПОВТОРЯЛА. Человек заплатил, получил письмо, доступа не
 * получил, и восстановить было нечем.
 *
 * Тот же разбор давно сделан для второго хранилища (lemonSqueezyWebhook), там
 * ошибку не глотают. Здесь оставалось по-старому — при том что тарифный доступ
 * решает именно этот файл.
 */

process.env.SUBSCRIPTIONS_FILE = join(mkdtempSync(join(tmpdir(), "aevion-fw-")), "s.jsonl");

let ронятьЗапись = false;
vi.mock("fs", async (настоящий) => {
  const fs = (await настоящий()) as typeof import("fs");
  return {
    ...fs,
    appendFileSync: (...а: Parameters<typeof fs.appendFileSync>) => {
      if (ронятьЗапись) throw new Error("диск недоступен");
      return fs.appendFileSync(...а);
    },
  };
});

vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));

let полезная: Record<string, string> = {};
vi.mock("../src/lib/payment/payboxProvider", () => ({
  payboxPaymentProvider: {
    parseWebhook: () => ({
      result: { status: "paid", reason: null, raw: полезная },
      eventId: полезная.pg_payment_id,
    }),
  },
}));

const { payboxWebhookRouter } = await import("../src/routes/payboxWebhook");
const { resolvePlanFromPayload } = await import("../src/lib/planGate");

let счётчик = 0;
async function оплатил(email: string) {
  счётчик += 1;
  полезная = {
    pg_user_contact_email: email,
    pg_order_id: "tier_medium_monthly",
    pg_payment_id: `fw-${счётчик}`,
  };
  const a = express();
  a.use((req, _r, next) => {
    (req as unknown as { rawBody: Buffer }).rawBody = Buffer.from("x");
    next();
  });
  a.use("/api/paybox", payboxWebhookRouter);
  return request(a).post("/api/paybox/webhook").send();
}

afterAll(() => {
  delete process.env.SUBSCRIPTIONS_FILE;
});

describe("отказ записи подписки не выдаётся за успех", () => {
  beforeEach(() => {
    ронятьЗапись = false;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  test("контроль: при исправной записи оплата проходит", async () => {
    // Без этого «касса получила отказ» означало бы, что она получает его
    // всегда, и сторож не про запись вовсе.
    const res = await оплатил("ok-write@example.com");
    expect(res.body.action).toBe("activated");
    expect(resolvePlanFromPayload({ email: "ok-write@example.com" }).tier).toBe("medium");
  });

  test("запись упала — касса получает ОТКАЗ, а не activated", async () => {
    ронятьЗапись = true;
    const email = "bad-write@example.com";
    const res = await оплатил(email);

    expect(res.status, "касса получила успех при неудавшейся записи").toBeGreaterThanOrEqual(500);
    expect(res.body.action, "ответ утверждает, что доступ выдан").toBeUndefined();
  });

  test("после упавшей записи тарифа у человека НЕТ", async () => {
    ронятьЗапись = true;
    const email = "no-access@example.com";
    await оплатил(email);
    expect(
      resolvePlanFromPayload({ email }).tier,
      "запись не удалась, а тариф откуда-то взялся",
    ).toBe("free");
  });
});
