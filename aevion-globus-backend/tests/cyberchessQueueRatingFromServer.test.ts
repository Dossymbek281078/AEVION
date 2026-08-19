import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Рейтинг для подбора — свой, а не заявленный. 19.08.2026.
//
// Клиент присылал своё число, и оно шло прямо в подбор соперника. Пока таблица
// рейтингов пуста это безобидно, но с первой сыгранной партией превращается в
// способ выбирать себе слабых: назвался 800 — получил новичка.
//
// Тот же класс, что подделка серии в задаче дня, найденная сегодня же: клиент
// заявляет достижение, сервер записывает. Разница лишь в том, что там подделка
// попадала в таблицу лидеров, а здесь — в подбор соперника.

const { db } = vi.hoisted(() => {
  process.env.DATABASE_URL = "postgres://test/test";
  return { db: { games: 0, rating: 2400, отвечает: true } };
});

// Хранилище партий создаёт СВОЙ пул через pg, а не через lib/dbPool — подделка
// не того модуля просто не работала бы, а тест был бы зелёным ни о чём.
// Подделка одна на все шахматные тесты: три раза свои копии отставали от
// настоящего драйвера и красили набор в неверный цвет.
vi.mock("pg", async () => {
  const { makeFakePool, rows, written } = await import("./helpers/fakePg");
  const Pool = makeFakePool({
    handlers: [
      (text: string) => {
        if (!db.отвечает) throw new Error("connection terminated unexpectedly");
        if (/FROM "CyberRating"/i.test(text)) {
          return rows([{ userId: "u", speed: "blitz", displayName: null, games: db.games, rating: db.rating, rd: 100, vol: 0.06, wins: 0, losses: 0, draws: 0, peak: db.rating }]);
        }
        return written(0);
      },
    ],
  });
  return { default: { Pool }, Pool };
});

async function app() {
  const router = (await import("../src/routes/cyberchessMatchmaking")).default;
  const a = express();
  a.use(express.json());
  a.use("/api/cyberchess/matchmaking", router);
  return a;
}

const join = async (userId: string, rating: number) =>
  request(await app()).post("/api/cyberchess/matchmaking/queue/join")
    .send({ userId, displayName: "Игрок", rating, timeControl: "300+5" });

beforeEach(() => { db.games = 0; db.rating = 2400; db.отвечает = true; });

describe("подбор идёт по рейтингу сервера", () => {
  test("у игрока с партиями заявленное число игнорируется", async () => {
    db.games = 42; db.rating = 2400;
    const r = await join("сильный", 800);
    expect(r.status).toBe(200);
    // Заявил 800, сервер знает 2400 — в очередь обязан попасть 2400.
    expect(r.body.rating).toBe(2400);
    expect(r.body.ratingSource).toBe("сервер");
  });

  test("у новичка заявленное принимается как стартовая оценка", async () => {
    db.games = 0;
    const r = await join("новичок", 1350);
    expect(r.status).toBe(200);
    expect(r.body.rating).toBe(1350);
    expect(r.body.ratingSource).toBe("заявлен");
  });

  test("если база не ответила, очередь не запирается", async () => {
    // Отказ базы не должен мешать людям играть: остаётся заявленное, и это
    // осознанное решение, а не случайность.
    db.отвечает = false;
    const r = await join("при-сбое", 1500);
    expect(r.status).toBe(200);
  });
});
