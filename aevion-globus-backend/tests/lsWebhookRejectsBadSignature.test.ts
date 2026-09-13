import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";
import { createHmac } from "node:crypto";

/**
 * Сторож: вебхук LemonSqueezy отвергает неверную подпись.
 *
 * ЗАЧЕМ. Замер 13.09.2026: мутация «считать подпись верной ВСЕГДА» прошла
 * незамеченной — девять файлов о вебхуке LemonSqueezy, 43 теста, все зелёные
 * на снятой проверке. Защита в коде есть (401 на строке 235) и работает на
 * проде, но её удаление не заметил бы никто.
 *
 * Тот же класс закрыт для PayBox и PayPal ещё 01.09 в
 * `payboxRejectsBadSignature.test.ts` — там же образец. LemonSqueezy и Gumroad
 * тогда не накрыли: починка легла на половину поверхности.
 *
 * КОНТРОЛЬ обязателен: без него «всегда 401» неотличимо от работающей
 * проверки. Верная подпись обязана НЕ давать 401.
 */
const СЕКРЕТ = "test-secret-not-a-real-one-0123456789";
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = СЕКРЕТ;

// Импорт статический, как в соседних тестах о вебхуке: динамический
// `await import()` внутри beforeAll не укладывается в 30 с — граф модуля
// тянется около половины минуты. Секрет читается ПРИ ЗАПРОСЕ
// (`const secret = process.env...` внутри обработчика), поэтому достаточно
// выставить переменную до первого запроса, а не до импорта.
import { lemonSqueezyWebhookRouter } from "../src/routes/lemonSqueezyWebhook";

function приложение() {
  const app = express();
  app.use(express.json());
  app.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter);
  return app;
}

const тело = { meta: { event_name: "order_created" }, data: { id: "1", attributes: {} } };

describe("подпись LemonSqueezy проверяется по-настоящему", () => {
  test("неверная подпись — 401 и НИКАКОЙ выдачи", async () => {
    const r = await request(приложение())
      .post("/api/lemonsqueezy/webhook")
      .set("x-signature", "00000000000000000000000000000000")
      .send(тело);
    expect(r.status, "неверная подпись обязана отвергаться").toBe(401);
  });

  test("подписи нет вовсе — тоже 401", async () => {
    const r = await request(приложение()).post("/api/lemonsqueezy/webhook").send(тело);
    expect(r.status, "отсутствие подписи обязано отвергаться").toBe(401);
  });

  test("КОНТРОЛЬ: с ВЕРНОЙ подписью ответ НЕ 401", async () => {
    const raw = JSON.stringify(тело);
    const подпись = createHmac("sha256", СЕКРЕТ).update(raw, "utf8").digest("hex");
    const r = await request(приложение())
      .post("/api/lemonsqueezy/webhook")
      .set("x-signature", подпись)
      .set("Content-Type", "application/json")
      .send(raw);
    expect(r.status, "верная подпись не должна давать 401 — иначе тест краснеет всегда").not.toBe(401);
  });
});
