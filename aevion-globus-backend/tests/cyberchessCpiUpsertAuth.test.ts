import { describe, test, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

// POST /api/cyberchess/cpi/upsert — кто имеет право писать меру силы игрока.
// 2026-08-12.
//
// Ручка была помечена в коде как «Trust-based MVP (no auth)» и брала номер
// игрока прямо из тела запроса. То есть любой человек с интернетом, без
// единого заголовка, мог поднять себя на вершину CPI-рейтинга и испортить
// строку любому игроку, зная его номер. Это не внутренний счётчик: CPI
// показывается публично и задуман как мера силы, по которой подбирают
// соперника.
//
// Теперь строка принадлежит тому, чей JWT предъявлен, а тело в этом вопросе
// не участвует — ровно как у /api/cyberchess/state в том же файле.
//
// Токен здесь настоящий и проверяется настоящим requireAuth: подделывать
// авторизацию в тесте на авторизацию значит проверять собственную подделку.

const { queries } = vi.hoisted(() => ({ queries: [] as { text: string; params: unknown[] }[] }));

vi.mock("pg", () => {
  class Pool {
    async query(text: string, params: unknown[] = []) {
      queries.push({ text, params });
      if (/INSERT INTO "CyberchessCpiState"/i.test(text)) {
        return { rows: [{ userId: params[0] }] };
      }
      return { rows: [] };
    }
    on() {}
  }
  return { default: { Pool }, Pool };
});

const SECRET = "cpi-upsert-test-secret";
process.env.AUTH_JWT_SECRET = SECRET;
process.env.DATABASE_URL = "postgres://test/test";

import { cyberchessRouter } from "../src/routes/cyberchess";

const app = express();
app.use(express.json());
app.use("/api/cyberchess", cyberchessRouter);

const tokenFor = (sub: string) => jwt.sign({ sub }, SECRET, { algorithm: "HS256", expiresIn: "1h" });

const FACTORS = {
  overall: 71, accuracy: 68, tactics: 74, endgame: 60, timing: 55,
  aggression: 62, timeControl: 58, opening: 66, defense: 64,
  consistency: 70, endgameTechnique: 59, psychology: 63,
};

const writes = () => queries.filter((q) => /INSERT INTO "CyberchessCpiState"/i.test(q.text));

beforeEach(() => {
  queries.length = 0;
});

describe("подмена драйвера действительно работает", () => {
  test("запросы доходят до подделки", async () => {
    // Сторож всего файла: под `require("pg")` подмена не включалась, хранилище
    // считалось недоступным, и разрешённая запись отвечала 503 — то есть путь,
    // ради которого файл написан, не выполнялся вовсе.
    await request(app)
      .post("/api/cyberchess/cpi/upsert")
      .set("Authorization", `Bearer ${tokenFor("probe")}`)
      .send({ factors: FACTORS, gamesPlayed: 1 });

    expect(queries.length).toBeGreaterThan(0);
  });
});

describe("писать CPI может только владелец строки", () => {
  test("без токена запись не проходит", async () => {
    const res = await request(app)
      .post("/api/cyberchess/cpi/upsert")
      .send({ userId: "victim", factors: FACTORS, gamesPlayed: 120 });

    expect(res.status).toBe(401);
    expect(writes()).toHaveLength(0);
  });

  test("с чужим номером в теле запись не проходит", async () => {
    // Главный случай: вошедший под своим именем не должен переписывать чужую
    // строку. Отказ явный — молчаливая подстановка своего номера ответила бы
    // 200 на запись, которой не было.
    const res = await request(app)
      .post("/api/cyberchess/cpi/upsert")
      .set("Authorization", `Bearer ${tokenFor("attacker")}`)
      .send({ userId: "victim", factors: FACTORS, gamesPlayed: 120 });

    expect(res.status).toBe(403);
    expect(writes()).toHaveLength(0);
  });

  test("своя запись проходит и ложится под номер из токена", async () => {
    const res = await request(app)
      .post("/api/cyberchess/cpi/upsert")
      .set("Authorization", `Bearer ${tokenFor("player-7")}`)
      .send({ factors: FACTORS, gamesPlayed: 120, displayName: "Player Seven" });

    expect(res.status).toBe(200);
    expect(writes()).toHaveLength(1);
    expect(writes()[0].params[0]).toBe("player-7");
  });

  test("свой же номер в теле не мешает", async () => {
    // Совпадающий userId — не попытка подмены, ломать такой вызов незачем.
    const res = await request(app)
      .post("/api/cyberchess/cpi/upsert")
      .set("Authorization", `Bearer ${tokenFor("player-7")}`)
      .send({ userId: "player-7", factors: FACTORS, gamesPlayed: 4 });

    expect(res.status).toBe(200);
    expect(writes()[0].params[0]).toBe("player-7");
  });

  test("подделанный токен не проходит", async () => {
    // Сторож самой проверки: если бы requireAuth в тесте был заглушкой, этот
    // случай прошёл бы вместе с остальными и весь файл ничего бы не значил.
    const forged = jwt.sign({ sub: "player-7" }, "not-the-secret", { algorithm: "HS256" });
    const res = await request(app)
      .post("/api/cyberchess/cpi/upsert")
      .set("Authorization", `Bearer ${forged}`)
      .send({ factors: FACTORS, gamesPlayed: 1 });

    expect(res.status).toBe(401);
    expect(writes()).toHaveLength(0);
  });
});
