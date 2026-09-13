import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Сторож: вебхук Gumroad отвергает подделанную подпись.
 *
 * ЗАЧЕМ. Замер 13.09.2026: мутация «убрать отказ по неверной подписи» прошла
 * незамеченной — восемь файлов о вебхуке Gumroad, 29 тестов, все зелёные на
 * снятом барьере. Защита в коде есть (401 на строке 292), но её удаление не
 * заметил бы никто.
 *
 * Тот же класс закрыт для PayBox и PayPal ещё 01.09 в
 * `payboxRejectsBadSignature.test.ts`; LemonSqueezy закрыт сегодня соседним
 * файлом. Починка тогда накрыла половину поверхности — здесь вторая половина.
 *
 * Почему 401 важен именно тут: без него подделанный вызов проваливается в
 * ветку «нет адреса» и получает 200, то есть Gumroad считает доставку
 * успешной и НЕ повторяет её. Это написано в комментарии самого маршрута.
 *
 * Проверяется РЕАКЦИЯ маршрута на вердикт провайдера, а не сама криптография:
 * подпись считает gumroadProvider, и у него свой тест.
 */
let вердикт: string | null = null;
vi.mock("../src/lib/payment/gumroadProvider", () => ({
  gumroadPaymentProvider: {
    parseWebhook: () => ({
      result: { status: "paid", reason: вердикт, raw: { email: "kto@example.com", product_permalink: "xxx" } },
      eventId: "sale-1",
    }),
  },
  verifyGumroadSaleDetailed: async () => ({ ok: true }),
}));

import { gumroadWebhookRouter } from "../src/routes/gumroadWebhook";

function приложение() {
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use("/api/gumroad", gumroadWebhookRouter);
  return app;
}

describe("подпись Gumroad проверяется по-настоящему", () => {
  test("вердикт «подпись неверна» — 401 и НИКАКОЙ выдачи", async () => {
    вердикт = "invalid_signature";
    const r = await request(приложение()).post("/api/gumroad/webhook").send({ email: "kto@example.com" });
    expect(r.status, "подделанная подпись обязана отвергаться").toBe(401);
    expect(String(r.text)).toContain("invalid_signature");
  });

  test("КОНТРОЛЬ: при верной подписи ответ НЕ 401", async () => {
    вердикт = null;
    const r = await request(приложение()).post("/api/gumroad/webhook").send({ email: "kto@example.com" });
    expect(r.status, "верная подпись не должна давать 401 — иначе тест краснеет всегда").not.toBe(401);
  });
});
