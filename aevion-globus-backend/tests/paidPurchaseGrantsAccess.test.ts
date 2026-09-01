import { describe, test, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Сквозная проверка денежного пути: ОПЛАТИЛ → ПОЛУЧИЛ ДОСТУП.
 *
 * ЗАЧЕМ. В наборе 33 теста про вебхуки оплаты, и ни один не спрашивает
 * главного: получает ли человек то, за что заплатил. Каждый шаг проверен
 * по отдельности — разбор ссылки заказа, запись подписки, чтение тарифа,
 * решение стены — и каждый зелёный. Но именно так выглядит класс поломок,
 * который у нас уже был на регистрации: сервер отвечает «ok», сторожа
 * зелёные, а человек не может пройти путь.
 *
 * Здесь НЕТ подмены выдачи и НЕТ подмены прав: вебхук пишет настоящий файл
 * подписок (во временный каталог), а тариф читает та же функция, которой
 * пользуется стена на проде. Подменён только разбор уведомления кассы —
 * это внешняя сторона, её в тесте быть не может.
 */

// Файл подписок ДО импорта модулей: путь читается на уровне модуля.
const каталог = mkdtempSync(join(tmpdir(), "aevion-e2e-"));
const файлПодписок = join(каталог, "subscriptions.jsonl");
process.env.SUBSCRIPTIONS_FILE = файлПодписок;

let полезная: Record<string, string> = {};
vi.mock("../src/lib/payment/payboxProvider", () => ({
  payboxPaymentProvider: {
    parseWebhook: () => ({
      result: { status: "paid", reason: null, raw: полезная },
      eventId: полезная.pg_payment_id,
    }),
  },
}));

vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));

const { payboxWebhookRouter } = await import("../src/routes/payboxWebhook");
const { resolvePlanFromPayload, isModuleEntitled, tiersForModule } = await import(
  "../src/lib/planGate"
);

function приложение() {
  const a = express();
  a.use((req, _res, next) => {
    (req as unknown as { rawBody: Buffer }).rawBody = Buffer.from("x");
    next();
  });
  a.use("/api/paybox", payboxWebhookRouter);
  return a;
}

let счётчик = 0;
async function оплатил(email: string, тариф: string) {
  счётчик += 1;
  полезная = {
    pg_user_contact_email: email,
    pg_order_id: `tier_${тариф}_monthly`,
    pg_payment_id: `pay-e2e-${счётчик}`,
  };
  return request(приложение()).post("/api/paybox/webhook").send();
}

afterAll(() => {
  delete process.env.SUBSCRIPTIONS_FILE;
});

describe("оплатил — получил доступ", () => {
  beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => {}));

  test("контроль: ДО оплаты доступа нет", () => {
    const план = resolvePlanFromPayload({ email: "новый@example.com" });
    expect(план.tier, "человек без покупки уже с тарифом — тест мерит не то").toBe("free");
    expect(isModuleEntitled(план, "multichat-engine")).toBe(false);
  });

  test("после оплаты medium доступ к закрытому модулю ЕСТЬ", async () => {
    const email = "buyer-e2e@example.com";
    const res = await оплатил(email, "medium");

    // Контроль прибора: платёж действительно проведён, а файл действительно
    // написан — иначе «доступа нет» означало бы, что мы меряем не тот путь.
    expect(res.body.action, "оплата не была проведена").toBe("activated");
    expect(existsSync(файлПодписок), "файл подписок не создан").toBe(true);
    expect(readFileSync(файлПодписок, "utf8"), "запись не попала в файл").toContain(email);

    const план = resolvePlanFromPayload({ email });
    expect(план.tier, "оплатил medium, а тариф другой").toBe("medium");

    // Модуль запуска 10.09: стена требует medium и выше.
    expect(tiersForModule("multichat-engine")).toContain("medium");
    expect(
      isModuleEntitled(план, "multichat-engine"),
      "человек заплатил, а доступа к купленному нет",
    ).toBe(true);
  });

  test("оплата младшего тарифа доступа к старшему модулю НЕ даёт", async () => {
    const email = "lite-e2e@example.com";
    await оплатил(email, "lite");
    const план = resolvePlanFromPayload({ email });
    expect(план.tier).toBe("lite");
    expect(
      isModuleEntitled(план, "multichat-engine"),
      "дешёвый тариф открыл модуль, который требует medium",
    ).toBe(false);
  });
});
