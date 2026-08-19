import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";
import { qmelaninRouter } from "../src/routes/qmelanin";

/**
 * Пустая анкета — не «низкий риск».
 *
 * Найдено 20.08.2026 замером записей. `POST /api/qmelanin/assessment` с телом
 * `{}` отвечал:
 *
 *   { riskScore: 0, riskBand: "low", factors: [] }
 *
 * У каждого поля есть умолчание — возраст 40, стресс 0, сон 7 часов, питание
 * «смешанное», а familyHistory и smoking приходят через Boolean(undefined),
 * то есть false. Ни одно из них человек не называл. Проверено на проде.
 *
 * В модуле про здоровье это опаснее отказа: отказ видно, а успокаивающий ответ
 * принимают на веру. «Факторов не найдено» читается как «мы проверили».
 * Отсутствие данных — не признак благополучия.
 */

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qmelanin", qmelaninRouter);
  return a;
}

describe("оценка риска не выдумывается из умолчаний", () => {
  test("пустое тело даёт unknown, а не low", async () => {
    const res = await request(app()).post("/api/qmelanin/assessment").send({});
    expect(res.status).toBe(200);
    expect(res.body.riskBand, "снова успокаивает без данных").not.toBe("low");
    expect(res.body.riskBand).toBe("unknown");
    expect(res.body.riskScore, "ноль читается как измерение").toBeNull();
    expect(String(res.body.warning ?? ""), "нет объяснения человеку").toMatch(/не заполнена/);
  });

  test("не зная ничего, панель обследования не сужается", async () => {
    const empty = await request(app()).post("/api/qmelanin/assessment").send({});
    const low = await request(app())
      .post("/api/qmelanin/assessment")
      .send({ onsetAge: 55, familyHistory: false, smoking: false, stress: 1, sleepHours: 8, diet: "mixed" });
    expect(low.body.riskBand).toBe("low");
    expect(
      empty.body.recommendedPanel.length,
      "при пустой анкете панель урезана до короткой, как при подтверждённом низком риске",
    ).toBeGreaterThan(low.body.recommendedPanel.length);
  });

  test("видно, что заполнено, а что подставлено", async () => {
    const res = await request(app())
      .post("/api/qmelanin/assessment")
      .send({ smoking: true, age: 33 });
    expect(res.body.answered).toEqual(["smoking"]);
    expect(res.body.assumed).toContain("sleepHours");
    expect(res.body.assumed).toContain("diet");
    expect(res.body.riskBand, "одно поле — уже есть что оценивать").not.toBe("unknown");
  });

  test("контроль: заполненная анкета работает как раньше", async () => {
    const res = await request(app())
      .post("/api/qmelanin/assessment")
      .send({ age: 30, onsetAge: 25, familyHistory: true, smoking: true, stress: 8, sleepHours: 5, diet: "vegan" });
    expect(res.body.riskBand).toBe("high");
    expect(res.body.riskScore).toBeGreaterThanOrEqual(5);
    expect(res.body.factors.length).toBeGreaterThan(3);
    expect(res.body.warning, "предупреждение не должно появляться на полной анкете").toBeUndefined();
  });
});
