import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { qskywayRouter } from "../src/routes/qskyway";
import { AIRSPACE_PROOFS } from "../src/routes/qskyway.airspace.proof";

// Город по умолчанию выбран по причине, а не по имени: у него обязана быть
// замкнута цепочка доказательств — издание ограничений и доказательство даты.
// До 14.09.2026 по умолчанию стояла Астана, и посетитель без ?city= видел
// «недоступно» ровно на том, что модуль продаёт; вдобавок над её твином
// действует запретная зона UAP28.
//
// Сторож спрашивает ручки, а не константу: другой город с цепочкой оставит его
// зелёным, город без цепочки — покрасит. Проверка метки в Bitcoin ходит в сеть,
// поэтому здесь только факт, что доказательство вшито.

const app = express();
app.use("/api/qskyway", qskywayRouter);

describe("город по умолчанию — там, где доказательства проверяемы", () => {
  it("/cities называет город по умолчанию, и без ?city= отдаётся именно он", async () => {
    const cities = await request(app).get("/api/qskyway/cities");
    expect(cities.status).toBe(200);
    const def = cities.body.default;
    expect(typeof def).toBe("string");

    const ed = await request(app).get("/api/qskyway/airspace/edition");
    expect(ed.status).toBe(200);
    expect(ed.body.city).toBe(def);
  });

  it("у города по умолчанию издание ограничений доступно и доказательство даты вшито", async () => {
    const def = (await request(app).get("/api/qskyway/cities")).body.default as string;
    const ed = await request(app).get("/api/qskyway/airspace/edition");
    expect(ed.body.available).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(AIRSPACE_PROOFS, def)).toBe(true);
  });

  it("контроль: прибор различает — у Астаны издания нет", async () => {
    // Без этой проверки `available: true` мог бы оказаться свойством ручки
    // вообще, а не города по умолчанию.
    const ed = await request(app).get("/api/qskyway/airspace/edition").query({ city: "astana" });
    expect(ed.status).toBe(200);
    expect(ed.body.available).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(AIRSPACE_PROOFS, "astana")).toBe(false);
  });
});
