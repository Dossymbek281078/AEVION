import { describe, test, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Сторож: уведомление с неверной подписью НЕ выдаёт подписку.
 *
 * ЗАЧЕМ. Мутация «убрать отказ по неверной подписи» не ловилась НИ ОДНИМ из
 * 45 файлов о вебхуках (замер 01.09.2026, проверено с тремя расширениями
 * выборки, чтобы не оклеветать сторожей). То есть единственные ворота на входе
 * платёжного уведомления никем не охранялись: убери их — и подделанный POST
 * выдаёт платный тариф.
 *
 * Проверяется РЕАКЦИЯ вебхука на вердикт провайдера, а не сама криптография:
 * подпись считает payboxProvider, и у него свой тест. Здесь важно, что вердикт
 * «подпись неверна» доводится до отказа, а не игнорируется.
 */
process.env.SUBSCRIPTIONS_FILE = join(mkdtempSync(join(tmpdir(), "aevion-sig-")), "s.jsonl");

let вердикт: string | null = null;
let полезная: Record<string, string> = {};
vi.mock("../src/lib/payment/payboxProvider", () => ({
  payboxPaymentProvider: {
    parseWebhook: () => ({
      result: { status: "paid", reason: вердикт, raw: полезная },
      eventId: полезная.pg_payment_id,
    }),
  },
}));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));

const { payboxWebhookRouter } = await import("../src/routes/payboxWebhook");
const { resolvePlanFromPayload } = await import("../src/lib/planGate");

let счётчик = 0;
async function уведомление(email: string) {
  счётчик += 1;
  полезная = {
    pg_user_contact_email: email,
    pg_order_id: "tier_medium_monthly",
    pg_payment_id: `sig-${счётчик}`,
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

describe("подпись PayBox проверяется по-настоящему", () => {
  beforeEach(() => {
    вердикт = null;
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  test("КОНТРОЛЬ: с верной подписью оплата проходит", async () => {
    // Иначе «неверная отбивается» означало бы, что отбивается вообще всё.
    const email = "sig-ok@example.com";
    const res = await уведомление(email);
    expect(res.body.action).toBe("activated");
    expect(resolvePlanFromPayload({ email }).tier).toBe("medium");
  });

  test("неверная подпись — 401 и НИКАКОЙ выдачи", async () => {
    вердикт = "invalid_signature";
    const email = "sig-bad@example.com";
    const res = await уведомление(email);

    expect(res.status, "подделанное уведомление принято").toBe(401);
    expect(res.body.action, "ответ утверждает, что доступ выдан").toBeUndefined();
    expect(
      resolvePlanFromPayload({ email }).tier,
      "подпись неверна, а тариф выдан",
    ).toBe("free");
  });

  test("после отказа запись в файл подписок не появилась", async () => {
    вердикт = "invalid_signature";
    const email = "sig-none@example.com";
    await уведомление(email);
    const файл = process.env.SUBSCRIPTIONS_FILE as string;
    const текст = existsSync(файл) ? readFileSync(файл, "utf8") : "";
    expect(текст, "отказ по подписи всё же оставил запись").not.toContain(email);
  });
});
