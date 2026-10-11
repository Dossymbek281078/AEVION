import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

/*
 * Сторож: число «из скольких выбирали сегодня» обязано САМО называть диапазон и
 * совокупность.
 *
 * Повод (замер 11.10.2026, прод): эта ручка отдавала `choiceTotal: 137148`, а
 * `/api/cyberchess-puzzles?minRating=800&maxRating=1200` — `total: 136476`.
 * Разница 672 объясняется тем, что сосед считает по обслуживаемой выборке
 * (500 000, `capped: true`), а задача дня выбирается по всему банку (502 584).
 * Оба числа верны для своего вопроса — но читатель, который их сравнил, не мог
 * понять, какое брать, и это ровно та путаница, что однажды довела неверное
 * число до витрины.
 *
 * 🔴 Ожидания здесь — ЛИТЕРАЛЫ 800 и 1200, а не импортированная константа.
 * Сторож, выводящий ожидание из охраняемого значения, — тавтология: правка
 * константы прошла бы насквозь.
 */

const { db } = vi.hoisted(() => {
  process.env.DATABASE_URL = "postgres://test/test";
  return { db: { банк: 502584, вДиапазоне: 137148, границы: [] as unknown[] } };
});

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (text: string, params: unknown[] = []) => {
      if (/count\(\*\)/i.test(text)) {
        if (/BETWEEN/i.test(text)) {
          db.границы = [params[0], params[1]];
          return { rows: [{ n: db.вДиапазоне }], rowCount: 1 };
        }
        return { rows: [{ n: db.банк }], rowCount: 1 };
      }
      if (/FROM "ChessPuzzle"/i.test(text)) {
        const рейтинг = /BETWEEN/i.test(text) ? Number(params[0]) + 100 : 1500;
        return {
          rows: [{ id: "bank_x", fen: "8/8/8/8/8/8/8/K6k w - - 0 1", sol: '["a1b1","b1c1"]', name: "Тактика", rating: рейтинг, theme: "Эндшпиль" }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    },
    on: () => {},
  }),
}));

vi.mock("../src/routes/cyberchessMatchmaking", () => ({
  createPreMatchedMatch: vi.fn(),
  onMatchSettled: vi.fn(),
  ALLOWED_TIME_CONTROLS: ["60+0", "180+0", "300+5", "600+10", "1800+0"],
}));

import dailyRouter from "../src/routes/cyberchessDaily";

const app = express();
app.use(express.json());
app.use("/api/cyberchess-daily", dailyRouter);

describe("choiceTotal называет совокупность", () => {
  test("рядом с числом едут диапазон и совокупность", async () => {
    const res = await request(app).get("/api/cyberchess-daily/puzzle");
    expect(res.status).toBe(200);

    expect(res.body.choiceTotal, "число отобранных").toBe(db.вДиапазоне);
    expect(res.body.bankTotal, "банк — отдельным числом").toBe(db.банк);
    expect(res.body.choiceTotal).not.toBe(res.body.bankTotal);

    // Диапазон назван ЛИТЕРАЛАМИ: 800–1200 — это обещание продукта новичку,
    // а не произвольное содержимое константы.
    expect(res.body.choiceRange, "диапазон отбора назван").toEqual({ min: 800, max: 1200 });
    // И запрос в базу шёл по тем же границам — иначе подпись врёт о числе.
    expect(db.границы).toEqual([800, 1200]);

    expect(String(res.body.choiceCountedOver), "совокупность названа словами")
      .toMatch(/весь банк/i);
    // Совокупность НЕ должна называть обслуживаемую выборку: по ней считает сосед.
    expect(String(res.body.choiceCountedOver)).not.toMatch(/обслуживаемой выборке$/);
  });

  test("число отобранных не больше банка — иначе подписи перепутаны местами", async () => {
    const res = await request(app).get("/api/cyberchess-daily/puzzle");
    expect(res.body.choiceTotal).toBeLessThanOrEqual(res.body.bankTotal);
  });

  test("рейтинг выбранной задачи попадает в названный диапазон", async () => {
    const res = await request(app).get("/api/cyberchess-daily/puzzle");
    const r = res.body.puzzle?.rating;
    expect(typeof r).toBe("number");
    expect(r).toBeGreaterThanOrEqual(800);
    expect(r).toBeLessThanOrEqual(1200);
  });
});
