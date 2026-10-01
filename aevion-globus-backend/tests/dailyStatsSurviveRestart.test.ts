/**
 * Серия игрока переживает перезапуск процесса.
 *
 * 🔴 ПОВОД 01.10.2026. На проде `_persistence` отдавал `leaderboard: 4,
 * players: 0`: таблица лидеров переживала перезапуск, личная статистика — нет.
 * Серия у задачи дня и есть повод вернуться завтра, а выкатываем мы по
 * нескольку раз в день — значит серии обнулялись всем и регулярно.
 *
 * ПРИЧИНА была не в отсутствии механизма, а в условии. Статистика писалась
 * только в базу, а при старте бралась оттуда лишь если база СВЕЖЕЕ файла:
 * `if (fromDb.savedAtMs <= dailySavedAtMs) return;`. Но файл и база пишутся
 * ОДНИМ вызовом с ОДНОЙ меткой времени — значит база никогда не свежее, и
 * ранний выход каждый раз пропускал восстановление.
 *
 * Теперь статистика лежит в том же файле, что и таблица. Тест поднимает
 * модуль заново на том же каталоге — это и есть перезапуск процесса.
 */
import { describe, test, expect, vi, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-stats-"));
process.env.CYBERCHESS_DAILY_DIR = dir;

beforeAll(() => { process.env.CYBERCHESS_DAILY_DIR = dir; });
afterAll(() => { fs.rmSync(dir, { recursive: true, force: true }); });

async function поднятьМодуль() {
  vi.resetModules();
  process.env.CYBERCHESS_DAILY_DIR = dir;
  return await import("../src/routes/cyberchessDaily");
}

describe("статистика переживает перезапуск", () => {
  test("🔴 решение записано → модуль поднят заново → серия на месте", async () => {
    const первый = await поднятьМодуль();
    const express = (await import("express")).default;
    const request = (await import("supertest")).default;

    const app1 = express(); app1.use(express.json());
    app1.use("/api/cyberchess-daily", первый.default);

    const задача = await request(app1).get("/api/cyberchess-daily/puzzle");
    expect(задача.status).toBe(200);
    const sol = задача.body?.puzzle?.sol;
    expect(Array.isArray(sol), "задача дня не отдалась — проверка не состоялась бы").toBe(true);

    const решение = await request(app1).post("/api/cyberchess-daily/solve").send({
      userId: "u_perezapusk_test", name: "Проверка", country: "KZ",
      timeMs: 30000, hintsUsed: 0, moves: sol,
    });
    expect(решение.status).toBe(200);
    expect(решение.body.streak, "серия не засчиталась").toBe(1);

    // файл обязан содержать статистику, иначе переживать нечему
    const файл = path.join(dir, "cyberchess-daily-leaderboard.json");
    const содержимое = JSON.parse(fs.readFileSync(файл, "utf-8"));
    expect(
      Array.isArray(содержимое.stats),
      "в файле нет раздела stats — статистика не сохраняется",
    ).toBe(true);
    expect(содержимое.stats.some((s: { userId: string }) => s.userId === "u_perezapusk_test")).toBe(true);

    // ПЕРЕЗАПУСК: модуль поднимается заново на том же каталоге
    const второй = await поднятьМодуль();
    const app2 = express(); app2.use(express.json());
    app2.use("/api/cyberchess-daily", второй.default);

    const после = await request(app2).get("/api/cyberchess-daily/user/u_perezapusk_test/stats");
    expect(после.status).toBe(200);
    expect(после.body.statsKnown, "после перезапуска игрока не знают").toBe(true);
    expect(после.body.bestStreak, "серия обнулилась перезапуском").toBe(1);
    expect(после.body.totalSolved).toBe(1);
  });
});
