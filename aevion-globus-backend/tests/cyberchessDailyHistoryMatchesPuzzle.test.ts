import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// /history обязан называть ТЕ ЖЕ задачи, что /puzzle отдавал в эти дни. 17.09.2026.
//
// Замер на проде 17.09: /puzzle → li_40lsJ (банк, 502 584), /history → p025 (резервный
// пул из 30). История считалась только по резервному пулу — публичная ручка описывала
// задачи, которых никто не решал. Починка: та же выборка (банк по хешу даты, пул —
// только если банк не ответил), у каждой записи машинный признак fromBank.

const { db } = vi.hoisted(() => {
  process.env.DATABASE_URL = "postgres://test/test";
  return { db: { total: 500000, fail: false, solRaw: '["a1b1","b1c1"]' } };
});

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (text: string, params: unknown[] = []) => {
      if (db.fail) throw new Error("connection terminated unexpectedly");
      if (/count\(\*\)/i.test(text)) return { rows: [{ n: db.total }], rowCount: 1 };
      if (/FROM "ChessPuzzle"/i.test(text)) {
        const off = Number(params[0]);
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

import dailyRouter, { dayOffsetHash } from "../src/routes/cyberchessDaily";

const app = express();
app.use(express.json());
app.use("/api/cyberchess-daily", dailyRouter);

beforeEach(() => {
  db.fail = false;
});

describe("история задачи дня совпадает с выдачей /puzzle", () => {
  // Порядок намеренный: кэш банка хранит один день, и после успешного запроса
  // отказ базы для «сегодня» уже не виден. Сперва отказ, потом успех.
  test("банк не ответил — резервный пул, и запись честно говорит fromBank:false", async () => {
    db.fail = true;
    const h = await request(app).get("/api/cyberchess-daily/history?days=2");
    expect(h.status).toBe(200);
    expect(h.body.history).toHaveLength(2);
    for (const e of h.body.history) {
      expect(e.fromBank).toBe(false);
      expect(e.id).not.toMatch(/^bank_/);
    }
  });
  test("каждый день — задача из банка по хешу даты; сегодняшняя = /puzzle; соседние дни разные", async () => {
    const h = await request(app).get("/api/cyberchess-daily/history?days=3");
    expect(h.status).toBe(200);
    expect(h.body.history).toHaveLength(3);
    for (const e of h.body.history) {
      expect(e.fromBank).toBe(true);
      expect(e.id).toBe(`bank_${dayOffsetHash(e.day, db.total)}`);
    }
    const p = await request(app).get("/api/cyberchess-daily/puzzle");
    expect(p.status).toBe(200);
    expect(h.body.history[0].day).toBe(p.body.day);
    expect(h.body.history[0].id).toBe(p.body.puzzle.id);
    const ids = new Set(h.body.history.map((e: { id: string }) => e.id));
    expect(ids.size).toBe(3);
  });

});
