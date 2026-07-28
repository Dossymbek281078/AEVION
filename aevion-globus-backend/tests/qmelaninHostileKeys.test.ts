import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { qmelaninRouter } from "../src/routes/qmelanin";

// `k in BIOMARKER_BY_KEY` пропускал ключи прототипа: "constructor" проходил
// фильтр, а BIOMARKER_BY_KEY["constructor"] — функция Object. Падения не было —
// .label и .drives у функции просто undefined, и человек получал рекомендацию
// С ПУСТЫМ НАЗВАНИЕМ нутриента. В модуле про здоровье тихий неверный ответ хуже
// отказа: отказ видно, а пустую строку принимают за пробел в вёрстке.

const app = express();
app.use(express.json());
app.use("/api/qmelanin", qmelaninRouter);

const PROTO_KEYS = ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"];

describe("POST /api/qmelanin/plan — ключ прототипа не биомаркер", () => {
  it.each(PROTO_KEYS)("«%s» не попадает в план", async (key) => {
    const r = await request(app).post("/api/qmelanin/plan").send({ deficientKeys: [key] });
    expect(r.status).toBe(200);
    const targeted = r.body.targeted ?? [];
    expect(targeted.map((t: { key: string }) => t.key)).not.toContain(key);
    // Ни одной записи без названия нутриента — именно это и уходило человеку.
    for (const t of targeted) expect(t.nutrient).toBeTruthy();
  });

  it("настоящий биомаркер по-прежнему попадает — иначе фильтр выродился бы в «всегда пусто»", async () => {
    const r = await request(app).post("/api/qmelanin/plan").send({ deficientKeys: ["copper"] });
    expect(r.status).toBe(200);
    const targeted = r.body.targeted ?? [];
    expect(targeted.map((t: { key: string }) => t.key)).toContain("copper");
    expect(targeted[0].nutrient).toBeTruthy();
  });
});
