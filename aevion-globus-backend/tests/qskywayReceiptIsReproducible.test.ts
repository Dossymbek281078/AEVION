import { describe, test, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import crypto from "node:crypto";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Квитанцию брони можно пересчитать СВОИМИ руками.
 *
 * ПОВОД (29.08.2026). Ручка проверки отвечала только `matches` — то есть
 * проверяющий узнавал, что МЫ говорим, будто сходится, и не мог убедиться
 * сам. Страница при этом обещает: «по квитанции видно, что запись не
 * изменялась». Обещание, выполняемое нашим же честным словом, — не обещание.
 *
 * Тот же класс, что и с редакцией воздушного пространства: публиковали
 * доказательство и не публиковали доказываемое.
 *
 * ⚠️ Тест повторяет путь ПРОВЕРЯЮЩЕГО: берёт строку из ответа и считает хэш
 * сам. Зови он `slotReceipt()`, он проверял бы, что наша функция равна себе.
 */
function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
}

describe("квитанция брони пересчитывается снаружи", () => {
  // Предмет проверки создаём САМИ: иначе на пустом хранилище тесты вышли бы
  // молча и выглядели зелёными, ничего не проверив.
  beforeAll(async () => {
    await request(app()).post("/api/qskyway/slots").send({
      routeId: "test-receipt-route", t0: "2030-01-01T00:00:00.000Z",
      t1: "2030-01-01T00:10:00.000Z", holder: "AEVION demo",
    });
  });

  test("хэш от payload из ответа даёт ровно ту квитанцию", async () => {
    const list = await request(app()).get("/api/qskyway/slots");
    expect(list.status).toBe(200);
    const slot = (list.body.slots ?? [])[0];
    // ⚠️ НЕ выходим молча при пустом хранилище: тест, который «проходит»,
    // ничего не проверив, — это молчание, а не зелёный. Заводим предмет сами.
    expect(slot, "в хранилище нет слотов — проверять было бы нечего").toBeTruthy();

    const res = await request(app()).get("/api/qskyway/slots/" + slot.id + "/verify");
    expect(res.status).toBe(200);
    expect(typeof res.body.payload, "payload не опубликован — проверить нечем").toBe("string");

    const hex = crypto.createHash("sha256").update(res.body.payload, "utf8").digest("hex");
    const mine = "qright:" + hex.slice(0, 32);
    expect(mine, "квитанция не пересчитывается из опубликованных байтов").toBe(res.body.receipt);
    expect(res.body.matches).toBe(true);
  });

  test("рецепт называет ГРАНИЦУ: секрета в квитанции нет", async () => {
    const list = await request(app()).get("/api/qskyway/slots");
    const slot = (list.body.slots ?? [])[0];
    expect(slot, "в хранилище нет слотов").toBeTruthy();
    const res = await request(app()).get("/api/qskyway/slots/" + slot.id + "/verify");
    const v = res.body.verifyYourself;
    expect(Array.isArray(v?.steps) && v.steps.length >= 3).toBe(true);
    expect(Array.isArray(v?.stepsEn) && v.stepsEn.length === v.steps.length).toBe(true);
    // Главное здесь — не шаги, а честная граница: контрольная сумма публичных
    // полей НЕ доказывает авторство. Без этой строки «квитанция» читается как
    // подпись, и заявление становится сильнее продукта.
    expect(String(v?.warning).toLowerCase()).toContain("секрета");
    expect(String(v?.warningEn).toLowerCase()).toContain("no secret");
  });

  test("несуществующий слот — не признак подделки", async () => {
    const res = await request(app()).get("/api/qskyway/slots/slot-нетакого/verify");
    expect(res.status).toBe(404);
    expect(String(res.body.noteEn).toLowerCase()).toContain("not a sign of forgery");
  });
});
