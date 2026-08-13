import { describe, test, expect, afterAll, vi } from "vitest";
import * as realFs from "node:fs";
import * as path from "node:path";
import express from "express";
import request from "supertest";

// Записи задачи дня переживают деплой. 2026-08-13.
//
// Таблица лидеров лежит в файле, который ЗАКОММИЧЕН в репозиторий, а файловая
// система контейнера временная: каждый деплой поднимает контейнер из образа, то
// есть с версией файла из git. Всё, что игроки заработали с прошлой выкатки,
// откатывалось молча. Личная статистика (сколько решено, история по дням) и
// того хуже — она жила только в памяти процесса, поэтому человек видел
// «решено: 0», стоя в таблице со своей серией.
//
// Проверка построена как новый контейнер: файл на диске СТАРЫЙ, а в базе то,
// что успели наиграть.

const { scratch, db } = vi.hoisted(() => {
  const fs = require("node:fs") as typeof import("node:fs");
  const os = require("node:os") as typeof import("node:os");
  const p = require("node:path") as typeof import("node:path");
  const dir = fs.mkdtempSync(p.join(os.tmpdir(), "cc-daily-deploy-"));
  process.env.CYBERCHESS_DAILY_DIR = dir;
  process.env.DATABASE_URL = "postgres://test/test";

  // Файл из образа: вчерашняя метка, один игрок.
  fs.writeFileSync(
    p.join(dir, "cyberchess-daily-leaderboard.json"),
    JSON.stringify({
      savedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      leaderboard: [
        { userId: "from_image", name: "Из образа", country: "🌍", streak: 1, score: 10, updatedAt: "2026-08-12T00:00:00.000Z" },
      ],
    }),
    "utf-8",
  );

  const state = {
    leaderboard: [
      { userId: "veteran", name: "Ветеран", country: "🇰🇿", streak: 15, score: 900, updatedAt: "2026-08-13T00:00:00.000Z" },
    ],
    stats: [
      { userId: "veteran", bestStreak: 15, totalSolved: 15, totalTimeMs: 150_000, history: [] },
    ],
  };
  return {
    scratch: dir,
    db: {
      state,
      savedAt: new Date(Date.now() - 60_000),
      writes: [] as unknown[][],
      // База отвечает не мгновенно — иначе догрузка успевает сама собой и
      // проверка ожидания перед маршрутами ничего не доказывает.
      readDelayMs: 300,
    },
  };
});

vi.mock("pg", () => {
  class Pool {
    async query(text: string, params: unknown[] = []) {
      if (/CREATE TABLE/i.test(text)) return { rows: [] };
      if (/SELECT "state","savedAt"/i.test(text)) {
        await new Promise((r) => setTimeout(r, db.readDelayMs));
        return { rows: [{ state: db.state, savedAt: db.savedAt }] };
      }
      if (/INSERT INTO "CyberDailyState"/i.test(text)) {
        db.writes.push(params);
        return { rows: [] };
      }
      return { rows: [] };
    }
    on() {}
  }
  return { default: { Pool }, Pool };
});

import dailyRouter from "../src/routes/cyberchessDaily";

const app = express();
app.use(express.json());
app.use("/api/cyberchess-daily", dailyRouter);

afterAll(() => {
  delete process.env.CYBERCHESS_DAILY_DIR;
  delete process.env.DATABASE_URL;
  try {
    realFs.rmSync(scratch, { recursive: true, force: true });
  } catch {
    /* временный каталог */
  }
});

describe("новый контейнер не откатывает игроков к версии из образа", () => {
  test("ПЕРВЫЙ запрос уже видит таблицу из базы, а не из образа", async () => {
    // Главный тест, и он же стережёт ожидание готовности перед маршрутами:
    // база в подделке отвечает 300 мс, поэтому без ожидания сюда приехал бы
    // «Из образа». Стережёт именно первый запрос — дальше промис уже разрешён.
    const res = await request(app).get("/api/cyberchess-daily/leaderboard?limit=10");

    const names = (res.body.leaderboard as Array<{ name: string }>).map((e) => e.name);
    expect(names).toContain("Ветеран");
    expect(names).not.toContain("Из образа");
  });

  test("личная статистика тоже приезжает, а не начинается с нуля", async () => {
    // Ровно та причина, по которой человек видел «решено: 0», стоя в таблице.
    const res = await request(app).get("/api/cyberchess-daily/user/veteran/stats");

    expect(res.body.statsKnown).toBe(true);
    expect(res.body.totalSolved).toBe(15);
    expect(res.body.bestStreak).toBe(15);
  });

  test("новое решение уезжает и в файл, и в базу", async () => {
    const before = db.writes.length;

    const res = await request(app)
      .post("/api/cyberchess-daily/solve")
      .send({ streak: 4, day: "2026-08-13", timeMs: 8000, hintsUsed: 0, userId: "newbie", name: "Новичок" });
    expect(res.status).toBe(200);

    const onDisk = JSON.parse(
      realFs.readFileSync(path.join(scratch, "cyberchess-daily-leaderboard.json"), "utf-8"),
    ) as { savedAt: string; leaderboard: Array<{ userId: string }> };
    expect(onDisk.savedAt).toBeTruthy();
    expect(onDisk.leaderboard.map((e) => e.userId)).toContain("newbie");

    await new Promise((r) => setTimeout(r, 20));
    expect(db.writes.length).toBeGreaterThan(before);
    const lastState = JSON.parse(String(db.writes[db.writes.length - 1][0])) as {
      leaderboard: Array<{ userId: string }>;
      stats: Array<{ userId: string }>;
    };
    // В базу едет и таблица, и статистика — иначе на следующем деплое
    // вернулись бы нули у того, кто только что решил.
    expect(lastState.leaderboard.map((e) => e.userId)).toContain("newbie");
    expect(lastState.stats.map((e) => e.userId)).toContain("newbie");
  });
});

describe("опоздавшая запись не затирает более свежую", () => {
  test("запрос обновляет строку только если он свежее записанного", () => {
    const src = require("node:fs").readFileSync("src/routes/cyberchessDaily.ts", "utf-8") as string;
    expect(src).toMatch(/ON CONFLICT[\s\S]{0,900}WHERE "CyberDailyState"\."savedAt" <= EXCLUDED\."savedAt"/);
  });
});
