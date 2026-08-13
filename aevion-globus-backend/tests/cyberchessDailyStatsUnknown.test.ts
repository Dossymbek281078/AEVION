import { describe, test, expect, afterAll, vi } from "vitest";
import * as realFs from "node:fs";
import express from "express";
import request from "supertest";

// GET /user/:id/stats у задачи дня, когда записи нет. 2026-08-12.
//
// Личная статистика (сколько решено, история по дням) живёт ТОЛЬКО в памяти
// процесса — в отличие от таблицы лидеров, которая сохраняется на диск. Любой
// деплой её обнуляет, а деплоев бывает несколько в день.
//
// Ручка на отсутствующую запись отдавала нули, и страница печатала «Решено
// задач дня: 0» человеку, который в ту же секунду стоит в таблице лидеров со
// своей серией. Два числа об одном человеке на одном экране, оба от нас.
//
// Ноль — это утверждение. Отсутствие записи — не ноль.

const { scratch } = vi.hoisted(() => {
  const fs = require("node:fs") as typeof import("node:fs");
  const os = require("node:os") as typeof import("node:os");
  const p = require("node:path") as typeof import("node:path");
  const dir = fs.mkdtempSync(p.join(os.tmpdir(), "cc-daily-stats-"));
  process.env.CYBERCHESS_DAILY_DIR = dir;
  // Таблица лидеров сохранена и читается — именно она переживает перезапуск.
  fs.writeFileSync(
    p.join(dir, "cyberchess-daily-leaderboard.json"),
    JSON.stringify([
      { userId: "veteran", name: "Ветеран", country: "🇰🇿", streak: 15, score: 900, updatedAt: "2026-08-12T00:00:00.000Z" },
    ]),
    "utf-8",
  );
  return { scratch: dir };
});

import dailyRouter from "../src/routes/cyberchessDaily";

const app = express();
app.use(express.json());
app.use("/api/cyberchess-daily", dailyRouter);

afterAll(() => {
  delete process.env.CYBERCHESS_DAILY_DIR;
  try {
    realFs.rmSync(scratch, { recursive: true, force: true });
  } catch {
    /* временный каталог */
  }
});

describe("отсутствующая запись статистики — не ноль решённых задач", () => {
  test("сервер честно говорит, что не знает", async () => {
    const res = await request(app).get("/api/cyberchess-daily/user/veteran/stats");

    expect(res.status).toBe(200);
    expect(res.body.statsKnown).toBe(false);
    expect(res.body.totalSolved).toBeNull();
  });

  test("лучшая серия берётся из сохранённой таблицы, а не выдумывается нулём", async () => {
    // То, что мы действительно знаем, отдаём: серия лежит в файле таблицы.
    const res = await request(app).get("/api/cyberchess-daily/user/veteran/stats");

    expect(res.body.bestStreak).toBe(15);
  });

  test("незнакомцу — ноль, и это честно", async () => {
    // Обратная сторона: у человека, которого нет ни в памяти, ни в таблице,
    // и правда ничего нет. Отказ тут был бы враньём в другую сторону.
    const res = await request(app).get("/api/cyberchess-daily/user/nobody-at-all/stats");

    expect(res.status).toBe(200);
    expect(res.body.bestStreak).toBe(0);
    expect(res.body.statsKnown).toBe(false);
  });

  test("после решения запись появляется и статистика становится известной", async () => {
    await request(app)
      .post("/api/cyberchess-daily/solve")
      .send({ streak: 2, day: "2026-08-12", timeMs: 5000, hintsUsed: 0, userId: "veteran", name: "Ветеран" });

    const res = await request(app).get("/api/cyberchess-daily/user/veteran/stats");

    expect(res.body.statsKnown).toBe(true);
    expect(res.body.totalSolved).toBe(1);
  });
});
