import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { qskywayRouter } from "../src/routes/qskyway";

// Живой прод 28.07.2026 отвечал HTTP 500 на ?city=constructor, ?city=__proto__ и
// ?city=toString. Причина — `id in CITIES`: `in` идёт по цепочке прототипов,
// поэтому ключом становилось само слово, а «городом» — функция
// Object.prototype.constructor.
//
// Задевало КАЖДУЮ ручку, зовущую resolveCity, включая регуляторные: по ним
// сторонний проверяющий судит, отвечает ли модуль предсказуемо. Пятисотка на
// строке, которую может прислать кто угодно, — это не косметика.

const app = express();
app.use("/api/qskyway", qskywayRouter);

const PROTO_KEYS = ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"];
const CITY_ROUTES = ["/api/qskyway/city", "/api/qskyway/airspace/impact"];

describe("QSkyway — ключ прототипа в ?city= не выдаётся за город", () => {
  it("набор служебных ключей не сократился молча", () => {
    // Перебор идёт ПО СПИСКУ: убрал ключ — проверка перестала его спрашивать и
    // осталась зелёной. 28.08.2026 тот же пробел нашёлся у пяти списков модуля;
    // здесь он последний. Порог поднимать можно и нужно, опускать — только
    // вместе с осознанным решением, что ключ больше не опасен.
    expect(PROTO_KEYS.length, "набор служебных слов сократился — покрытие упало молча").toBeGreaterThanOrEqual(5);
  });

  for (const route of CITY_ROUTES) {
    it.each(PROTO_KEYS)(`${route}?city=%s → 404, а не 500`, async (key) => {
      const r = await request(app).get(route).query({ city: key });
      expect(r.status).toBe(404);
      expect(r.body.error).toBeTruthy();
    });
  }

  it("настоящий город по-прежнему отвечает — иначе починка выродилась бы в «всегда 404»", async () => {
    // Без этой проверки тест был бы зелёным и на заглушке, отвергающей всё:
    // проверялось бы отсутствие дефекта, а не сохранность работы.
    const r = await request(app).get("/api/qskyway/city").query({ city: "nyc" });
    expect(r.status).toBe(200);
    expect(r.body.grid?.heights?.length).toBeGreaterThan(0);
  });

  it("город не указан — отдаётся город по умолчанию, а не 404", async () => {
    const r = await request(app).get("/api/qskyway/city");
    expect(r.status).toBe(200);
  });
});
