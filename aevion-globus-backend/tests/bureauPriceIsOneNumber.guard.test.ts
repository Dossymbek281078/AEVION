/*
 * Цена проверки Verified — одно число, и оно доезжает до покупателя.
 *
 * 🔴 Повод, 30.09.2026. Прод отвечал `payment: misconfigured` (бюро не могло
 * взять деньги вовсе), а цена на витрине стояла $19 в 11 строках шести файлов
 * при решении основателя «$29 в месяц» от 14–15.09. И отдельно опасное:
 * `createIntent` получал `reference: verificationId` — случайный номер, которому
 * в кассе не сопоставлено ничего. LemonSqueezy берёт тогда товар по умолчанию, а
 * он равен DevHub Studio Pro $149/мес: сайт назвал бы $29, списали бы $149 и
 * выдали бы чужой продукт.
 *
 * Поэтому сторож проверяет ТРИ вещи, и каждую — не по замыслу:
 *   1. ручка `/health` отдаёт цену (запрос и ТЕЛО ответа, а не вызов функции);
 *   2. ссылка, которую мы теперь посылаем, сопоставлена товару, а прежняя — нет;
 *   3. умолчание цены равно тому, что показывает витрина (её сторож — с той
 *      стороны, он читает этот же файл).
 */
import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import express from "express";
import { bureauRouter } from "../src/routes/bureau";
import { getVerifiedTierPriceCents, getVerifiedTierCurrency } from "../src/lib/payment";
import { lemonSqueezyPaymentProvider } from "../src/lib/payment/lemonSqueezyProvider";

const ОЖИДАЕМЫЕ_ЦЕНТЫ = 2900;

function приложение() {
  const app = express();
  app.use(express.json());
  app.use("/api/bureau", bureauRouter);
  return app;
}

describe("цена проверки бюро — одно число и один товар", () => {
  it("ручка /health отдаёт цену, период и валюту — гостю, без входа", async () => {
    const r = await request(приложение()).get("/api/bureau/health");
    expect(r.status).toBe(200);
    expect(r.body.pricing, "без этого поля витрине пришлось бы держать своё число").toBeTruthy();
    expect(r.body.pricing.verifiedTierCents).toBe(ОЖИДАЕМЫЕ_ЦЕНТЫ);
    expect(r.body.pricing.currency).toBe("USD");
    // Период — часть обещания: «$29» без «в месяц» это другая цена.
    expect(r.body.pricing.period).toBe("monthly");
  });

  it("умолчание цены — $29, переменная его переназначает", () => {
    const было = process.env.BUREAU_VERIFIED_PRICE_CENTS;
    delete process.env.BUREAU_VERIFIED_PRICE_CENTS;
    expect(getVerifiedTierPriceCents()).toBe(ОЖИДАЕМЫЕ_ЦЕНТЫ);
    expect(getVerifiedTierCurrency()).toBe("USD");
    process.env.BUREAU_VERIFIED_PRICE_CENTS = "3500";
    expect(getVerifiedTierPriceCents()).toBe(3500);
    // Отрицательный контроль: мусор не становится ценой.
    process.env.BUREAU_VERIFIED_PRICE_CENTS = "ой";
    expect(getVerifiedTierPriceCents()).toBe(ОЖИДАЕМЫЕ_ЦЕНТЫ);
    if (было === undefined) delete process.env.BUREAU_VERIFIED_PRICE_CENTS;
    else process.env.BUREAU_VERIFIED_PRICE_CENTS = было;
  });

  /*
   * 🔴 ГЛАВНОЕ ЗДЕСЬ — отказ вместо подмены товара, и он проверяется вызовом.
   *
   * Прежде провайдер на несопоставленной ссылке писал предупреждение в журнал и
   * продавал товар по умолчанию — подписку DevHub Studio Pro $149/мес. Бюро
   * посылало туда случайный номер проверки, то есть обещание «$29 в месяц»
   * обернулось бы списанием $149 за чужой продукт. Журнал читают после, а
   * деньги списываются сразу.
   *
   * Контроль в обе стороны обязателен: без второго случая «отказывает всегда»
   * выглядело бы так же зелено, а это остановило бы все продажи.
   */
  it("несопоставленная ссылка — ОТКАЗ, а не товар по умолчанию", async () => {
    const было = { ...process.env };
    process.env.LEMON_SQUEEZY_API_KEY = "test-key";
    process.env.LEMON_SQUEEZY_STORE_ID = "123456";
    process.env.LEMON_SQUEEZY_DEFAULT_VARIANT_ID = "999999";
    await expect(
      lemonSqueezyPaymentProvider.createIntent({
        reference: "550e8400-e29b-41d4-a716-446655440000",
        amountCents: 2900,
        currency: "USD",
        description: "AEVION Bureau — Verified tier upgrade",
        email: null,
      }),
    ).rejects.toThrow(/не сопоставлена товару/);
    process.env = было;
  });

  it("сопоставленная ссылка проходит и уезжает ИМЕННО своим товаром", async () => {
    const было = { ...process.env };
    process.env.LEMON_SQUEEZY_API_KEY = "test-key";
    process.env.LEMON_SQUEEZY_STORE_ID = "123456";
    process.env.LEMON_SQUEEZY_DEFAULT_VARIANT_ID = "999999";
    process.env.LEMON_SQUEEZY_VARIANT_IP_BUREAU_LITE = "4242424";
    const отправлено: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init: RequestInit) => {
        отправлено.push(JSON.parse(String(init.body)));
        return {
          ok: true,
          status: 201,
          json: async () => ({ data: { id: "chk_1", attributes: { url: "https://example.test/checkout" } } }),
          text: async () => "",
        } as unknown as Response;
      }),
    );
    const intent = await lemonSqueezyPaymentProvider.createIntent({
      reference: "app_ip_bureau_lite",
      amountCents: 3200,
      currency: "USD",
      description: "AEVION IP Bureau",
      email: null,
    });
    expect(intent.checkoutUrl).toContain("example.test");
    const тело = отправлено[0] as { data: { relationships: { variant: { data: { id: string } } } } };
    expect(
      тело.data.relationships.variant.data.id,
      "уехать должен СВОЙ товар, а не тот, что стоит в умолчании",
    ).toBe("4242424");
    vi.unstubAllGlobals();
    process.env = было;
  });
});
