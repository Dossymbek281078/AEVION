import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";

import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Мусор во входе не превращается в NaN на выходе.
 *
 * ЗАЧЕМ. 28.08.2026 закрепил конечность чисел документа — но проверка была бы
 * теоретической, если бы NaN туда не мог попасть настоящим запросом. Память
 * платформы знает этот путь: `Number(q ?? 50)` на `?limit=zzz` даёт NaN, и NaN
 * проходит сквозь Math.min/Math.max дальше.
 *
 * Здесь спрашиваем модуль тем, чем его спросит робот или опечатка: строкой
 * вместо числа, пустотой, отрицательным, дробным, огромным.
 *
 * Ожидание НЕ «всегда 200»: честный отказ 4xx — хороший ответ. Плохой ответ —
 * 200 с NaN, null или пустотой там, где обещано число.
 */
function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
}

/** Ни одно числовое поле ответа не должно быть NaN — на любой глубине. */
function nanPaths(v: unknown, path = ""): string[] {
  if (typeof v === "number") return Number.isFinite(v) ? [] : [path || "(корень)"];
  if (Array.isArray(v)) return v.flatMap((x, i) => nanPaths(x, path + "[" + i + "]"));
  if (v && typeof v === "object") {
    return Object.entries(v as Record<string, unknown>).flatMap(([k, x]) =>
      nanPaths(x, path ? path + "." + k : k),
    );
  }
  return [];
}

const МУСОР = ["zzz", "", "-1", "1e999", "3.7", "null", "undefined", "constructor"];

describe("мусор во входе не даёт NaN в ответе", () => {
  test("набор мусорных значений не сократился", () => {
    // Тот же довод: перебор по списку, значит сокращение списка = тихая
    // потеря покрытия при зелёном цвете.
    expect(МУСОР.length, "набор мусора сократился — покрытие упало молча").toBeGreaterThanOrEqual(8);
  });

  test("GET /city с мусором в city", async () => {
    for (const bad of МУСОР) {
      const res = await request(app()).get("/api/qskyway/city").query({ city: bad });
      expect([200, 400, 404]).toContain(res.status);
      const bad2 = nanPaths(res.body);
      expect(bad2, "city=" + JSON.stringify(bad) + " дал NaN в полях: " + bad2.join(", ")).toEqual([]);
    }
  });

  test("POST обоснования с мусором в from/to", async () => {
    for (const bad of МУСОР) {
      const res = await request(app())
        .post("/api/qskyway/route/justification")
        .send({ from: bad, to: 1, city: "astana" });
      // Отказ — законный ответ. Недопустимо 200 с испорченными числами.
      expect([200, 400, 404, 422]).toContain(res.status);
      const found = nanPaths(res.body);
      expect(found, "from=" + JSON.stringify(bad) + " дал NaN: " + found.join(", ")).toEqual([]);
    }
  });

  test("числовые from/to за границами не дают NaN и не роняют", async () => {
    for (const [f, t] of [[-1, 0], [0, 9999], [1.5, 2.5], [1e9, 1], [0, 0]]) {
      const res = await request(app())
        .post("/api/qskyway/route/justification")
        .send({ from: f, to: t, city: "astana" });
      expect([200, 400, 404, 422]).toContain(res.status);
      const found = nanPaths(res.body);
      expect(found, "from=" + f + " to=" + t + " дал NaN: " + found.join(", ")).toEqual([]);
    }
  });

  test("дробный индекс — честный отказ, а не пятисотка", async () => {
    // НАСТОЯЩАЯ находка этого свипа. `1.5` проходило `typeof === "number"`,
    // дальше им индексировали список площадок, и ручка отвечала 500 с ПУСТЫМ
    // телом — то есть «сломались мы» вместо «неверный индекс».
    //
    // Отдельным тестом, а не строчкой в переборе: перебор говорит «одна из
    // пяти пар упала», а этот называет, какая именно, и не даст вернуть
    // проверку типа обратно к `typeof`.
    // ⚠️ ОБЕ ручки, а не одна. Проверку индексов делают два обработчика —
    // `/route` и `/route/justification`. Первая версия теста била только по
    // второму, и мутация «вернуть typeof» в ПЕРВОМ прошла молча: тест был
    // зелёным при живом дефекте в соседней ручке.
    for (const path of ["/api/qskyway/route", "/api/qskyway/route/justification"]) {
      for (const [f, t] of [[1.5, 2.5], [0.1, 1], [1, 2.000001]]) {
        const res = await request(app()).post(path).send({ from: f, to: t, city: "astana" });
        expect(res.status, path + " from=" + f + " to=" + t + " дал " + res.status + " вместо отказа 4xx").toBe(400);
        expect(String(res.body?.error ?? ""), path + ": отказ без объяснения").not.toBe("");
        expect(res.body?.errorEn, path + ": отказ только по-русски").toBeTruthy();
      }
    }
    // Целые по-прежнему работают: проверка не должна отсечь законный вход.
    const ok = await request(app())
      .post("/api/qskyway/route/justification")
      .send({ from: 0, to: 1, city: "astana" });
    expect(ok.status, "целые индексы перестали работать").toBe(200);
  });
});
