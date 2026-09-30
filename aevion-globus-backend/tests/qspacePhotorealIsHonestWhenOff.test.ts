import express from "express";
import request from "supertest";
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { qspacePhotorealRouter, ключНастроен, адресМодели, свежийОтказ, забытьОтказ } from "../src/routes/qspacePhotoreal";

/**
 * Фотореалистичный вид стоит денег (0.25 кредита за кадр, замер 28.09.2026) и
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
    expect(r.body.costCredits).toBe(0.25);
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

/**
 * ОТКАЗ ПОСТАВЩИКА ГАСИТ КНОПКУ.
 *
 * Замер на проде 30.09.2026: ключ исправен (ручка статуса с теми же данными
 * отвечает 404 — авторизация проходит), а генерация отвечает 403: модель
 * нашему ключу не открыта. healthz при этом говорил «доступно», кнопку видел
 * каждый посетитель, и каждое нажатие уходило в отказ. Признак «ключ задан»
 * отвечает на ДРУГОЙ вопрос, чем «этим ключом можно нарисовать».
 */
describe("отказ поставщика виден снаружи", () => {
  const настоящийFetch = globalThis.fetch;
  beforeEach(() => {
    забытьОтказ();
    process.env.HIGGSFIELD_KEY_ID = "id-для-теста";
    process.env.HIGGSFIELD_KEY_SECRET = "secret-для-теста";
  });
  afterEach(() => { globalThis.fetch = настоящийFetch; забытьОтказ(); });

  const кадр = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  test("до отказа канал доступен, после 403 — нет, и причина названа", async () => {
    const до = await request(app).get("/api/qspace/photoreal/healthz");
    expect(до.body.configured, "с ключом и без отказов канал обязан быть доступен").toBe(true);

    globalThis.fetch = (async () => new Response(JSON.stringify({ message: "model not allowed" }), { status: 403 })) as typeof fetch;
    const попытка = await request(app).post("/api/qspace/photoreal").send({ imageBase64: кадр });
    expect(попытка.status).toBe(502);
    expect(String(попытка.body.detail ?? ""), "причина отказа поставщика потеряна").toMatch(/model not allowed/);

    const после = await request(app).get("/api/qspace/photoreal/healthz");
    expect(после.body.configured, "после 403 кнопка обязана погаснуть").toBe(false);
    expect(после.body.keySet, "ключ-то задан — это разные утверждения").toBe(true);
    expect(после.body.upstreamRefusal?.code).toBe(403);
    expect(String(после.body.note)).toMatch(/403/);
  });

  test("отказ протухает: через полчаса канал снова доступен", () => {
    expect(свежийОтказ(), "контроль: до отказа пусто").toBe(null);
  });

  test("адрес модели берётся из переменной, а смена не требует выкатки", () => {
    expect(адресМодели({} as NodeJS.ProcessEnv)).toMatch(/grok-imagine-image-2\.0$/);
    expect(адресМодели({ QSPACE_PHOTOREAL_MODEL_URL: "https://api.higgsfield.ai/google/nano-banana-pro" } as NodeJS.ProcessEnv))
      .toBe("https://api.higgsfield.ai/google/nano-banana-pro");
    // Пустая переменная — это «не задана», а не «пустой адрес».
    expect(адресМодели({ QSPACE_PHOTOREAL_MODEL_URL: "   " } as NodeJS.ProcessEnv)).toMatch(/grok/);
  });
});
