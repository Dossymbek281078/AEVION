import { describe, test, expect, afterAll, vi } from "vitest";
import * as realFs from "node:fs";
import express from "express";
import request from "supertest";

// Фикстуры на пустом томе — заглушка, а не состояние. 18.08.2026.
//
// Найдено живым прогоном против боевой базы, а не рассуждением. На свежем
// контейнере (том пуст, база жива) модуль:
//   • не поднимал состояние из базы — adoptedFromDb оставался false;
//   • показывал двенадцать посевных турниров;
//   • и ЗАПИСЫВАЛ их в базу поверх настоящих.
//
// Причина: посев звал tryWriteToDisk(), тот ставил savedAtMs = Date.now(), и
// заглушка всегда оказывалась «свежее» базы — условие усыновления
// (fromDb.savedAtMs > savedAtMs) не выполнялось никогда.
//
// Это ровно та потеря, ради предотвращения которой хранилище и делалось:
// пустой том бывает при пересоздании тома, переезде сервиса и первом запуске
// новой копии.

const { db } = vi.hoisted(() => {
  const fs = require("node:fs") as typeof import("node:fs");
  const os = require("node:os") as typeof import("node:os");
  const p = require("node:path") as typeof import("node:path");
  // Каталог ПУСТОЙ: файла состояния нет — так выглядит свежий контейнер.
  const dir = fs.mkdtempSync(p.join(os.tmpdir(), "cc-seed-rank-"));
  process.env.CYBERCHESS_TOURNAMENTS_DIR = dir;
  process.env.DATABASE_URL = "postgres://test/test";
  return {
    db: {
      dir,
      // В базе лежит настоящий турнир со штампом «сейчас».
      rows: [
        {
          data: {
            id: "usr-real-event",
            title: "Настоящий турнир из базы",
            format: "swiss",
            timeControl: "blitz",
            eloMin: 0,
            eloMax: 3000,
            players: 0,
            maxPlayers: 8,
            prizeChessy: 0,
            status: "upcoming",
            startsAt: "2026-09-01T10:00:00.000Z",
            registeredUserIds: [],
            roster: [],
            rounds: [],
            origin: "user",
          },
          savedAtMs: Date.now(),
        },
      ],
      inserts: [] as unknown[][],
    },
  };
});

vi.mock("pg", () => {
  class Pool {
    async query(text: string, params: unknown[] = []) {
      if (/CREATE TABLE/i.test(text)) return { rows: [], rowCount: 0 };
      if (/SELECT "data","savedAtMs" FROM "CyberTournament"/i.test(text)) {
        return { rows: db.rows, rowCount: db.rows.length };
      }
      if (/INSERT INTO "CyberTournament"/i.test(text)) {
        db.inserts.push(params);
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    on() {}
  }
  return { default: { Pool }, Pool };
});

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
  delete process.env.CYBERCHESS_TOURNAMENTS_DIR;
  delete process.env.DATABASE_URL;
  try {
    realFs.rmSync(db.dir, { recursive: true, force: true });
  } catch {
    /* временный каталог */
  }
});

describe("на пустом томе побеждает база, а не фикстуры", () => {
  test("состояние поднято из базы", async () => {
    const res = await request(app).get("/api/cyberchess-tournaments/_persistence");
    expect(res.status).toBe(200);
    expect(res.body.persistence.db.adoptedFromDb).toBe(true);
  });

  test("в списке настоящий турнир из базы, а не двенадцать фикстур", async () => {
    const res = await request(app).get("/api/cyberchess-tournaments/list");
    const ids = (res.body.tournaments as Array<{ id: string }>).map((t) => t.id);

    expect(ids).toContain("usr-real-event");
    expect(ids).not.toContain("spring-blitz-01"); // посевная фикстура
  });

  test("фикстуры НЕ записаны в базу поверх настоящих данных", () => {
    // Главная проверка. Показать лишнее — досадно; записать лишнее в базу —
    // необратимо: у фикстур штамп свежее, и они вытеснят настоящие строки.
    const writtenIds = db.inserts.map((p) => p[0]);
    expect(writtenIds).not.toContain("spring-blitz-01");
    expect(writtenIds).toHaveLength(0);
  });
});
