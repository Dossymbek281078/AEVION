import { describe, test, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

// Откуда берутся числа CPI. 2026-08-12.
//
// CPI задуман как мера силы игрока: публичная таблица, подбор соперника. Но
// считает её сегодня БРАУЗЕР игрока и присылает о себе сам — сервер принимает
// двенадцать чисел и кладёт как есть. Авторизацию я закрыл утром, и теперь
// испортить чужую строку нельзя; поставить себе сотню по всем факторам —
// по-прежнему можно, это своя строка.
//
// Считать CPI на сервере — отдельная большая работа. Но пока её нет, у чисел
// должно быть честное происхождение, и жить оно обязано В ДАННЫХ: страница
// CPI-лидерборда сейчас макетная, и тот, кто будет подключать её к настоящему
// источнику, иначе покажет самооценку игроков как измеренную величину. Признак
// в данных доживёт до этого дня, договорённость в чьей-то голове — нет.

const { queries } = vi.hoisted(() => {
  process.env.DATABASE_URL = "postgres://test/test";
  process.env.AUTH_JWT_SECRET = "cpi-source-test-secret";
  return { queries: [] as { text: string; params: unknown[] }[] };
});

vi.mock("pg", () => {
  class Pool {
    async query(text: string, params: unknown[] = []) {
      queries.push({ text, params });
      if (/INSERT INTO "CyberchessCpiState"/i.test(text)) {
        return { rows: [{ userId: params[0] }] };
      }
      if (/SELECT[\s\S]*FROM "CyberchessCpiState"/i.test(text)) {
        // Строка, какой её отдаёт база: значение и его происхождение.
        return { rows: [{ userId: "player-7", displayName: "Seven", value: 71, gamesPlayed: 40, source: "self_reported" }] };
      }
      return { rows: [] };
    }
    on() {}
  }
  return { default: { Pool }, Pool };
});

import { cyberchessRouter } from "../src/routes/cyberchess";

const app = express();
app.use(express.json());
app.use("/api/cyberchess", cyberchessRouter);

const token = jwt.sign({ sub: "player-7" }, "cpi-source-test-secret", { algorithm: "HS256", expiresIn: "1h" });

const FACTORS = {
  overall: 100, accuracy: 100, tactics: 100, endgame: 100, timing: 100,
  aggression: 100, timeControl: 100, opening: 100, defense: 100,
  consistency: 100, endgameTechnique: 100, psychology: 100,
};

beforeEach(() => {
  queries.length = 0;
});

describe("происхождение чисел CPI видно и в базе, и в ответе", () => {
  test("запись помечается как присланная самим игроком", async () => {
    const res = await request(app)
      .post("/api/cyberchess/cpi/upsert")
      .set("Authorization", `Bearer ${token}`)
      .send({ factors: FACTORS, gamesPlayed: 40 });

    expect(res.status).toBe(200);
    const write = queries.find((q) => /INSERT INTO "CyberchessCpiState"/i.test(q.text));
    expect(write).toBeDefined();
    expect(write!.text).toMatch(/"source"/);
    expect(write!.params).toContain("self_reported");
  });

  test("метку ставит сервер, а не тело запроса", async () => {
    // Иначе клиент объявит свои числа проверенными — и признак, заведённый
    // ровно против этого, начнёт врать первым.
    await request(app)
      .post("/api/cyberchess/cpi/upsert")
      .set("Authorization", `Bearer ${token}`)
      .send({ factors: FACTORS, gamesPlayed: 40, source: "server_measured" });

    const write = queries.find((q) => /INSERT INTO "CyberchessCpiState"/i.test(q.text));
    expect(write!.params).toContain("self_reported");
    expect(write!.params).not.toContain("server_measured");
  });

  test("таблица отдаёт происхождение вместе со значением", async () => {
    // Признак, который есть в базе и не доходит до читателя, ничем не
    // отличается от отсутствующего.
    const res = await request(app).get("/api/cyberchess/cpi/leaderboard?factor=overall&limit=5");

    expect(res.status).toBe(200);
    expect(res.body.data.items[0].source).toBe("self_reported");
  });
});
