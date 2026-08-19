/**
 * Четыре записи с нечитаемым именем (U+FFFD) успели попасть в боевую таблицу
 * 19.08.2026 до того, как приём таких имён закрыли. Витрина показывала
 * «████████3 — 100 200 очков». Данные не удаляем — скрываем на выдаче.
 *
 * Таблица читается ОДИН раз при загрузке модуля, поэтому битую запись надо
 * положить в файл ДО импорта роутера. Первая версия теста писала файл после
 * импорта, зеленела и не краснела при снятой защите — то есть не проверяла
 * ничего (см. feedback_mutation_must_change_behavior).
 */
import { describe, test, expect, vi, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import fs from "node:fs";

const { scratchDir } = vi.hoisted(() => {
  const nodeOs = require("node:os") as typeof import("node:os");
  const nodePath = require("node:path") as typeof import("node:path");
  const nodeFs = require("node:fs") as typeof import("node:fs");
  const dir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "cc-lb-broken-"));
  process.env.CYBERCHESS_DAILY_DIR = dir;
  nodeFs.writeFileSync(
    nodePath.join(dir, "cyberchess-daily-leaderboard.json"),
    JSON.stringify([
      { userId: "broken", name: "���3", score: 100200, streak: 999, country: "🌍", updatedAt: "2026-08-19T11:01:12.385Z" },
      { userId: "fine", name: "Абдолла", score: 400, streak: 1, country: "🌍", updatedAt: "2026-08-19T11:08:30.867Z" },
    ]),
    "utf8",
  );
  return { scratchDir: dir };
});

import dailyRouter from "../src/routes/cyberchessDaily";

const app = express();
app.use(express.json());
app.use("/api/cyberchess/daily", dailyRouter);

afterAll(() => { fs.rmSync(scratchDir, { recursive: true, force: true }); });

describe("таблица лидеров: нечитаемые имена", () => {
  test("битая запись не выходит наружу, целая остаётся", async () => {
    const r = await request(app).get("/api/cyberchess/daily/leaderboard");
    expect(r.status).toBe(200);
    const names = (r.body.leaderboard ?? []).map((x: Record<string, string>) => x.name);

    expect(names.length, "таблица не загрузилась — проверять нечего").toBeGreaterThan(0);
    expect(names.some((n: string) => n.includes("�")), `наружу вышло: ${names.join(" | ")}`).toBe(false);
    expect(names).toContain("Абдолла");
    expect(r.body.total, "total должен считать показанные, а не скрытые").toBe(names.length);
  });
});
