import { describe, test, expect } from "vitest";
import request from "supertest";
import express from "express";
import { qmelaninRouter } from "../src/routes/qmelanin";
import { pricingRouter } from "../src/routes/pricing";

/**
 * Ключи прототипа во входных данных.
 *
 * Обычный объект наследует эти имена от Object.prototype, поэтому оператор `in`
 * отвечает на них true, хотя своего такого ключа в карте нет. Любой белый
 * список, построенный на `key in MAP`, они проходят насквозь.
 *
 * Найдено пробником враждебного ввода 04.08.2026 на живом проде: обе ручки
 * отвечали 200, то есть дефект молчаливый — ни падения, ни ошибки в логах,
 * просто неправильный ответ. Тест бьёт по САМИМ ручкам, а не по предикату:
 * предикат в отрыве был бы зелёным и в старом коде тоже.
 */
const PROTO_KEYS = ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"];

function appWith(prefix: string, router: express.Router) {
  const app = express();
  app.use(express.json());
  app.use(prefix, router);
  return app;
}

describe("qmelanin /plan — ключ прототипа не становится нутриентом", () => {
  test("ни один ключ прототипа не попадает в план", async () => {
    const app = appWith("/api/qmelanin", qmelaninRouter);
    const res = await request(app)
      .post("/api/qmelanin/plan")
      .send({ deficientKeys: PROTO_KEYS });

    expect(res.status).toBe(200);
    const targeted = res.body.targeted ?? [];
    expect(targeted).toHaveLength(0);
    // До правки сюда попадали записи с nutrient: undefined — план питания
    // с безымянным нутриентом и без продуктов.
    for (const t of targeted) expect(t.nutrient).toBeTruthy();
  });

  test("настоящий биомаркер по-прежнему принимается", async () => {
    const app = appWith("/api/qmelanin", qmelaninRouter);
    const res = await request(app)
      .post("/api/qmelanin/plan")
      .send({ deficientKeys: ["copper"] });

    expect(res.status).toBe(200);
    // Страховка от «починили, отрезав всё»: правка обязана пропускать
    // собственные ключи карты, иначе тест выше был бы зелёным и на заглушке.
    expect(res.body.targeted).toHaveLength(1);
    expect(res.body.targeted[0].key).toBe("copper");
    expect(res.body.targeted[0].nutrient).toBeTruthy();
  });
});

describe("pricing /quote — чужая валюта откатывается на USD с цифрами", () => {
  for (const key of PROTO_KEYS) {
    test(`currency="${key}" → USD и смета с числами`, async () => {
      const app = appWith("/api/pricing", pricingRouter);
      const res = await request(app)
        .post("/api/pricing/quote")
        .send({ tierId: "medium", currency: key, seats: 3 });

      expect(res.status).toBe(200);
      expect(res.body.currency).toBe("USD");
      // Суть дефекта была не в валюте, а в том, что вместо курса в расчёт
      // уходила функция и смета возвращалась без чисел.
      expect(typeof res.body.total).toBe("number");
      expect(Number.isFinite(res.body.total)).toBe(true);
      expect(res.body.total).toBeGreaterThan(0);
    });
  }

  test("настоящая валюта не сломана", async () => {
    const app = appWith("/api/pricing", pricingRouter);
    const res = await request(app)
      .post("/api/pricing/quote")
      .send({ tierId: "medium", currency: "KZT", seats: 3 });

    expect(res.status).toBe(200);
    expect(res.body.currency).toBe("KZT");
    expect(Number.isFinite(res.body.total)).toBe(true);
  });
});
