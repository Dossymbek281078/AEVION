import express from "express";
import request from "supertest";
import { describe, test, expect, beforeEach, afterEach } from "vitest";

/**
 * Подмена валюты на денежном пути обязана быть ВИДНА витрине.
 *
 * Замер 24.09.2026: запрос кассы с `currency=KZT` возвращал 200,
 * `provider: lemonsqueezy` и `currency: USD` — без единого слова о том, что
 * просили другое. Человек выбирал тенге, а на экране оплаты видел доллары:
 * молчаливая замена (§16) ровно там, где человек расстаётся с деньгами.
 *
 * Здесь проверяется не выбор провайдера — его решают настройки, — а честность
 * ОТВЕТА: запрошенная валюта названа, и при расхождении стоит признак подмены.
 */
const поднять = async () => {
  const { checkoutRouter } = await import("../src/routes/checkout");
  const app = express();
  app.use(express.json());
  app.use("/api/pricing/checkout", checkoutRouter);
  return app;
};

const было = { ...process.env };
beforeEach(() => {
  // Ни PayBox, ни PayPal: путь уходит к долларовым запасным — ровно тот случай,
  // ради которого правило и написано.
  delete process.env.PAYBOX_MERCHANT_ID;
  delete process.env.PAYBOX_SECRET_KEY;
  process.env.GUMROAD_DEFAULT_PERMALINK = "aevion-test";
});
afterEach(() => { process.env = { ...было }; });

describe("касса называет валюту, которую у неё просили", () => {
  test("просили тенге, касса в долларах — в ответе признак подмены", async () => {
    const app = await поднять();
    const r = await request(app).post("/api/pricing/checkout/session").send({ tierId: "lite", currency: "KZT" });
    expect(r.status, `касса ответила ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`).toBe(200);
    expect(r.body.currency, "валюта ответа").toBe("USD");
    expect(r.body.requestedCurrency, "запрошенная валюта не названа").toBe("KZT");
    expect(r.body.currencySubstituted, "подмена не помечена").toBe(true);
  });

  test("контроль: просили доллары — признака подмены НЕТ", async () => {
    const app = await поднять();
    const r = await request(app).post("/api/pricing/checkout/session").send({ tierId: "lite", currency: "USD" });
    expect(r.status).toBe(200);
    expect(r.body.requestedCurrency).toBe("USD");
    expect(r.body.currencySubstituted, "подмена помечена там, где её нет").toBeUndefined();
  });

  test("контроль: валюту не просили — полей нет вовсе, ответ прежний", async () => {
    const app = await поднять();
    const r = await request(app).post("/api/pricing/checkout/session").send({ tierId: "lite" });
    expect(r.status).toBe(200);
    expect(r.body.requestedCurrency).toBeUndefined();
    expect(r.body.currencySubstituted).toBeUndefined();
  });
});
