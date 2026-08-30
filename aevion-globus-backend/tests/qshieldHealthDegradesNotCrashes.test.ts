import { describe, test, expect, vi, beforeAll } from "vitest";
import express from "express";
import request from "supertest";

beforeAll(() => {
  process.env.SHARD_HMAC_SECRET = Buffer.from(
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "hex",
  ).toString("base64");
});

/**
 * Ручка состояния обязана СООБЩАТЬ об аварии, а не падать вместе с ней.
 *
 * Замер 28.08.2026, найдено пробой по всем маршрутам с недоступным
 * хранилищем: `/api/quantum-shield/health` отвечала `500` и телом
 * `{status:"error"}`. Две беды сразу:
 *
 *   1. по такому ответу нельзя отличить «модуль мёртв» от «база мертва» —
 *      а ручка состояния существует ровно ради этого различия;
 *   2. 500 означает «сломались МЫ»: он идёт в Sentry и топит его шумом
 *      ровно во время аварии, когда сигнал нужен чистым. Недоступная
 *      зависимость — это 503.
 *
 * Соседние модули (awards, pipeline, qcontract, qpaynet, qsign v2) уже
 * отвечают 503 — то есть разнобой внутри одной платформы, а не решение.
 *
 * Проверка ПАРНАЯ: без пары «здоровый случай» она была бы зелёной и у кода,
 * который отвечает «degraded» всегда, а такой ответ бесполезен так же, как
 * падение.
 */

const h = vi.hoisted(() => ({ dbFails: true }));

vi.mock("../src/lib/dbPool", () => ({
  isDbConfigured: () => true,
  getPool: () => ({
    query: async () => {
      if (h.dbFails) throw new Error("SASL: client password must be a string");
      return {
        rows: [{ total: 7, active: 5, legacy: 1, distributed: 3 }],
        rowCount: 1,
      };
    },
  }),
}));

import { quantumShieldRouter } from "../src/routes/quantum-shield";

function app() {
  const a = express();
  a.use(express.json());
  a.use("/x", quantumShieldRouter);
  return a;
}

describe("состояние quantum-shield при недоступном хранилище", () => {
  test("хранилище недоступно: 503 и внятная причина, а не 500 «у нас сломалось»", async () => {
    h.dbFails = true;
    const res = await request(app()).get("/x/health");

    expect(res.status, "500 означает «сломались мы» и топит Sentry во время аварии").toBe(503);
    expect(res.body.storage, "по ответу не отличить «модуль мёртв» от «база мертва»").toBe(
      "unavailable",
    );
    expect(res.body.status).toBe("degraded");
  });

  test("то, что модуль знает БЕЗ базы, он всё равно сообщает", async () => {
    h.dbFails = true;
    const res = await request(app()).get("/x/health");

    // Эти четыре не требуют базы вовсе — молчать о них незачем, а дежурному
    // они говорят, что жив сам модуль, а не только процесс.
    expect(res.body.algorithm, "алгоритм не назван").toBeTruthy();
    expect(res.body.threshold, "порог не назван").toBeGreaterThan(0);
    expect(res.body.totalShards, "число долей не названо").toBeGreaterThan(0);
    expect(res.body.hmacKeyVersion, "версия ключа не названа").toBeDefined();
  });

  test("наружу не уходит текст ошибки хранилища", async () => {
    h.dbFails = true;
    const res = await request(app()).get("/x/health");
    const body = JSON.stringify(res.body);

    // Сообщение драйвера называет способ входа в базу — наружу идёт категория.
    expect(body.includes("SASL"), "текст ошибки выдаёт устройство системы").toBe(false);
    expect(body.includes("password"), "текст ошибки выдаёт устройство системы").toBe(false);
  });

  test("база жива: обычный 200, а не вечное «degraded»", async () => {
    h.dbFails = false;
    const res = await request(app()).get("/x/health");

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.totalRecords, "числа берутся не из базы").toBe(7);
  });
});
