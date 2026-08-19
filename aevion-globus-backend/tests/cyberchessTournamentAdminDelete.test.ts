import { describe, test, expect, afterAll, beforeEach, vi } from "vitest";
import * as realFs from "node:fs";
import * as path from "node:path";
import express from "express";
import request from "supertest";

// DELETE /:id — админское удаление турнира. 2026-08-13.
//
// Создание турнира открыто: без входа, пять штук за десять минут с адреса. А
// способа убрать не было ни одного — чтобы вычистить мусор, приходилось идти
// руками в базу и в файл на томе. Сегодня это понадобилось по-настоящему: на
// проде висели демо-турниры и следы проверок.
//
// Ручка удаляет РОВНО ОДИН турнир по идентификатору и сразу из трёх мест:
// память, файл, база. Никаких «удалить всё похожее на тестовое»: под такой
// шаблон однажды попадёт живое событие.

const { scratch, db } = vi.hoisted(() => {
  const fs = require("node:fs") as typeof import("node:fs");
  const os = require("node:os") as typeof import("node:os");
  const p = require("node:path") as typeof import("node:path");
  const dir = fs.mkdtempSync(p.join(os.tmpdir(), "cc-tour-del-"));
  process.env.CYBERCHESS_TOURNAMENTS_DIR = dir;
  process.env.DATABASE_URL = "postgres://test/test";
  // Ключ латиницей не случайно: заголовки HTTP не переносят кириллицу — с
  // русским ключом запрос падает ещё в клиенте, до всякой проверки прав.
  process.env.CYBERCHESS_ADMIN_KEY = "test-admin-key-13aug";
  fs.writeFileSync(
    p.join(dir, "cyberchess-tournaments.json"),
    JSON.stringify({
      savedAt: new Date().toISOString(),
      tournaments: [
        {
          id: "keep-me", title: "Живой турнир", format: "swiss", timeControl: "blitz",
          eloMin: 0, eloMax: 3000, players: 0, maxPlayers: 8, prizeChessy: 0,
          status: "upcoming", startsAt: "2026-08-20T10:00:00.000Z",
          registeredUserIds: [], roster: [], rounds: [], origin: "user",
        },
        {
          id: "drop-me", title: "Мусорный турнир", format: "swiss", timeControl: "blitz",
          eloMin: 0, eloMax: 3000, players: 0, maxPlayers: 8, prizeChessy: 0,
          status: "upcoming", startsAt: "2026-08-20T10:00:00.000Z",
          registeredUserIds: [], roster: [], rounds: [], origin: "user",
        },
      ],
    }),
    "utf-8",
  );
  return { scratch: dir, db: { deletes: [] as unknown[][] } };
});

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: (text: string, params: unknown[] = []) => {
      if (/DELETE FROM "CyberTournament"/i.test(text)) db.deletes.push(params);
      if (/SELECT "data","savedAtMs"/i.test(text)) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
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

const KEY = "test-admin-key-13aug";
const onDisk = () =>
  JSON.parse(realFs.readFileSync(path.join(scratch, "cyberchess-tournaments.json"), "utf-8")) as {
    tournaments: Array<{ id: string }>;
  };

beforeEach(() => {
  db.deletes.length = 0;
});

afterAll(() => {
  delete process.env.CYBERCHESS_TOURNAMENTS_DIR;
  delete process.env.DATABASE_URL;
  delete process.env.CYBERCHESS_ADMIN_KEY;
  try {
    realFs.rmSync(scratch, { recursive: true, force: true });
  } catch {
    /* временный каталог */
  }
});

describe("удалить турнир может только тот, у кого ключ", () => {
  test("без ключа — отказ, и турнир на месте", async () => {
    const res = await request(app).delete("/api/cyberchess-tournaments/drop-me");

    expect(res.status).toBe(403);
    expect(onDisk().tournaments.map((t) => t.id)).toContain("drop-me");
    expect(db.deletes).toHaveLength(0);
  });

  test("с неверным ключом — отказ", async () => {
    const res = await request(app)
      .delete("/api/cyberchess-tournaments/drop-me")
      .set("X-Admin-Key", "wrong-key");

    expect(res.status).toBe(403);
    expect(onDisk().tournaments.map((t) => t.id)).toContain("drop-me");
  });

  test("несуществующий турнир — 404, а не молчаливое «удалено»", async () => {
    // Ответ «ок» на удаление того, чего нет, — это сообщение о работе, которой
    // не было; человек решит, что мусор убран.
    const res = await request(app)
      .delete("/api/cyberchess-tournaments/такого-нет")
      .set("X-Admin-Key", KEY);

    expect(res.status).toBe(404);
    expect(db.deletes).toHaveLength(0);
  });
});

describe("удаление убирает турнир из всех трёх мест", () => {
  test("с ключом: из памяти, из файла и из базы", async () => {
    const res = await request(app)
      .delete("/api/cyberchess-tournaments/drop-me")
      .set("X-Admin-Key", KEY);

    expect(res.status).toBe(200);
    expect(res.body.deleted.id).toBe("drop-me");

    // 1) из списка
    const list = await request(app).get("/api/cyberchess-tournaments/list");
    expect((list.body.tournaments as Array<{ id: string }>).map((t) => t.id)).not.toContain("drop-me");

    // 2) из файла
    expect(onDisk().tournaments.map((t) => t.id)).not.toContain("drop-me");

    // 3) из базы — ровно по идентификатору, не пачкой
    expect(db.deletes).toHaveLength(1);
    expect(db.deletes[0][0]).toBe("drop-me");
  });

  test("соседний турнир не тронут", async () => {
    // Обратная сторона: удаление одного не должно уносить остальные — ни из
    // файла, ни из базы.
    expect(onDisk().tournaments.map((t) => t.id)).toContain("keep-me");
    const list = await request(app).get("/api/cyberchess-tournaments/list");
    expect((list.body.tournaments as Array<{ id: string }>).map((t) => t.id)).toContain("keep-me");
  });
});
