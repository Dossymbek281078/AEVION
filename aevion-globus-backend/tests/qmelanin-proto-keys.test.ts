/**
 * QMelanin: ключ прототипа не становится биомаркером.
 *
 * До 12.08.2026 фильтр входящих ключей был написан как `k in BIOMARKER_BY_KEY`,
 * а оператор `in` идёт по цепочке прототипов. Поэтому "constructor",
 * "__proto__", "toString", "valueOf" и "hasOwnProperty" проходили проверку и
 * попадали в план питания — с пустым названием, потому что
 * BIOMARKER_BY_KEY["constructor"] это функция Object, а не спецификация.
 *
 * Отказа не было ни разу: ответ 200, план построен, в нём просто пустая
 * строка вместо нутриента. Нашёл ежедневный прогон hostile-input, а не тест.
 */
import { describe, it, expect, beforeAll } from "vitest";
import express from "express";
import request from "supertest";

const PROTO_KEYS = ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"];

let app: express.Express;

beforeAll(async () => {
  const { qmelaninRouter } = await import("../src/routes/qmelanin");
  app = express();
  app.use(express.json());
  app.use("/api/qmelanin", qmelaninRouter);
});

describe("qmelanin /plan — ключи прототипа", () => {
  it("ни один ключ прототипа не попадает в план", async () => {
    const res = await request(app)
      .post("/api/qmelanin/plan")
      .send({ deficientKeys: PROTO_KEYS });

    expect(res.status).toBe(200);
    // targeted — это блок «под ваш дефицит»; из мусорных ключей он обязан
    // остаться пустым, а не содержать записи без названия.
    expect(res.body.targeted).toEqual([]);
  });

  it("каждый ключ прототипа по отдельности тоже отбрасывается", async () => {
    for (const k of PROTO_KEYS) {
      const res = await request(app)
        .post("/api/qmelanin/plan")
        .send({ deficientKeys: [k] });
      expect(res.status, `ключ ${k}`).toBe(200);
      expect(res.body.targeted, `ключ ${k} попал в план`).toEqual([]);
    }
  });

  it("настоящий биомаркер по-прежнему проходит и получает название", async () => {
    const res = await request(app)
      .post("/api/qmelanin/plan")
      .send({ deficientKeys: ["vitaminD"] });

    expect(res.status).toBe(200);
    // Проверяем не только длину: дефект был именно в том, что запись есть,
    // а названия у неё нет.
    expect(res.body.targeted.length).toBeGreaterThan(0);
    for (const t of res.body.targeted) {
      expect(typeof t.nutrient).toBe("string");
      expect(t.nutrient.length).toBeGreaterThan(0);
    }
  });
});
