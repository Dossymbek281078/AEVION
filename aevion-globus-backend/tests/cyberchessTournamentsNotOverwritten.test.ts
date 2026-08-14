import { describe, test, expect, afterAll, vi } from "vitest";
import * as realFs from "node:fs";
import * as path from "node:path";
import express from "express";
import request from "supertest";

// Испорченный файл турниров. 2026-08-12.
//
// Регистрации, составы и результаты турниров лежат в JSON-файле. Загрузка
// возвращала null и при отсутствии файла, и при любой ошибке чтения — а
// initStore на null записывал на диск ФИКСТУРЫ. То есть один испорченный JSON,
// разовая нехватка прав или неожиданная форма содержимого заменяли всё, что
// наиграли люди, набором демо-турниров — прямо при старте процесса, без
// чьего-либо участия и без единого сообщения.
//
// Атомарная запись через переименование, о которой сказано в коде рядом,
// защищает только от обрыва посреди записи. Все прочие причины она не закрывает.

const { scratch } = vi.hoisted(() => {
  const fs = require("node:fs") as typeof import("node:fs");
  const os = require("node:os") as typeof import("node:os");
  const p = require("node:path") as typeof import("node:path");
  const dir = fs.mkdtempSync(p.join(os.tmpdir(), "cc-tour-corrupt-"));
  process.env.CYBERCHESS_TOURNAMENTS_DIR = dir;
  // Файл существует и не разбирается — модуль читает его при загрузке.
  fs.writeFileSync(p.join(dir, "cyberchess-tournaments.json"), "{ битый json", "utf-8");
  return { scratch: dir };
});

vi.mock("../src/routes/cyberchessMatchmaking", () => ({
  createPreMatchedMatch: vi.fn(),
  onMatchSettled: vi.fn(),
  ALLOWED_TIME_CONTROLS: ["60+0", "180+0", "300+5", "600+10", "1800+0"],
}));

import tournamentsRouter, { tournamentStoreDegraded } from "../src/routes/cyberchessTournaments";

const app = express();
app.use(express.json());
app.use("/api/cyberchess-tournaments", tournamentsRouter);

const dataFile = path.join(scratch, "cyberchess-tournaments.json");
const fileRaw = () => realFs.readFileSync(dataFile, "utf-8");

afterAll(() => {
  delete process.env.CYBERCHESS_TOURNAMENTS_DIR;
  try {
    realFs.rmSync(scratch, { recursive: true, force: true });
  } catch {
    /* временный каталог */
  }
});

describe("испорченный файл турниров не заменяется фикстурами", () => {
  test("файл остаётся нетронутым после старта модуля", () => {
    // Главное. На старом коде здесь уже лежали бы одиннадцать демо-турниров
    // вместо того, что было.
    expect(fileRaw()).toBe("{ битый json");
    expect(tournamentStoreDegraded()).toBe(true);
  });

  test("список отвечает отказом, а не фикстурами", async () => {
    // Выдать демо-турниры за настоящие хуже, чем честно отказать: страница
    // покажет несуществующие события как живые.
    const res = await request(app).get("/api/cyberchess-tournaments/list");

    expect(res.status).toBe(503);
    expect(res.body.tournaments).toBeUndefined();
  });

  test("создание турнира тоже отвечает отказом", async () => {
    // Копить в памяти то, что некуда сохранить, — обещание, которого мы не
    // сдержим: человек увидит свой турнир и потеряет его на перезапуске.
    const res = await request(app)
      .post("/api/cyberchess-tournaments/")
      .send({ title: "Пока файл битый", format: "swiss", timeControl: "blitz", maxPlayers: 8 });

    expect(res.status).toBe(503);
    expect(fileRaw()).toBe("{ битый json");
  });

  test("как только файл читается, модуль оживает сам", async () => {
    // Обратная сторона: отказ не должен стать вечным до перезапуска.
    realFs.writeFileSync(dataFile, JSON.stringify({ tournaments: [] }), "utf-8");

    const list = await request(app).get("/api/cyberchess-tournaments/list");

    expect(list.status).toBe(200);
    expect(tournamentStoreDegraded()).toBe(false);
  });

  test("после оживления запись снова доходит до диска", async () => {
    const res = await request(app)
      .post("/api/cyberchess-tournaments/")
      .send({ title: "После починки", format: "swiss", timeControl: "blitz", maxPlayers: 8 });

    expect(res.status).toBe(201);
    const saved = JSON.parse(fileRaw()) as { tournaments: Array<{ title: string }> };
    expect(saved.tournaments.map((t) => t.title)).toContain("После починки");
  });
});
