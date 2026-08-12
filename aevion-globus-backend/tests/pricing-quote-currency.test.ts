/**
 * Смета: чужая валюта откатывается на USD С ЦИФРАМИ, а не в пустоту.
 *
 * До 12.08.2026 проверка валюты была написана как `body.currency in
 * CURRENCY_RATES`, а оператор `in` идёт по цепочке прототипов. Значение
 * "constructor" (и любой другой ключ прототипа) проходило проверку и
 * становилось валютой сметы. Дальше курс брался у функции Object, умножение
 * давало NaN — и человек получал смету БЕЗ ЦИФР.
 *
 * Отказа не было: ответ 200, структура на месте, суммы пустые. Нашёл
 * ежедневный прогон hostile-input, а не тест.
 */
import { describe, it, expect, beforeAll } from "vitest";
import express from "express";
import request from "supertest";

const HOSTILE = ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"];

let app: express.Express;

beforeAll(async () => {
  const { pricingRouter } = await import("../src/routes/pricing");
  app = express();
  app.use(express.json());
  app.use("/api/pricing", pricingRouter);
});

/**
 * Сравниваем с эталоном — сметой в USD.
 *
 * Первая версия теста искала NaN среди чисел ответа и ПРОШЛА на сломанном
 * коде: `JSON.stringify(NaN)` даёт `null`, поэтому NaN до клиента доезжает
 * как отсутствующее значение, а не как число. Проверка «есть ли NaN» такой
 * дефект не видит в принципе. Отсюда форма ниже: чужая валюта обязана дать
 * ровно ту же смету, что и USD, — это и есть «честный откат на USD».
 */
async function quote(app: express.Express, currency?: string) {
  const res = await request(app)
    .post("/api/pricing/quote")
    .send({ tierId: "medium", seats: 3, ...(currency === undefined ? {} : { currency }) });
  return res;
}

describe("pricing /quote — чужая валюта", () => {
  it("ключ прототипа как валюта даёт ту же смету, что USD", async () => {
    const base = await quote(app, "USD");
    expect(base.status).toBe(200);

    for (const currency of HOSTILE) {
      const res = await quote(app, currency);
      expect(res.status, `валюта ${currency}`).toBe(200);
      expect(res.body, `валюта ${currency}: смета разошлась с USD`).toEqual(base.body);
    }
  });

  it("неизвестная строка тоже откатывается на USD", async () => {
    const base = await quote(app, "USD");
    const res = await quote(app, "XYZ");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(base.body);
  });

  it("настоящая валюта принимается и даёт ДРУГИЕ суммы", async () => {
    const base = await quote(app, "USD");
    const eur = await quote(app, "EUR");
    expect(eur.status).toBe(200);
    // Иначе тест выше был бы зелёным и при полностью сломанном пересчёте.
    expect(eur.body).not.toEqual(base.body);
  });
});
