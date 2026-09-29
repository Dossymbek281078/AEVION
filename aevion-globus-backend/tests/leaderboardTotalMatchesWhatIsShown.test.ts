/**
 * Счётчик «всего» в таблице лидеров считает ровно то, что показано.
 *
 * 🔴 ЗАЧЕМ ОТДЕЛЬНЫМ ФАЙЛОМ (30.09.2026). Скрытие наших проб на выдаче
 * сделали одновременно два окна: ede60f6bc (user-63, общий признак
 * `lib/probeRows`) и мой a1aec0c18. Взяли ИХ — он шире, закрывает ещё и
 * рассылку. Мой сторож прогнан на их коде: 4 из 4 зелёные, а при снятой у
 * них строке `!isProbeEntry(e)` краснеют 3 из 4 — то есть он их механизм
 * действительно проверяет, а не пуст.
 *
 * Но один случай есть только у меня, и вместе с выброшенным a1aec0c18 он бы
 * пропал: СОГЛАСОВАННОСТЬ СЧЁТЧИКА. Спрятать строки и оставить «всего 4» —
 * это не починка, а новая ложь: страница напишет «в таблице 4», показав
 * одного. Их пять проверок судят только состав списка, число рядом с ним —
 * ни одна.
 *
 * Поэтому здесь ровно этот случай, без источника: файл новый, ничего не
 * правит и переносится на любую ветку отдельно.
 */
import { describe, test, expect, vi, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import fs from "node:fs";

const { scratchDir } = vi.hoisted(() => {
  const nodeOs = require("node:os") as typeof import("node:os");
  const nodePath = require("node:path") as typeof import("node:path");
  const nodeFs = require("node:fs") as typeof import("node:fs");
  const dir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "cc-lb-total-"));
  process.env.CYBERCHESS_DAILY_DIR = dir;
  // Таблица читается ОДИН раз при загрузке модуля, поэтому файл пишем ДО
  // импорта роутера: тест, пишущий его после, зеленеет и при снятой защите.
  nodeFs.writeFileSync(
    nodePath.join(dir, "cyberchess-daily-leaderboard.json"),
    JSON.stringify([
      { userId: "smoke-c2-verify", name: "smoke-c2", score: 355, streak: 1, country: "🌍", updatedAt: "2026-09-29T19:00:00.000Z" },
      { userId: "probe-kto-to", name: "Проба витрины", score: 900, streak: 9, country: "🌍", updatedAt: "2026-09-29T19:05:00.000Z" },
      { userId: "u_real", name: "Абдолла", score: 400, streak: 1, country: "🌍", updatedAt: "2026-09-29T19:10:00.000Z" },
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

describe("число рядом со списком", () => {
  test("🔴 total равен длине показанного списка", async () => {
    const r = await request(app).get("/api/cyberchess/daily/leaderboard");
    const показано = (r.body.leaderboard || []).length;
    expect(r.body.total).toBe(показано);
  });

  test("и это именно ОДИН живой игрок из трёх записей", async () => {
    // Контроль к первой проверке: «total === длина» было бы верно и для
    // таблицы, где не спрятано ничего. Здесь названо ожидаемое число.
    const r = await request(app).get("/api/cyberchess/daily/leaderboard");
    expect(r.body.total).toBe(1);
    expect((r.body.leaderboard || [])[0]?.userId).toBe("u_real");
  });
});
