import { describe, test, expect, afterAll, vi } from "vitest";
import * as realFs from "node:fs";
import * as path from "node:path";
import express from "express";
import request from "supertest";

// Таблица лидеров задачи дня и нечитаемый файл. 2026-08-12.
//
// Таблица живёт в JSON-файле и зеркалится в памяти. Загрузка ловила любую
// ошибку и возвращала пустой список — «start empty rather than invent entries».
// Не выдумывать строки правильно, но последствие оказалось хуже показа: пустота
// становилась состоянием в памяти, и первое же сохранение записывало её ПОВЕРХ
// файла. То есть одна временная ошибка чтения — недописанный JSON, гонка на
// подмене, нехватка прав — стирала тысячу строк целиком и навсегда, молча.
//
// Плюс сама ручка отдавала эту пустоту с кодом 200, а страница подписывает
// пустой список словами «Пока никто не решал».

const { scratch } = vi.hoisted(() => {
  const fs = require("node:fs") as typeof import("node:fs");
  const os = require("node:os") as typeof import("node:os");
  const p = require("node:path") as typeof import("node:path");
  const dir = fs.mkdtempSync(p.join(os.tmpdir(), "cc-daily-lb-"));
  process.env.CYBERCHESS_DAILY_DIR = dir;
  // Файл существует и НЕ разбирается — ровно тот случай, который принимали
  // за пустую таблицу. Пишем до импорта модуля: он читает файл при загрузке.
  fs.writeFileSync(p.join(dir, "cyberchess-daily-leaderboard.json"), "{ битый json", "utf-8");
  return { scratch: dir };
});

import dailyRouter, { dailyLeaderboardReadable } from "../src/routes/cyberchessDaily";

const app = express();
app.use(express.json());
app.use("/api/cyberchess-daily", dailyRouter);

const lbFile = path.join(scratch, "cyberchess-daily-leaderboard.json");
const fileRaw = () => realFs.readFileSync(lbFile, "utf-8");

afterAll(() => {
  delete process.env.CYBERCHESS_DAILY_DIR;
  try {
    realFs.rmSync(scratch, { recursive: true, force: true });
  } catch {
    /* временный каталог */
  }
});

describe("нечитаемый файл таблицы не превращается в пустую таблицу", () => {
  test("состояние хранилища честно называет себя нечитаемым", () => {
    expect(dailyLeaderboardReadable()).toBe(false);
  });

  test("ручка отвечает 503, а не пустой таблицей", async () => {
    // 200 с пустым списком страница подписывает словами «Пока никто не решал».
    const res = await request(app).get("/api/cyberchess-daily/leaderboard?limit=10");

    expect(res.status).toBe(503);
    expect(res.body.leaderboard).toBeUndefined();
  });

  test("решение задачи не затирает файл пустотой", async () => {
    // Главное. Игрок решает задачу, сервер сохраняет таблицу — и на старом коде
    // в файл уходил список из одной строки вместо того, что там лежало.
    const before = fileRaw();

    const res = await request(app)
      .post("/api/cyberchess-daily/solve")
      .send({ streak: 3, day: "2026-08-12", timeMs: 12_000, hintsUsed: 0, userId: "u1", name: "Игрок" });

    expect(res.status).toBe(200); // игроку отказывать не за что
    expect(fileRaw()).toBe(before); // а диск трогать нечем
  });

  test("как только файл читается, запись возобновляется сама", async () => {
    // Обратная сторона: защита не должна навсегда выключить сохранение.
    realFs.writeFileSync(lbFile, "[]", "utf-8");

    const res = await request(app)
      .post("/api/cyberchess-daily/solve")
      .send({ streak: 5, day: "2026-08-12", timeMs: 9_000, hintsUsed: 0, userId: "u2", name: "Второй" });

    expect(res.status).toBe(200);
    expect(dailyLeaderboardReadable()).toBe(true);

    // Файл пишется в новой форме — с меткой времени, по которой состояние
    // сравнивается с копией в базе (13.08). Голый массив прежней формы
    // по-прежнему ЧИТАЕТСЯ: этот тест кладёт именно его строкой выше, и если бы
    // старая форма перестала пониматься, таблица потерялась бы на первой же
    // выкатке нового кода.
    const saved = JSON.parse(fileRaw()) as { savedAt: string; leaderboard: Array<{ userId: string }> };
    expect(saved.savedAt).toBeTruthy();
    expect(saved.leaderboard.map((e) => e.userId)).toContain("u2");
  });

  test("после починки таблица снова отдаётся, а не 503", async () => {
    const res = await request(app).get("/api/cyberchess-daily/leaderboard?limit=10");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.leaderboard)).toBe(true);
  });
});
