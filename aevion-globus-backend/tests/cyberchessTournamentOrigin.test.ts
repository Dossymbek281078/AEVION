import { describe, test, expect, afterAll, vi } from "vitest";
import * as realFs from "node:fs";
import express from "express";
import request from "supertest";

// Происхождение турнира в списке. 2026-08-12.
//
// Страница подписывает турниры по полю `origin`: «образец» у фикстур, «приз
// объявлен создателем» у заведённых кем угодно через открытую ручку. Поле
// появилось сегодня, а на диске лежат турниры, сохранённые ДО него — у них его
// нет, и список вычисляет запасное значение по префиксу идентификатора.
//
// Это единственное место, где префикс допустим, и именно поэтому его надо
// закрепить: ошибись оно — и метка встанет не туда. Причём тихо: подпись
// выглядит одинаково правдоподобно в обе стороны, а «образец» на живом турнире
// обесценивает настоящее событие ровно так же, как его отсутствие на фикстуре
// придаёт вес выдуманному.

const { scratch } = vi.hoisted(() => {
  const fs = require("node:fs") as typeof import("node:fs");
  const os = require("node:os") as typeof import("node:os");
  const p = require("node:path") as typeof import("node:path");
  const dir = fs.mkdtempSync(p.join(os.tmpdir(), "cc-tour-origin-"));
  process.env.CYBERCHESS_TOURNAMENTS_DIR = dir;
  // Старая запись: поля origin нет ни у одного, как в файле до сегодняшнего дня.
  const legacy = (id: string, title: string) => ({
    id,
    title,
    format: "swiss",
    timeControl: "blitz",
    eloMin: 0,
    eloMax: 3000,
    players: 0,
    maxPlayers: 8,
    prizeChessy: 1000,
    status: "upcoming",
    startsAt: "2026-08-20T10:00:00.000Z",
    registeredUserIds: [],
    roster: [],
    rounds: [],
  });
  fs.writeFileSync(
    p.join(dir, "cyberchess-tournaments.json"),
    JSON.stringify({
      tournaments: [legacy("winter-arena-12", "Winter Arena #12"), legacy("usr-my-event-ab12cd", "Мой турнир")],
    }),
    "utf-8",
  );
  return { scratch: dir };
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

const list = async () => {
  const res = await request(app).get("/api/cyberchess-tournaments/list");
  return res.body.tournaments as Array<{ id: string; title: string; origin?: string }>;
};

afterAll(() => {
  delete process.env.CYBERCHESS_TOURNAMENTS_DIR;
  try {
    realFs.rmSync(scratch, { recursive: true, force: true });
  } catch {
    /* временный каталог */
  }
});

describe("происхождение доезжает и у записей без этого поля", () => {
  test("у каждого турнира в списке происхождение есть", async () => {
    // Пустое поле на странице означало бы отсутствие подписи — то есть образец
    // снова стал бы неотличим от настоящего.
    const rows = await list();
    expect(rows.length).toBeGreaterThan(0);
    for (const t of rows) expect(t.origin).toBeDefined();
  });

  test("старая фикстура читается как образец", async () => {
    const rows = await list();
    expect(rows.find((t) => t.id === "winter-arena-12")?.origin).toBe("seed");
  });

  test("старый пользовательский турнир читается как пользовательский", async () => {
    const rows = await list();
    expect(rows.find((t) => t.id === "usr-my-event-ab12cd")?.origin).toBe("user");
  });

  test("новый турнир получает происхождение явно, а не по имени", async () => {
    // У свежесозданных поле пишется при создании; запасное правило для них
    // не работает — и не должно.
    const created = await request(app)
      .post("/api/cyberchess-tournaments/")
      .send({ title: "Совсем новый", format: "swiss", timeControl: "blitz", maxPlayers: 8 });
    expect(created.status).toBe(201);

    const saved = JSON.parse(realFs.readFileSync(`${scratch}/cyberchess-tournaments.json`, "utf-8"));
    const row = saved.tournaments.find((t: { title: string }) => t.title === "Совсем новый");
    expect(row.origin).toBe("user");
  });
});
