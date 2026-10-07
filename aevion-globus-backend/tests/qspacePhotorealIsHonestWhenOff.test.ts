import express from "express";
import request from "supertest";
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { qspacePhotorealRouter, ключНастроен } from "../src/routes/qspacePhotoreal";

/**
 * Фотореалистичный вид стоит денег ($0.04 за кадр — замер по кабинету
 * поставщика 05.10.2026; прежние «0.25 кредита» были единицей, которой не
 * существует: у REST-API отдельный кошелёк, и в кредитах подписки он не
 * считается) и
 * работает только при ключе НА СЕРВЕРЕ. Здесь проверяется не картинка, а
 * ЧЕСТНОСТЬ канала: пока ключа нет, кнопка не должна обещать, а отказ обязан
 * называть себя словами — иначе человек жмёт и не понимает, что произошло
 * (§16, молчаливый отказ выглядит успехом).
 */
const app = express();
app.use(express.json({ limit: "10mb" }));
app.use("/api/qspace/photoreal", qspacePhotorealRouter);

const было = { ...process.env };
beforeEach(() => {
  delete process.env.HIGGSFIELD_KEY_ID;
  delete process.env.HIGGSFIELD_KEY_SECRET;
});
afterEach(() => { process.env = { ...было }; });

describe("фотореалистичный вид: канал говорит правду о себе", () => {
  test("без ключа состояние канала честно говорит «выключено»", async () => {
    const r = await request(app).get("/api/qspace/photoreal/healthz");
    expect(r.status).toBe(200);
    expect(r.body.configured).toBe(false);
    expect(String(r.body.note)).toMatch(/выключен/i);
    // Цена называется в долларах: её можно сверить с кабинетом поставщика и
    // сложить в смету, в отличие от «кредитов».
    expect(r.body.costUsd).toBe(0.04);
    expect(r.body, "выдуманная единица «кредиты» вернулась").not.toHaveProperty("costCredits");
  });

  test("без ключа запрос отклоняется 503 и называет причину", async () => {
    const r = await request(app).post("/api/qspace/photoreal").send({ imageBase64: "AAAA" });
    expect(r.status).toBe(503);
    expect(r.body.error).toBe("not_configured");
    expect(String(r.body.message)).toMatch(/ключ/i);
  });

  test("ПУСТОЙ ключ — это не настроенный ключ", () => {
    expect(ключНастроен({ HIGGSFIELD_KEY_ID: "", HIGGSFIELD_KEY_SECRET: "x" } as NodeJS.ProcessEnv)).toBe(false);
    expect(ключНастроен({ HIGGSFIELD_KEY_ID: "  ", HIGGSFIELD_KEY_SECRET: "x" } as NodeJS.ProcessEnv)).toBe(false);
    expect(ключНастроен({ HIGGSFIELD_KEY_ID: "a", HIGGSFIELD_KEY_SECRET: "b" } as NodeJS.ProcessEnv)).toBe(true);
  });

  test("с ключом, но без кадра — 400, а не тишина и не трата", async () => {
    process.env.HIGGSFIELD_KEY_ID = "id";
    process.env.HIGGSFIELD_KEY_SECRET = "secret";
    const r = await request(app).post("/api/qspace/photoreal").send({});
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("no_image");
  });

  test("кадр по несуществующей ссылке — 404, а не пустой ответ", async () => {
    const r = await request(app).get("/api/qspace/photoreal/frame/нет.png");
    expect(r.status).toBe(404);
    expect(r.body.error).toBe("not_found");
  });
});

/**
 * Суточный предел — защита ОБЩЕГО кошелька: кредиты делятся с пайплайном
 * DevHub, а ограничитель на минуту от слива не спасает (6 в минуту это 8640 в
 * сутки при остатке в 1115 кадров, замер 29.09.2026).
 */
describe("суточный предел кадров", () => {
  test("по умолчанию 60 кадров в сутки, и это видно в состоянии канала", async () => {
    process.env.HIGGSFIELD_KEY_ID = "id";
    process.env.HIGGSFIELD_KEY_SECRET = "secret";
    delete process.env.QSPACE_PHOTOREAL_DAILY_MAX;
    const r = await request(app).get("/api/qspace/photoreal/healthz");
    expect(r.status).toBe(200);
    expect(r.body.dailyMax).toBe(60);
    expect(typeof r.body.dailyUsed).toBe("number");
  });

  test("предел задаётся переменной, а не правкой кода", async () => {
    process.env.HIGGSFIELD_KEY_ID = "id";
    process.env.HIGGSFIELD_KEY_SECRET = "secret";
    process.env.QSPACE_PHOTOREAL_DAILY_MAX = "3";
    const r = await request(app).get("/api/qspace/photoreal/healthz");
    expect(r.body.dailyMax).toBe(3);
  });

  test("мусор в переменной не открывает предел настежь", async () => {
    process.env.HIGGSFIELD_KEY_ID = "id";
    process.env.HIGGSFIELD_KEY_SECRET = "secret";
    for (const мусор of ["", "нет", "-5", "0"]) {
      process.env.QSPACE_PHOTOREAL_DAILY_MAX = мусор;
      const r = await request(app).get("/api/qspace/photoreal/healthz");
      expect(r.body.dailyMax, `при значении «${мусор}»`).toBe(60);
    }
  });
});
