import { describe, test, expect, afterAll, vi } from "vitest";
import * as realFs from "node:fs";
import express from "express";
import request from "supertest";

// Зеркало в базе повторяет запись после сбоя. 18.08.2026.
//
// Запись в базу намеренно не ждут (void saveToDb): путь регистрации не должен
// зависеть от скорости базы. Обратная сторона была в том, что единичный обрыв
// сети означал молча отставшее зеркало — и узнать об этом можно было только по
// счётчику ошибок, на который никто не смотрит.
//
// Опасность не в самом отставании: пока жив файл на томе, он и есть источник
// правды. Опасность в СОЧЕТАНИИ — база отстала, а потом том пересоздали. Тогда
// поднимется то, что успело доехать, и последние турниры исчезнут без единой
// ошибки в логе.

const { db } = vi.hoisted(() => {
  const fs = require("node:fs") as typeof import("node:fs");
  const os = require("node:os") as typeof import("node:os");
  const p = require("node:path") as typeof import("node:path");
  const dir = fs.mkdtempSync(p.join(os.tmpdir(), "cc-retry-"));
  process.env.CYBERCHESS_TOURNAMENTS_DIR = dir;
  process.env.DATABASE_URL = "postgres://test/test";
  process.env.CYBERCHESS_DB_RETRY_MS = "50"; // в тесте ждать двадцать секунд незачем
  fs.writeFileSync(
    p.join(dir, "cyberchess-tournaments.json"),
    JSON.stringify({ savedAt: new Date().toISOString(), tournaments: [] }),
    "utf-8",
  );
  return { db: { dir, failInserts: true, inserts: 0 } };
});

vi.mock("pg", () => {
  class Pool {
    async query(text: string, params: unknown[] = []) {
      if (/CREATE TABLE/i.test(text)) return { rows: [], rowCount: 0 };
      if (/SELECT "data","savedAtMs" FROM "CyberTournament"/i.test(text)) return { rows: [], rowCount: 0 };
      if (/INSERT INTO "CyberTournament"/i.test(text)) {
        db.inserts += 1;
        // База «падает», пока флаг стоит. Так выглядит обрыв соединения.
        if (db.failInserts) throw new Error("connection terminated unexpectedly");
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

const state = async () =>
  (await request(app).get("/api/cyberchess-tournaments/_persistence")).body.persistence.db;

/** Ждём условие, а не «спим наугад»: фиксированная пауза — ставка на скорость машины. */
async function until(cond: () => Promise<boolean> | boolean, ms = 5000): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await cond()) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
}

afterAll(() => {
  delete process.env.CYBERCHESS_TOURNAMENTS_DIR;
  delete process.env.DATABASE_URL;
  delete process.env.CYBERCHESS_DB_RETRY_MS;
  try {
    realFs.rmSync(db.dir, { recursive: true, force: true });
  } catch {
    /* временный каталог */
  }
});

describe("сбой записи в базу не остаётся без повтора", () => {
  test("первая запись падает, ошибка видна в диагностике", async () => {
    const res = await request(app)
      .post("/api/cyberchess-tournaments")
      .send({ title: "Турнир во время сбоя базы", format: "swiss", timeControl: "blitz", maxPlayers: 8 });
    expect(res.status).toBe(201); // создание отвечает 201

    // Ответ игроку не зависит от базы — это и есть смысл незаблокированной
    // записи. Но ошибка обязана быть ВИДНА.
    const ok = await until(async () => (await state()).saveErrors > 0);
    expect(ok).toBe(true);
  });

  test("повтор происходит сам и доводит запись до базы", async () => {
    const before = await state();
    expect(before.rowsWritten).toBe(0); // до починки базы не записано ничего

    db.failInserts = false; // база «поднялась»

    const written = await until(async () => (await state()).rowsWritten > 0);
    const after = await state();

    expect(written).toBe(true);
    expect(after.retries).toBeGreaterThan(0);
    expect(after.rowsWritten).toBeGreaterThan(0);
  });
});
