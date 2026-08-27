import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import nodeFs from "node:fs";
import nodeOs from "node:os";
import nodePath from "node:path";

/* Каталог данных — временный, и это не формальность. Без него решения из
 * этого файла записывались в ОТСЛЕЖИВАЕМЫЙ data/cyberchess-daily-leaderboard.json,
 * то есть в таблицу лидеров, которая уезжает в образ при выкатке: на проде
 * рядом с живыми людьми оказывались бы u-fake, u-fast и u-honest с 400 очками.
 * Ровно это уже случалось 13.08 («убрать синтетические строки из продакшена»).
 *
 * Переменная существовала с самого начала, и десять соседних тестов её задают —
 * этот, написанный позже, просто ею не воспользовался. Нашлось не тестом, а
 * тем, что после прогона в рабочей копии оказался изменённым файл данных. */
process.env.CYBERCHESS_DAILY_DIR = nodeFs.mkdtempSync(
  nodePath.join(nodeOs.tmpdir(), "cc-daily-score-"),
);

/* Время решения приходит от клиента, и до 21.08.2026 врать было ВЫГОДНО:
 * timeMs=0 давало максимальный бонус. Скрипт, взявший решение из ответа
 * /puzzle и отправивший его мгновенно, обходил честного игрока на 90 очков.
 *
 * Проверять время по-настоящему нечем — сервер не знает, когда человек открыл
 * задачу. Убрана ВЫГОДА: неправдоподобно малое время не даёт бонуса вовсе.
 */

const DAY = "2026-08-19";
vi.useFakeTimers({ shouldAdvanceTime: true });

async function app() {
  const router = (await import("../src/routes/cyberchessDaily")).default;
  const a = express();
  a.use(express.json());
  a.use("/api/cyberchess-daily", router);
  return a;
}

async function solve(timeMs: number, userId: string) {
  const a = await app();
  const p = await request(a).get("/api/cyberchess-daily/puzzle");
  const moves = p.body?.puzzle?.sol ?? p.body?.sol;
  const r = await request(a)
    .post("/api/cyberchess-daily/solve")
    .send({ userId, moves, timeMs });
  return r;
}

describe("враньё о времени не приносит очков", () => {
  beforeEach(() => { vi.setSystemTime(new Date(`${DAY}T12:00:00Z`)); });
  afterEach(() => { vi.useRealTimers(); });

  test("мгновенная отправка получает МЕНЬШЕ, чем честные полторы минуты", async () => {
    const bystro = await solve(0, "u-fake");
    const chestno = await solve(90_000, "u-honest");
    expect(bystro.status).toBe(200);
    expect(chestno.status).toBe(200);
    const sFake = bystro.body?.score ?? bystro.body?.entry?.score;
    const sHonest = chestno.body?.score ?? chestno.body?.entry?.score;
    expect(typeof sFake, "сервер не вернул очки — проверять нечего").toBe("number");
    expect(sFake, "подделка времени всё ещё выгоднее честного решения").toBeLessThan(sHonest);
  });

  test("быстрый ЧЕСТНЫЙ игрок бонус получает", async () => {
    const r = await solve(3_000, "u-fast");
    const s = r.body?.score ?? r.body?.entry?.score;
    // Три секунды — правдоподобно: ходы надо ввести на доске.
    expect(s, "порог отсекает живых быстрых игроков").toBeGreaterThan(300);
  });
});
