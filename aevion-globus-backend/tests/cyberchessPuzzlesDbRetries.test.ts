import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Облако задач пробует базу снова после сбоя. 19.08.2026.
//
// До починки один обрыв сети при первом запросе выключал облако до перезапуска
// процесса: ручка отвечала «offline: true» при живой базе. Для читателя это
// «задач нет», а не «мы не смогли спросить» — страница показывает встроенный
// набор, и никто не узнаёт, что облако выключилось.

const { db } = vi.hoisted(() => {
  process.env.DATABASE_URL = "postgres://test/test";
  process.env.CYBERCHESS_DB_INIT_RETRY_MS = "50";
  return { db: { failInit: true, initCalls: 0 } };
});

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (text: string) => {
      if (/CREATE TABLE/i.test(text)) {
        db.initCalls += 1;
        if (db.failInit) throw new Error("connection terminated unexpectedly");
      }
      if (/SELECT 1 FROM/i.test(text)) return { rows: [{ "?column?": 1 }], rowCount: 1 };
      if (/count\(\*\)/i.test(text)) return { rows: [{ n: "0" }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
    on: () => {},
  }),
}));

import { puzzlesRouter } from "../src/routes/puzzles";

const app = express();
app.use(express.json());
app.use("/api/puzzles", puzzlesRouter);

beforeEach(() => {
  db.initCalls = 0;
});

describe("облако задач не выключается навсегда от одного сбоя", () => {
  test("при сбое отвечает offline и это видно", async () => {
    const res = await request(app).get("/api/puzzles/");
    expect(res.status).toBe(200);
    expect(res.body.offline).toBe(true);
    expect(db.initCalls).toBeGreaterThan(0);
  });

  test("после паузы попытка повторяется", async () => {
    const before = db.initCalls;
    await new Promise((r) => setTimeout(r, 80));
    await request(app).get("/api/puzzles/");

    // До починки счётчик стоял бы на месте: ensureDb выходил по защёлке.
    expect(db.initCalls).toBeGreaterThan(before);
  });

  test("когда база поднялась, облако включается само", async () => {
    db.failInit = false;
    await new Promise((r) => setTimeout(r, 80));
    const res = await request(app).get("/api/puzzles/");

    expect(res.body.offline).toBeUndefined();
  });
});
