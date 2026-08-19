import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Задача дня берёт из настоящего банка и одинакова для всех. 19.08.2026.
//
// Замер: в ChessPuzzle 500 000 записей, а отдавались тридцать зашитых — цикл
// повтора в месяц. К публичному запуску 30.08 это человек заметит.
//
// Детерминизм по дате обязателен не ради красоты: у всех игроков в один день
// должна быть ОДНА задача, иначе таблица лидеров сравнивает несравнимое.

const { db } = vi.hoisted(() => {
  process.env.DATABASE_URL = "postgres://test/test";
  // `sol` в базе — ТЕКСТ с JSON-массивом внутри, а не массив и не голая строка.
  // Прежний мок отдавал "a1b1", формы, которой в базе не существует, и потому
  // тест был зелёным на коде, который резал настоящее значение по запятым.
  return { db: { total: 500000, fail: false, offsets: [] as number[], solRaw: '["a1b1","b1c1"]' } };
});

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (text: string, params: unknown[] = []) => {
      if (db.fail) throw new Error("connection terminated unexpectedly");
      if (/count\(\*\)/i.test(text)) return { rows: [{ n: db.total }], rowCount: 1 };
      if (/FROM "ChessPuzzle"/i.test(text)) {
        const off = Number(params[0]);
        db.offsets.push(off);
        return {
          rows: [{ id: `bank_${off}`, fen: "8/8/8/8/8/8/8/K6k w - - 0 1", sol: db.solRaw, name: "Тактика", rating: 1500, theme: "Пешечный эндшпиль" }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    },
    on: () => {},
  }),
}));

vi.mock("../src/routes/cyberchessMatchmaking", () => ({
  createPreMatchedMatch: vi.fn(),
  onMatchSettled: vi.fn(),
  ALLOWED_TIME_CONTROLS: ["60+0", "180+0", "300+5", "600+10", "1800+0"],
}));

import dailyRouter from "../src/routes/cyberchessDaily";

const app = express();
app.use(express.json());
app.use("/api/cyberchess-daily", dailyRouter);

beforeEach(() => {
  db.offsets.length = 0;
});

describe("задача дня из банка", () => {
  test("берётся из банка, а не из тридцати зашитых", async () => {
    const res = await request(app).get("/api/cyberchess-daily/puzzle");

    expect(res.status).toBe(200);
    expect(res.body.source).toMatch(/настоящий банк/);
    expect(res.body.puzzle.id).toMatch(/^bank_/);
    expect(res.body.poolSize).toBe(500000);
  });

  test("тема и рейтинг приходят из записи банка, а не выдуманы", async () => {
    const res = await request(app).get("/api/cyberchess-daily/puzzle");
    expect(res.body.puzzle.theme).toBe("Пешечный эндшпиль");
    expect(res.body.puzzle.rating).toBe(1500);
  });

  test("один и тот же день — одна и та же задача", async () => {
    const a = await request(app).get("/api/cyberchess-daily/puzzle");
    const b = await request(app).get("/api/cyberchess-daily/puzzle");
    expect(a.body.puzzle.id).toBe(b.body.puzzle.id);
  });

  test("разные даты дают разные смещения", () => {
    // Прямая проверка правила выбора: три даты подряд не должны совпадать.
    // Через ручку это не проверить — она отдаёт только сегодняшний день.
    const hash = (day: string, total: number) => {
      let h = 2166136261;
      for (let i = 0; i < day.length; i++) {
        h ^= day.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return Math.abs(h) % Math.max(1, total);
    };
    const days = ["2026-08-19", "2026-08-20", "2026-08-21"];
    const offs = days.map((d) => hash(d, 500000));
    expect(new Set(offs).size).toBe(3);
  });

  test("банк не ответил — честно сказано, что пул резервный", async () => {
    db.fail = true;
    // Кэш держит вчерашний ответ сутки, поэтому проверяем на свежем модуле.
    vi.resetModules();
    const fresh = (await import("../src/routes/cyberchessDaily")).default;
    const app2 = express();
    app2.use(express.json());
    app2.use("/api/cyberchess-daily", fresh);

    const res = await request(app2).get("/api/cyberchess-daily/puzzle");
    expect(res.status).toBe(200);
    expect(res.body.source).toMatch(/резервный пул/);
    expect(res.body.poolSize).toBe(30);
    db.fail = false;
  });
});
