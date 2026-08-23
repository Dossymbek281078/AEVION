import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";
import { qeventsRouter } from "../src/routes/qevents";

// GET /api/qevents/calendar — негодный год отвечал 500, 20.08.2026.
//
// Замер на боевом адресе, до правки:
//   ?year=            -> 500 {"error":"internal_error"}
//   ?year=abc         -> 500
//   ?year=99999999999 -> 500
//   ?year=2026        -> 200
//   без параметра     -> 200
//
// Причина: parseInt("abc") даёт NaN, дальше
// new Date(Date.UTC(NaN, NaN, 1)).toISOString() бросает RangeError, а
// мягкий catch превращает его в 500. То есть ошибка ЗАПРОСА приходила
// как авария сервера: она попадает в Sentry, поднимает людей и тонет в
// шуме, среди которого потом не видно настоящих отказов. Достаточно
// одного обхода роботом по устаревшей ссылке.
//
// Проверяем обе стороны: негодное даёт 400, годное по-прежнему 200.
// Только вторая половина отличает починку от «запретили всё подряд».

const app = express();
app.use("/api/qevents", qeventsRouter);

describe("qevents /calendar — разбор года и месяца", () => {
  const bad = [
    ["пустой год", "?year="],
    ["год не число", "?year=abc"],
    ["год за пределами", "?year=99999999999"],
    ["год отрицательный", "?year=-5"],
    ["месяц не число", "?month=abc"],
    ["месяц ноль", "?month=0"],
    ["месяц тринадцатый", "?month=13"],
  ] as const;

  for (const [name, q] of bad) {
    test(`${name} -> 400, а не 500`, async () => {
      const r = await request(app).get(`/api/qevents/calendar${q}`);
      expect(r.status).toBe(400);
      expect(r.body.error).toBe("invalid_year_or_month");
    });
  }

  const good = [
    ["без параметров", ""],
    ["верный год", "?year=2026"],
    ["год и месяц", "?year=2026&month=8"],
    ["границы диапазона", "?year=1970&month=12"],
  ] as const;

  for (const [name, q] of good) {
    test(`${name} -> по-прежнему не 400`, async () => {
      const r = await request(app).get(`/api/qevents/calendar${q}`);
      expect(r.status).not.toBe(400);
      expect(r.status).not.toBe(500);
    });
  }
});
