import { describe, test, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// GET /wallet и /wallet/leaderboard, когда база не отвечает. 2026-08-12.
//
// Обе ручки читают через обёртку, которая ловит ошибку запроса и возвращает
// пустой список. Дальше пустота молча превращалась в утверждение:
//
//   * /wallet отвечал `ok:true, balance:0` — «этот человек ничего не
//     заработал», не выполнив ни одного успешного запроса;
//   * /wallet/leaderboard отвечал `ok:true, count:0`, а страница подписывает
//     такой ответ словами «Пока никто не заработал Chessy в реальных матчах» —
//     это заявление обо ВСЕХ игроках сразу.
//
// Ноль и пустой список — законные ответы, когда база ответила. Отличать их от
// «спросить не удалось» должен сервер: у клиента для этого нет ничего.

const { failing } = vi.hoisted(() => {
  // Внутри hoisted, а не рядом с импортом: `import` поднимается выше обычных
  // присваиваний, и без этого хранилище инициализируется БЕЗ DATABASE_URL. Тогда
  // 503 приходит из ветки «базы нет вовсе», а проверяем мы ветку «запрос упал» —
  // тест был бы зелёным по неверной причине. Сторожит это третий тест: при
  // отвечающей базе ответ обязан быть 200.
  process.env.DATABASE_URL = "postgres://test/test";
  return { failing: { on: true } };
});

vi.mock("pg", () => {
  class Pool {
    async query(text: string) {
      // Создание таблиц при инициализации должно проходить: иначе хранилище
      // сочтётся выключенным, и тест проверял бы offline-ветку вместо отказа.
      if (/CREATE TABLE|CREATE INDEX/i.test(text)) return { rows: [] };
      if (failing.on) throw new Error("connection reset by peer");
      return { rows: [] };
    }
    on() {}
  }
  return { default: { Pool }, Pool };
});

import matchmakingRouter from "../src/routes/cyberchessMatchmaking";

const app = express();
app.use(express.json());
app.use("/api/cyberchess/matchmaking", matchmakingRouter);

beforeEach(() => {
  failing.on = true;
});

describe("отказ базы не выдаётся за факт о деньгах", () => {
  test("баланс игрока: 503, а не нулевой баланс", async () => {
    const res = await request(app).get("/api/cyberchess/matchmaking/wallet?userId=player-7");

    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
    expect(res.body.balance).toBeUndefined();
  });

  test("таблица балансов: 503, а не пустая таблица", async () => {
    const res = await request(app).get("/api/cyberchess/matchmaking/wallet/leaderboard?limit=50");

    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
    expect(res.body.count).toBeUndefined();
  });

  test("когда база отвечает, честный ноль остаётся нулём", async () => {
    // Обратная сторона: сторож не должен превращать нормальный ответ в отказ.
    // Игрок без строки в кошельке — это настоящий ноль, и он должен доехать.
    failing.on = false;

    const wallet = await request(app).get("/api/cyberchess/matchmaking/wallet?userId=nobody");
    expect(wallet.status).toBe(200);
    expect(wallet.body).toMatchObject({ ok: true, balance: 0, earnedTotal: 0 });

    const board = await request(app).get("/api/cyberchess/matchmaking/wallet/leaderboard?limit=50");
    expect(board.status).toBe(200);
    expect(board.body).toMatchObject({ ok: true, count: 0 });
  });
});
