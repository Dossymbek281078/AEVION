import { describe, test, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * `/slots` считает живые брони так же честно, как `/health`.
 *
 * ПОВОД (29.08.2026, мутационная проверка старых сторожей). Один и тот же
 * факт — сколько броней оставлено ЛЮДЬМИ — публикуют две ручки. У `/health`
 * подмена `slotsBookedLive` на общее число ловится, у `/slots` замена
 * `countLiveSlots(slots)` на `slots.length` проходила НЕЗАМЕЧЕННОЙ: прежний
 * сторож смотрел только на `/health`.
 *
 * Асимметрия «одно и то же защищено в одном месте из двух» — ровно тот класс,
 * которым занята вся эта ночь. Демо-клики уже однажды попали в «живой спрос»
 * (мои же два клика 28.08); цена ошибки здесь — ложная глубина рынка.
 */
function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
}

describe("/slots: демо-брони не выдаются за спрос", () => {
  beforeAll(async () => {
    // Заводим предмет сами: на пустом хранилище проверка прошла бы вхолостую.
    await request(app()).post("/api/qskyway/slots").send({
      routeId: "live-count-probe", t0: "2031-02-02T00:00:00.000Z",
      t1: "2031-02-02T00:10:00.000Z", holder: "AEVION demo",
    });
    // ⚠️ И одну НАСТОЯЩУЮ. Без неё живое число честно равно нулю, и мутация
    // «всегда ноль» поведения не меняет — проверка выглядит зелёной, ничего
    // не проверив. Обе стороны нужны: демо не считать, настоящее считать.
    await request(app()).post("/api/qskyway/slots").send({
      routeId: "live-count-probe-2", t0: "2031-02-03T00:00:00.000Z",
      t1: "2031-02-03T00:10:00.000Z", holder: "Aero Taxi KZ",
    });
  });

  test("в хранилище есть хотя бы одна запись — иначе проверять нечего", async () => {
    const res = await request(app()).get("/api/qskyway/slots");
    expect(res.status).toBe(200);
    expect(res.body.count, "хранилище пусто, проверка была бы пустой").toBeGreaterThan(0);
  });

  test("живое число НЕ равно общему, когда есть демо-бронь", async () => {
    const res = await request(app()).get("/api/qskyway/slots");
    expect(typeof res.body.liveCount, "поле liveCount пропало").toBe("number");
    expect(
      res.body.liveCount,
      "демо-бронь посчитана живым спросом: liveCount равен общему числу",
    ).toBeLessThan(res.body.count);
  });

  test("настоящая бронь СЧИТАЕТСЯ живой", async () => {
    // Зеркальная половина: мало не считать демо — надо считать настоящее.
    // Иначе «ноль живых всегда» выглядело бы честной осторожностью.
    const res = await request(app()).get("/api/qskyway/slots");
    expect(res.body.liveCount, "настоящая бронь не попала в живой спрос").toBeGreaterThan(0);
  });

  test("живое число не может быть больше общего", async () => {
    const res = await request(app()).get("/api/qskyway/slots");
    expect(res.body.liveCount).toBeLessThanOrEqual(res.body.count);
    expect(res.body.liveCount).toBeGreaterThanOrEqual(0);
  });

  test("два наших ответа об одном факте не спорят", async () => {
    // /health и /slots считают одно и то же. Разойдись они — снаружи нельзя
    // понять, какому верить, и оба будут звучать уверенно.
    const slots = await request(app()).get("/api/qskyway/slots");
    const health = await request(app()).get("/api/qskyway/health");
    const h = health.body?.slots ?? health.body;
    const live = h?.slotsBookedLive ?? h?.liveCount;
    if (typeof live === "number") {
      expect(live, "/health и /slots называют разное число живых броней").toBe(slots.body.liveCount);
    }
  });
});
