import { describe, test, expect, afterAll, vi } from "vitest";
import * as realFs from "node:fs";
import express from "express";
import request from "supertest";

// База не отвечает вовсе. 2026-08-13.
//
// Ожидание готовности стоит перед ВСЕМИ маршрутами модуля — иначе состояние из
// базы подхватывалось бы уже после того, как кто-то успел записаться, и стирало
// бы его. Но у такого ожидания есть обратная сторона: зависший сокет вешает
// модуль целиком. Здесь проверяется именно она.
//
// И вторая половина: бросив ожидание, НЕЛЬЗЯ продолжать писать в базу. Наша
// файловая копия свежее по метке, поэтому запись затёрла бы то, что лежит в
// базе, — а лежать там может всё, что наиграли до этого.

const { scratch, db } = vi.hoisted(() => {
  const fs = require("node:fs") as typeof import("node:fs");
  const os = require("node:os") as typeof import("node:os");
  const p = require("node:path") as typeof import("node:path");
  const dir = fs.mkdtempSync(p.join(os.tmpdir(), "cc-tour-hang-"));
  process.env.CYBERCHESS_TOURNAMENTS_DIR = dir;
  process.env.DATABASE_URL = "postgres://test/test";
  // Предел ожидания настраивается — иначе тест ждал бы двадцать секунд, а
  // подделка часов здесь не работает: таймер заводится при загрузке модуля,
  // до того как тест успеет их подменить.
  process.env.CYBERCHESS_DB_READY_MS = "150";
  fs.writeFileSync(
    p.join(dir, "cyberchess-tournaments.json"),
    JSON.stringify({
      savedAt: new Date().toISOString(),
      tournaments: [
        {
          id: "on-disk", title: "С диска", format: "swiss", timeControl: "blitz",
          eloMin: 0, eloMax: 3000, players: 0, maxPlayers: 8, prizeChessy: 0,
          status: "upcoming", startsAt: "2026-08-20T10:00:00.000Z",
          registeredUserIds: [], roster: [], rounds: [],
        },
      ],
    }),
    "utf-8",
  );
  return { scratch: dir, db: { writes: [] as unknown[][] } };
});

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    // Чтение не отвечает НИКОГДА — ровно то, чего боимся.
    query: (text: string, params: unknown[] = []) => {
      if (/CREATE TABLE/i.test(text)) return Promise.resolve({ rows: [] });
      if (/INSERT INTO "CyberTournament"/i.test(text)) {
        db.writes.push(params);
        return Promise.resolve({ rows: [] });
      }
      return new Promise(() => {}); // висит вечно
    },
    on: () => {},
  }),
}));

vi.mock("../src/routes/cyberchessMatchmaking", () => ({
  createPreMatchedMatch: vi.fn(),
  onMatchSettled: vi.fn(),
  ALLOWED_TIME_CONTROLS: ["60+0", "180+0", "300+5", "600+10", "1800+0"],
}));

import tournamentsRouter from "../src/routes/cyberchessTournaments";

const app = express();
app.use(express.json());
app.use("/api/cyberchess-tournaments", tournamentsRouter);

afterAll(() => {
  delete process.env.CYBERCHESS_DB_READY_MS;
  delete process.env.CYBERCHESS_TOURNAMENTS_DIR;
  delete process.env.DATABASE_URL;
  try {
    realFs.rmSync(scratch, { recursive: true, force: true });
  } catch {
    /* временный каталог */
  }
});

describe("зависшая база не вешает модуль", () => {
  test("после предела ожидания список отвечает с диска", async () => {
    const res = await request(app).get("/api/cyberchess-tournaments/list");

    expect(res.status).toBe(200);
    expect((res.body.tournaments as Array<{ title: string }>).map((t) => t.title)).toContain("С диска");
  });

  test("бросив ожидание, в базу больше не пишем", async () => {
    // Иначе файловая копия (она свежее по метке) затёрла бы в базе всё, что
    // там лежало, — а мы даже не знаем, что именно.
    const before = db.writes.length;

    const created = await request(app)
      .post("/api/cyberchess-tournaments/")
      .send({ title: "Пока база молчит", format: "swiss", timeControl: "blitz", maxPlayers: 8 });
    expect(created.status).toBe(201); // игроку отказывать не за что

    await new Promise((r) => setTimeout(r, 30));
    expect(db.writes.length).toBe(before);
  });

  test("диагностика честно говорит, что ожидание брошено", async () => {
    const res = await request(app).get("/api/cyberchess-tournaments/_persistence");
    expect(res.body.persistence.db.abandoned).toBe(true);
  });
});
