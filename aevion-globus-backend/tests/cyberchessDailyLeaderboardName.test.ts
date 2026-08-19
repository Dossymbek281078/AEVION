/**
 * Имя в ПУБЛИЧНОЙ таблице лидеров задачи дня.
 *
 * Замер 19.08.2026 на боевом рейтинге: четыре записи из четырёх имели имя,
 * состоящее из символов-замен (U+FFFD, в байтах ef bf bd). Их оставили
 * проверки, отправленные утилитой, которая портит кириллицу при отправке.
 * Снаружи витрина показывала «████████3 — 100 200 очков», и это единственное,
 * что видел бы посетитель на странице запуска.
 *
 * Отдельный файл, а не блок в cyberchessDailySolveBounds: у /solve лимит
 * 30 запросов в минуту на адрес, и в общем файле мои проверки шли
 * тринадцатыми — падали с 429 из-за чужих запросов, а не по делу.
 */
import { describe, test, expect, vi, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import fs from "node:fs";

const { scratchDir } = vi.hoisted(() => {
  const nodeOs = require("node:os") as typeof import("node:os");
  const nodePath = require("node:path") as typeof import("node:path");
  const nodeFs = require("node:fs") as typeof import("node:fs");
  const dir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "cc-daily-name-"));
  process.env.CYBERCHESS_DAILY_DIR = dir;
  return { scratchDir: dir };
});

import dailyRouter from "../src/routes/cyberchessDaily";

const app = express();
app.use(express.json());
app.use("/api/cyberchess/daily", dailyRouter);

const today = () => new Date().toISOString().slice(0, 10);
const movesForToday = async (): Promise<string[]> => {
  const r = await request(app).get("/api/cyberchess/daily/puzzle");
  return (r.body?.puzzle?.sol ?? []) as string[];
};
const leaderboard = async () => {
  const r = await request(app).get("/api/cyberchess/daily/leaderboard");
  return (r.body.leaderboard ?? r.body.entries ?? []) as Array<Record<string, string>>;
};

afterAll(() => { fs.rmSync(scratchDir, { recursive: true, force: true }); });

describe("имя в таблице лидеров", () => {
  test("имя из символов-замен заменяется, а не публикуется", async () => {
    const moves = await movesForToday();
    expect(moves.length, "пул задач не загрузился — проверка была бы пустой").toBeGreaterThan(0);
    const uid = `broken_${Date.now()}`;

    const r = await request(app).post("/api/cyberchess/daily/solve")
      .send({ day: today(), userId: uid, name: "����3", moves });
    expect(r.status).toBe(200);

    const mine = (await leaderboard()).find((x) => x.userId === uid);
    expect(mine, "запись не создалась").toBeTruthy();
    expect(mine!.name).not.toMatch(/�/);
    expect(mine!.name.startsWith("Player_"), `подставлено: ${mine!.name}`).toBe(true);
  });

  test("живое кириллическое имя сохраняется как есть", async () => {
    const moves = await movesForToday();
    expect(moves.length).toBeGreaterThan(0);
    const uid = `ok_${Date.now()}`;

    await request(app).post("/api/cyberchess/daily/solve")
      .send({ day: today(), userId: uid, name: "Абдолла", moves });

    expect((await leaderboard()).find((x) => x.userId === uid)?.name).toBe("Абдолла");
  });
});
