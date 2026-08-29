import { describe, expect, test } from "vitest";
import request from "supertest";
import express from "express";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Набор полей в ответе одинаков для всех городов.
 *
 * ПОВОД (29.08.2026). У Нью-Йорка — города С сеткой потолков — поле
 * `permission` не отдавалось ВОВСЕ: его добавили только в ветку «сетки
 * нет». Читатель ответа получал `undefined`, а это читается как
 * «требований к разрешению нет» — вывод, которого мы не делали.
 *
 * Данных о разрешительном режиме у NYC действительно нет. Но «данных
 * нет» и «требований нет» — разные утверждения.
 *
 * Это та же форма класса «умолчание выдаёт себя за факт», только вместо
 * ложного ЗНАЧЕНИЯ — ложная ТИШИНА. И она хуже: подстановку видно в коде,
 * а пропуск поля не виден нигде, кроме сравнения двух ответов.
 *
 * Поэтому проверка не про конкретное поле, а про СИММЕТРИЮ: разница в
 * наборе ключей между городами почти всегда означает забытую ветку.
 */
const app = express();
app.use(express.json());
app.use("/api/qskyway", qskywayRouter);

describe("ответы разных городов имеют одинаковую форму", () => {
  test("набор полей блока airspace не зависит от города", async () => {
    const keysByCity: Record<string, string[]> = {};

    for (const city of ["astana", "nyc", "tokyo"]) {
      const r = await request(app).post("/api/qskyway/route").send({ from: 0, to: 3, city });
      expect(r.status, city + ": маршрут не построился").toBe(200);
      const block = (r.body.airspace ?? {}) as Record<string, unknown>;
      keysByCity[city] = Object.keys(block).sort();
    }

    // Отрицательный контроль: пустые блоки совпали бы между собой и дали
    // зелёный результат при полностью сломанном ответе.
    for (const [city, keys] of Object.entries(keysByCity)) {
      expect(keys.length, city + ": блок airspace пуст — сравнивать нечего").toBeGreaterThan(5);
    }

    const [first, ...rest] = Object.keys(keysByCity);
    for (const city of rest) {
      const missing = keysByCity[first].filter((k) => !keysByCity[city].includes(k));
      const extra = keysByCity[city].filter((k) => !keysByCity[first].includes(k));
      expect(
        { missing, extra },
        city + " отвечает не тем набором полей, что " + first +
          ": пропуск поля читается как «такого требования нет»",
      ).toEqual({ missing: [], extra: [] });
    }
  }, 60000);
});
