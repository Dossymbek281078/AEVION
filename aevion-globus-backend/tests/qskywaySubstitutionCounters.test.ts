import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Счётчики подстановки — по ВСЕМ парам всех трёх городов, а не по первой
 * найденной.
 *
 * 12.08.2026 первая версия счётчика опознавала здание по совпадению высоты, и у
 * Астаны, где 38 подстановок дают одинаковые 59 м, один задетый дом считался за
 * тридцать: живой ответ показывал «участков 15, зданий 30». Тест этого не видел,
 * потому что смотрел Нью-Йорк с ЕДИНСТВЕННОЙ подстановкой — на таких данных
 * дефект не проявляется в принципе.
 *
 * Отсюда правило этого файла: перебирать все пары и все города, а утверждать
 * СВОЙСТВА («зданий не больше, чем участков»), а не конкретные числа, которые
 * поедут при следующей пересборке твина.
 */
// `express.json()` обязателен: без него тело POST не разбирается, ручка
// отвечает 400 «нужны числовые from, to», и перебор молча проверяет ноль пар.
const app = express().use(express.json()).use("/api/qskyway", qskywayRouter);

/**
 * Список городов выводится ИЗ КОДА, а не перечисляется здесь.
 *
 * ПОВОД. Он был зашит тремя строками. Сегодня совпадает с кодом — проверено, —
 * но добавят четвёртый город, и счётчики подстановки для него молча перестанут
 * проверяться: положительный список не краснеет от того, чего не знает.
 * Это третий такой случай за ночь (тесты модуля, ключи перевода, города).
 */
const ROUTES_SRC = readFileSync(
  path.join(__dirname, "..", "src", "routes", "qskyway.ts"),
  "utf8",
);
const CITIES: readonly string[] = (() => {
  const at = ROUTES_SRC.indexOf("const CITIES: Record<string, CityData> = {");
  if (at < 0) return [];
  const open = ROUTES_SRC.indexOf("{", at);
  const close = ROUTES_SRC.indexOf("}", open);
  return Array.from(
    ROUTES_SRC.slice(open + 1, close).matchAll(/([a-z][a-z0-9]*)\s*:/g),
    (m) => m[1],
  );
})();

describe("список городов выведен, а не пуст", () => {
  test("разбор нашёл города — иначе все проверки ниже пусты", () => {
    expect(CITIES.length, "разбор CITIES сломался: проверки стали бы пустыми").toBeGreaterThanOrEqual(3);
  });
});

describe("счётчики подстановки на всех парах площадок", () => {
  for (const city of CITIES) {
    test(`[${city}] зданий не больше, чем участков, и оба > 0`, async () => {
      const pads = (await request(app).get(`/api/qskyway/vertiports?city=${city}`)).body.count as number;
      let withField = 0, checked = 0;
      for (let a = 0; a < pads; a++) {
        for (let b = 0; b < pads; b++) {
          if (a === b) continue;
          const r = await request(app).post("/api/qskyway/route/justification").send({ from: a, to: b, city });
          if (r.status !== 200) continue;
          checked++;
          const s = r.body.document.substitutedHeights;
          if (!s) continue;
          withField++;
          expect(s.segments, `${city} ${a}->${b}: участков не больше нуля`).toBeGreaterThan(0);
          expect(s.buildings, `${city} ${a}->${b}: зданий не больше нуля`).toBeGreaterThan(0);
          // Одно здание занимает несколько ячеек, поэтому зданий может быть
          // только МЕНЬШЕ или столько же. Обратное — арифметически невозможно,
          // и именно так выглядел дефект.
          expect(s.buildings, `${city} ${a}->${b}: зданий ${s.buildings} при ${s.segments} участках`)
            .toBeLessThanOrEqual(s.segments);
        }
      }
      expect(checked, `${city}: не построилось ни одного маршрута — проверять нечего`).toBeGreaterThan(0);
      // Город, где подстановка не задевает коридоры, — законный случай (так было
      // бы, стой площадки в стороне). Но если ни один из трёх городов её не
      // задевает, значит проверка выше зелена на пустоте.
      return withField;
    });
  }

  test("хотя бы в одном городе подстановка реально попадает под коридоры", async () => {
    let total = 0;
    for (const city of CITIES) {
      const r = await request(app).get(`/api/qskyway/height-substitution?city=${city}`);
      total += r.body.affectedPairs ?? 0;
    }
    expect(total).toBeGreaterThan(0);
  });
});
