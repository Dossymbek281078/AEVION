import { describe, test, expect, afterAll, vi } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as realFs from "node:fs";
import express from "express";
import request from "supertest";

// Запись турниров на диск после сбоя. 2026-08-12.
//
// Регистрации и результаты турниров живут в JSON-файле. Первая же неудачная
// запись ставила флаг «больше не пытаться» — в коде он назывался graceful
// no-op, — и с этой секунды всё происходившее оставалось только в памяти
// процесса. Снаружи это неотличимо от нормы: ручки отвечают 200, игрок видит
// себя в списке участников, а после перезапуска не находит ни себя, ни своего
// турнира. Причина отказа обычно временная — нет прав, полный диск, гонка на
// переименовании, — но повторить попытку было нельзя ни разу до перезапуска.
//
// Теперь отказ ставит паузу, а не защёлку.

const { failWrite, writeAttempts, scratch } = vi.hoisted(() => {
  // Каталог заводится здесь: модуль читает переменную окружения при загрузке,
  // а импорты поднимаются выше обычных присваиваний.
  const fs = require("node:fs") as typeof import("node:fs");
  const os2 = require("node:os") as typeof import("node:os");
  const p = require("node:path") as typeof import("node:path");
  const dir = fs.mkdtempSync(p.join(os2.tmpdir(), "cc-tour-persist-"));
  process.env.CYBERCHESS_TOURNAMENTS_DIR = dir;
  return { failWrite: { on: false }, writeAttempts: { count: 0 }, scratch: dir };
});

// Подделка сквозная: всё настоящее, кроме записи файла, которую умеем ломать.
vi.mock("node:fs", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:fs")>();
  const writeFileSync = (...args: unknown[]) => {
    writeAttempts.count += 1;
    if (failWrite.on) throw new Error("EACCES: permission denied");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (real.writeFileSync as any)(...args);
  };
  return { ...real, default: { ...real, writeFileSync }, writeFileSync };
});

// Матчмейкинг сюда не относится — он открывает пул и таймеры.
vi.mock("../src/routes/cyberchessMatchmaking", () => ({
  createPreMatchedMatch: vi.fn(),
  onMatchSettled: vi.fn(),
  ALLOWED_TIME_CONTROLS: ["60+0", "180+0", "300+5", "600+10", "1800+0"],
}));

import tournamentsRouter, { tournamentPersistenceState } from "../src/routes/cyberchessTournaments";

const app = express();
app.use(express.json());
app.use("/api/cyberchess-tournaments", tournamentsRouter);

const dataFile = path.join(scratch, "cyberchess-tournaments.json");

const create = (title: string) =>
  request(app)
    .post("/api/cyberchess-tournaments/")
    .send({ title, format: "swiss", timeControl: "blitz", maxPlayers: 8 });

const savedTitles = (): string[] =>
  JSON.parse(realFs.readFileSync(dataFile, "utf-8")).tournaments.map((t: { title: string }) => t.title);

afterAll(() => {
  vi.useRealTimers();
  delete process.env.CYBERCHESS_TOURNAMENTS_DIR;
  try {
    realFs.rmSync(scratch, { recursive: true, force: true });
  } catch {
    /* каталог во временной папке — не беда */
  }
});

describe("отказ записи — это пауза, а не конец", () => {
  test("сначала запись работает", async () => {
    // Точка отсчёта: без неё «ничего не записалось» ниже ничего не доказывает.
    const res = await create("Первый турнир");

    expect(res.status).toBe(201);
    expect(savedTitles()).toContain("Первый турнир");
    expect(tournamentPersistenceState().healthy).toBe(true);
  });

  test("во время паузы запись не долбится на каждый запрос", async () => {
    // Снять защёлку не значит колотиться в сломанный диск на каждом обращении.
    failWrite.on = true;
    await create("Во время сбоя");
    const attempts = writeAttempts.count;
    expect(tournamentPersistenceState().healthy).toBe(false);

    await create("Сразу следом");
    expect(writeAttempts.count).toBe(attempts);
  });

  test("после паузы запись возобновляется сама", async () => {
    // Главное. На старом коде тут стояла защёлка до перезапуска процесса, и
    // всё, что игроки делали дальше, терялось молча.
    failWrite.on = false;
    vi.useFakeTimers({ toFake: ["Date"] }); // только часы, таймеры supertest не трогаем
    vi.setSystemTime(new Date(Date.now() + 61_000));

    const res = await create("После паузы");
    vi.useRealTimers();

    expect(res.status).toBe(201);
    expect(savedTitles()).toContain("После паузы");
    expect(tournamentPersistenceState().healthy).toBe(true);
  });

  test("то, что произошло во время сбоя, тоже доезжает на диск", async () => {
    // Запись идёт целиком, а не по одному турниру, поэтому первая же удавшаяся
    // запись сохраняет и пропущенное. Проверяем, а не предполагаем.
    expect(savedTitles()).toContain("Во время сбоя");
    expect(savedTitles()).toContain("Сразу следом");
  });
});
