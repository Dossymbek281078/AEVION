import { describe, test, expect } from "vitest";
import request from "supertest";
import express from "express";

import { pricingRouter } from "../src/routes/pricing";

/**
 * Расчёт цены — это то, что видит человек перед оплатой. Проверка валюты стояла
 * на операторе `in`:
 *
 *   body.currency in CURRENCY_RATES
 *
 * `in` обходит и цепочку прототипов, поэтому строки вроде "constructor",
 * "toString", "valueOf" проходили её как настоящие валюты. Дальше код брал
 * `CURRENCY_RATES[currency].rate` — то есть `.rate` у функции `Object` — получал
 * undefined, и КАЖДАЯ цена в ответе превращалась в null.
 *
 * Замер на живом проде 27.07.2026 (записан автором починки):
 *   {"tierId":"lite","currency":"constructor"} → subtotal null, total null
 *   {"tierId":"lite","currency":"ZZZ"}         → откат на USD, total 24
 *
 * То есть ломались ровно те строки, которые пропускает `in`, а обычная
 * неизвестная валюта работала правильно. Такое не заметишь на глаз: страница
 * просто показывает пустоту вместо цены.
 *
 * Тест закрывает не одну строку "constructor", а весь класс: любой ключ
 * прототипа обязан вести себя как неизвестная валюта — откат на USD и живые
 * числа. Родственное: feedback_prototype_keys_in_lookups.
 */


function makeApp() {
  const a = express();
  a.use(express.json());
  a.use(pricingRouter);
  return a;
}

const PROTOTYPE_KEYS = [
  "constructor",
  "toString",
  "valueOf",
  "hasOwnProperty",
  "__proto__",
  "isPrototypeOf",
  "propertyIsEnumerable",
];

describe("Расчёт цены: ключи прототипа — не валюты", () => {
  test("настоящая валюта работает (контроль, чтобы тест не был зелёным всегда)", async () => {
    const r = await request(makeApp()).post("/quote").send({ tierId: "lite", currency: "EUR" });
    expect(r.status).toBe(200);
    expect(r.body.currency).toBe("EUR");
    expect(Number.isFinite(r.body.total)).toBe(true);
    expect(r.body.total).toBeGreaterThan(0);
  });

  test("обычная неизвестная валюта откатывается на USD с живыми числами", async () => {
    const r = await request(makeApp()).post("/quote").send({ tierId: "lite", currency: "ZZZ" });
    expect(r.status).toBe(200);
    expect(r.body.currency).toBe("USD");
    expect(Number.isFinite(r.body.total)).toBe(true);
    expect(r.body.total).toBeGreaterThan(0);
  });

  test.each(PROTOTYPE_KEYS)("ключ прототипа %s ведёт себя как неизвестная валюта", async (key) => {
    const r = await request(makeApp()).post("/quote").send({ tierId: "lite", currency: key });
    expect(r.status).toBe(200);
    // Главное: цена не пропала. Именно это видел бы человек на странице.
    expect(r.body.total).not.toBeNull();
    expect(Number.isFinite(r.body.total)).toBe(true);
    expect(r.body.total).toBeGreaterThan(0);
    // И валюта не должна остаться подделкой в ответе.
    expect(r.body.currency).toBe("USD");
  });

  test("ни одна строка сметы не остаётся без цены", async () => {
    const r = await request(makeApp())
      .post("/quote")
      .send({ tierId: "medium", currency: "constructor", seats: 3 });
    expect(r.status).toBe(200);
    const lines = Array.isArray(r.body.lines) ? r.body.lines : [];
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(Number.isFinite(l.total)).toBe(true);
      expect(Number.isFinite(l.unitPrice)).toBe(true);
    }
  });
});
