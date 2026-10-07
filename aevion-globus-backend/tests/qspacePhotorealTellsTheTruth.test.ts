import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Фотореализм QSpace не обещает кадр, которого поставщик не отдаст.
 *
 * Повод, замер на проде 30.09–07.10.2026: ключ ИСПРАВЕН (ручка статуса с теми
 * же данными отвечает 404, то есть авторизация проходит), а генерация отвечает
 * 403 — модель нашему ключу не открыта. `healthz` при этом говорил
 * «Фотореалистичный вид доступен», и кнопку видел каждый посетитель: каждое
 * нажатие уходило в отказ. Признак «ключ задан» отвечал на ДРУГОЙ вопрос, чем
 * «этим ключом можно нарисовать».
 *
 * Плюс цена: в ответе стояло `costCredits: 0.25` — числа, которого не
 * существует. У REST-API поставщика отдельный кошелёк, кадр стоит $0.04.
 */

process.env.HIGGSFIELD_KEY_ID = "test-id";
process.env.HIGGSFIELD_KEY_SECRET = "test-secret";

vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));

const { qspacePhotorealRouter, свежийОтказ, забытьОтказ, ЦЕНА_КАДРА_USD } = await import(
  "../src/routes/qspacePhotoreal"
);

function приложение() {
  const a = express();
  a.use(express.json({ limit: "12mb" }));
  a.use("/api/qspace/photoreal", qspacePhotorealRouter);
  return a;
}

/** Непустой PNG: 1×1 пиксель. Поле зовётся imageBase64 — проверено по коду. */
const PNG_КАДР =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

const настоящийFetch = global.fetch;
function поставщикОтвечает(status: number, body: unknown) {
  global.fetch = (async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  })) as unknown as typeof fetch;
}

describe("healthz говорит правду о доступности кадра", () => {
  beforeEach(() => забытьОтказ());
  afterEach(() => { global.fetch = настоящийFetch; });

  test("ключ задан, отказов не было → доступно, и цена в долларах", async () => {
    const r = await request(приложение()).get("/api/qspace/photoreal/healthz");
    expect(r.status).toBe(200);
    expect(r.body.configured).toBe(true);
    expect(r.body.keySet).toBe(true);
    expect(r.body.upstreamRefusal).toBe(null);
    expect(r.body.costUsd).toBe(ЦЕНА_КАДРА_USD);
    expect(r.body.costUsd).toBe(0.04);
    expect(r.body, "выдуманная единица «кредиты» вернулась").not.toHaveProperty("costCredits");
  });

  test("🔴 поставщик отказал 403 → healthz говорит «недоступно» и называет причину", async () => {
    поставщикОтвечает(403, { message: "model is not available for this key" });
    const кадр = await request(приложение())
      .post("/api/qspace/photoreal")
      .send({ imageBase64: PNG_КАДР, prompt: "комната" });
    expect(кадр.status).toBe(502);

    const r = await request(приложение()).get("/api/qspace/photoreal/healthz");
    expect(r.body.configured, "healthz продолжает обещать кадр после 403").toBe(false);
    // Ключ при этом ИСПРАВЕН — два разных утверждения, и оба названы.
    expect(r.body.keySet).toBe(true);
    expect(r.body.upstreamRefusal).toEqual({ code: 403, model: expect.any(String) });
    expect(r.body.note).toMatch(/недоступ/i);
    expect(r.body.note).toMatch(/403/);
  });

  test("401 гасит так же, как 403", async () => {
    поставщикОтвечает(401, { message: "unauthorized" });
    await request(приложение()).post("/api/qspace/photoreal")
      .send({ imageBase64: PNG_КАДР, prompt: "комната" });
    expect(свежийОтказ()?.код).toBe(401);
  });

  test("🔴 5xx поставщика кнопку НЕ гасит: это не отказ в доступе", async () => {
    // Направление выбрано по цене ошибки: таймаут или 500 у поставщика
    // проходят сами, а погашенная кнопка осталась бы погашенной на 30 минут.
    поставщикОтвечает(503, { message: "temporarily unavailable" });
    await request(приложение()).post("/api/qspace/photoreal")
      .send({ imageBase64: PNG_КАДР, prompt: "комната" });
    expect(свежийОтказ()).toBe(null);
    const r = await request(приложение()).get("/api/qspace/photoreal/healthz");
    expect(r.body.configured).toBe(true);
  });

  test("отказ живёт 30 минут и сам отпускает", () => {
    // Доступ могут открыть в любой момент: вечная память об отказе значит, что
    // кнопка не вернётся до перезапуска процесса.
    expect(свежийОтказ(Date.now() + 31 * 60 * 1000)).toBe(null);
  });
});
