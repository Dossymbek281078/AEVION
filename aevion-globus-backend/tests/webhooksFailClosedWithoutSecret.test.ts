import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { payboxPaymentProvider } from "../src/lib/payment/payboxProvider";
import { verifyPaypalWebhook } from "../src/lib/payment/paypalProvider";

/**
 * Сторож: вебхук без настроенного секрета НЕ подтверждает оплату.
 *
 * ЗАЧЕМ. По входящему вебхуку выдаётся купленное. Если проверка подписи
 * отключается сама, когда секрет не задан, то подтвердить оплату сможет кто
 * угодно — достаточно послать нам правдоподобный JSON. Это самый дорогой из
 * возможных отказов в платёжном контуре, и он ровно того сорта, что весь
 * день попадался в других местах: запасной путь включается молча и выглядит
 * как рабочая система.
 *
 * Замер 31.08.2026 показал, что все четыре вебхука ведут себя правильно —
 * ноль находок. Сторож нужен, чтобы этот ноль нельзя было отменить незаметно:
 * направление отказа здесь выбирается не удобством, а ценой ошибки.
 *
 * ГРАНИЦА: поведением проверяются PayBox и PayPal — у них проверка вынесена
 * в функции, которые можно позвать. Lemon Squeezy (без секрета событие
 * игнорируется, ответ помечен stub) и Gumroad (без секрета оплата
 * подтверждается обращением к API Gumroad со сверкой почты и товара)
 * проверяются в своих наборах: им нужен express.
 */
const СЕКРЕТЫ = ["PAYBOX_SECRET", "PAYPAL_WEBHOOK_ID"] as const;
const сохранённые: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of СЕКРЕТЫ) {
    сохранённые[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of СЕКРЕТЫ) {
    if (сохранённые[k] === undefined) delete process.env[k];
    else process.env[k] = сохранённые[k];
  }
});

describe("без секрета вебхук не подтверждает оплату", () => {
  it("PayBox отвечает invalid_signature, а не успехом", () => {
    const тело =
      "<?xml version='1.0'?><response><pg_payment_id>777</pg_payment_id>" +
      "<pg_result>1</pg_result><pg_order_id>tier_lite_monthly</pg_order_id></response>";
    const r = payboxPaymentProvider.parseWebhook({}, тело);
    expect(r.result.status, "оплата зачтена без проверки подписи").not.toBe("paid");
    expect(r.result.reason).toBe("invalid_signature");
  });

  it("PayPal не подтверждает событие", async () => {
    await expect(verifyPaypalWebhook({}, "{}")).resolves.toBe(false);
  });

  it("контроль прибора: с секретом PayBox доходит до СРАВНЕНИЯ подписи", () => {
    // Без этого контроля первый тест был бы зелёным и на сломанном коде:
    // достаточно, чтобы разбор падал по любой причине.
    process.env.PAYBOX_SECRET = "тест-секрет";
    const тело =
      "<?xml version='1.0'?><response><pg_payment_id>777</pg_payment_id>" +
      "<pg_result>1</pg_result><pg_sig>заведомо-неверная</pg_sig></response>";
    const r = payboxPaymentProvider.parseWebhook({}, тело);
    expect(r.result.reason).toBe("invalid_signature");
  });
});
