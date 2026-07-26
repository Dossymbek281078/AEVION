import { describe, test, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Контракт правдивости ответа чекаута.
 *
 * Он появился 2026-07-26 из-за находки: на LemonSqueezy и Gumroad скидка НЕ
 * доходит до счёта, а чекаут молча отдавал ссылку на полную цену, показав
 * скидку в смете. Теперь ответ обязан говорить, что произойдёт на самом деле —
 * и это единственная защита покупателя, поэтому она под тестом, а не «по
 * живому запросу один раз».
 *
 * Проверяются три вещи, которые ломаются молча:
 *   1. `chargeCurrency` есть ВСЕГДА (иначе клиент угадывает валюту по наличию
 *      поля — так и заводятся тихие ошибки);
 *   2. на канале, который умеет списывать нашу сумму, `chargedUsd == quotedUsd`;
 *   3. на канале с фиксированной ценой `chargedUsd === null` + причина, а НЕ
 *      красивое выдуманное число.
 */

const OLD_ENV = { ...process.env };

beforeAll(() => {
  process.env.FRONTEND_URL = "http://localhost:3000";
  delete process.env.LEMON_SQUEEZY_API_KEY;
  delete process.env.LEMON_SQUEEZY_ALLOW_CUSTOM_PRICE;
});

afterAll(() => {
  process.env = { ...OLD_ENV };
});

async function post(body: unknown, env: Record<string, string | undefined> = {}) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  // Роутер импортируем внутри, чтобы env успел примениться к модулю.
  const { checkoutRouter } = await import("../src/routes/checkout");
  const app = express();
  app.use(express.json());
  app.use("/api/pricing/checkout", checkoutRouter);
  return request(app).post("/api/pricing/checkout/session").send(body as object);
}

const ORDER = {
  tierId: "medium",
  modules: ["qright", "qcontract"],
  ownedModules: ["qsign"],
  promoCode: "AEVION20",
};

describe("ответ чекаута говорит правду о списании", () => {
  test("валюта списания есть в ответе всегда", async () => {
    const r = await post(ORDER, { GUMROAD_DEFAULT_PERMALINK: undefined });
    expect(r.status).toBe(200);
    expect(r.body.chargeCurrency).toBe("USD");
  });

  test("канал, который списывает нашу сумму: chargedUsd == quotedUsd и скидка учтена", async () => {
    const r = await post(ORDER, { GUMROAD_DEFAULT_PERMALINK: undefined });
    expect(r.body.discountHonoured).toBe(true);
    expect(r.body.chargedUsd).toBe(r.body.quotedUsd);
    expect(r.body.incentiveDiscountUsd).toBeGreaterThan(0);
    expect(r.body.fan.status).toBe("active");
    expect(r.body.fan.appliedUsd).toBeGreaterThan(0);
  });

  test("🔴 канал с фиксированной ценой: chargedUsd === null и названа причина", async () => {
    // Раньше здесь молча отдавалась ссылка на полную цену. Красивое выдуманное
    // число было бы второй ложью вместо первой — поэтому именно null.
    const r = await post(ORDER, { GUMROAD_DEFAULT_PERMALINK: "aevion-test" });
    expect(r.body.provider).toBe("gumroad");
    expect(r.body.discountHonoured).toBe(false);
    expect(r.body.chargedUsd).toBeNull();
    expect(r.body.tierListUsd).toBeGreaterThan(0);
    expect(String(r.body.discountNotHonouredReason)).toMatch(/Gumroad/);
    // Смета всё равно названа — покупателю и владельцу видно расхождение.
    expect(r.body.quotedUsd).toBeGreaterThan(0);
  });

  test("без скидок discountHonoured остаётся true (нечего не применять)", async () => {
    const r = await post(
      { tierId: "medium" },
      { GUMROAD_DEFAULT_PERMALINK: "aevion-test" },
    );
    expect(r.body.incentiveDiscountUsd).toBe(0);
    expect(r.body.discountHonoured).toBe(true);
  });
});
