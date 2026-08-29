import { describe, test, expect } from "vitest";
import request from "supertest";
import express from "express";
import crypto from "node:crypto";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Подпись двойника пересчитывается СНАРУЖИ.
 *
 * ПОВОД (29.08.2026). `/city` отдаёт `_signature`, страница показывает знак
 * «подписано», а пересчитать хэш из ответа было НЕЛЬЗЯ: подписан объект до
 * добавления `heightReview`, `nofly` и прочего. Замер: опубликован d6147d9b…,
 * из тела ответа 17272fde… — знак обещал проверяемость, которой не было.
 *
 * Тест повторяет путь ПРОВЕРЯЮЩЕГО: берёт строку из ответа и считает sha256
 * сам. Зови он signCity(), проверял бы, что наша функция равна себе.
 */
function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
}

describe("подпись двойника проверяется снаружи", () => {
  test("sha256 от payload равен опубликованному contentHash", async () => {
    const res = await request(app()).get("/api/qskyway/city/signed-payload?city=nyc");
    expect(res.status).toBe(200);
    expect(typeof res.body.payload, "payload не опубликован — проверить нечем").toBe("string");
    const mine = crypto.createHash("sha256").update(res.body.payload, "utf8").digest("hex");
    expect(mine, "хэш от опубликованной строки не совпал с опубликованным").toBe(res.body.contentHash);
  });

  test("тот же хэш стоит в _signature ответа /city", async () => {
    const sp = await request(app()).get("/api/qskyway/city/signed-payload?city=nyc");
    const city = await request(app()).get("/api/qskyway/city?city=nyc");
    expect(
      city.body?._signature?.contentHash,
      "знак на витрине и опубликованные байты говорят о разном",
    ).toBe(sp.body.contentHash);
  });

  test("рецепт предупреждает, что это НЕ весь ответ /city", async () => {
    const res = await request(app()).get("/api/qskyway/city/signed-payload?city=nyc");
    const v = res.body.verifyYourself;
    expect(Array.isArray(v?.steps) && v.steps.length >= 4).toBe(true);
    expect(Array.isArray(v?.stepsEn) && v.stepsEn.length === v.steps.length).toBe(true);
    // Главная ловушка проверяющего: он попробует хэшировать ответ /city.
    expect(String(v?.warning)).toContain("heightReview");
    expect(String(v?.warningEn)).toContain("heightReview");
  });

  test("неизвестный город отбивается", async () => {
    const res = await request(app()).get("/api/qskyway/city/signed-payload?city=nope");
    expect(res.status).toBe(404);
  });
});
