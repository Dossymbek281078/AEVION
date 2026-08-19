import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

// Решение проверяется сервером, серия считается сервером. 19.08.2026.
//
// Прежде ручка /solve брала `streak` числом из тела запроса и записывала его.
// Проверено на боевом проде: запрос `{"streak":364}` без единого хода поставил
// меня первым в таблице со счётом 36700. Таблица лидеров, которую может
// подделать любой посторонний, ХУЖЕ отсутствующей: она выглядит как достижения
// живых людей и ровно этим обесценивает настоящие.
//
// Это тот же класс, что и выдуманные гроссмейстеры на той же странице, только
// подделку здесь пишет не наш код, а кто угодно снаружи.

const SOL = ["c5c3", "e6e4", "b5b4", "e4b4"];

vi.hoisted(() => { process.env.DATABASE_URL = "postgres://test/test"; });

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (text: string) => {
      if (/count\(\*\)/i.test(text)) return { rows: [{ n: 500000 }], rowCount: 1 };
      if (/FROM "ChessPuzzle"/i.test(text)) {
        return {
          rows: [{ id: "li_2AEIG", fen: "r4k1r/pp3p2/4qp2/1QR5/5Pp1/1N4P1/PPP5/R5K1 w - - 2 25", sol: JSON.stringify(SOL), name: "Тактика", rating: 1931, theme: "Миттельшпиль" }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    },
  }),
  isDbConfigured: () => true,
}));

async function app() {
  const router = (await import("../src/routes/cyberchessDaily")).default;
  const a = express();
  a.use(express.json());
  a.use("/api/cyberchess-daily", router);
  return a;
}

const DAY = "2026-08-19";

describe("серию нельзя объявить, её можно только заработать", () => {
  test("без ходов — отказ, и он говорит, чего не хватает", async () => {
    const r = await request(await app()).post("/api/cyberchess-daily/solve")
      .send({ day: DAY, userId: "u1", streak: 364 });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("moves_required");
  });

  test("неверные ходы — отказ, серия не растёт", async () => {
    const r = await request(await app()).post("/api/cyberchess-daily/solve")
      .send({ day: DAY, userId: "u2", moves: ["e2e4", "e7e5"] });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("wrong_solution");
  });

  test("верные ходы засчитываются, а заявленная серия ИГНОРИРУЕТСЯ", async () => {
    const r = await request(await app()).post("/api/cyberchess-daily/solve")
      // Клиент заявляет 364. Сервер обязан ответить 1: это первый решённый день.
      .send({ day: DAY, userId: "u3", moves: SOL, streak: 364 });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.streak).toBe(1);
    expect(r.body.bestStreak).toBe(1);
  });

  test("серия растёт за подряд идущие дни и рвётся на пропуске", async () => {
    const a = await app();
    const send = (day: string) => request(a).post("/api/cyberchess-daily/solve")
      .send({ day, userId: "u4", moves: SOL });
    expect((await send("2026-08-17")).body.streak).toBe(1);
    expect((await send("2026-08-18")).body.streak).toBe(2);
    expect((await send("2026-08-19")).body.streak).toBe(3);
    // Пропуск 20-го: 21-е начинает заново, а не продолжает.
    expect((await send("2026-08-21")).body.streak).toBe(1);
  });
});
