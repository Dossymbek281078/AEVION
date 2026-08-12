import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";

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

const CITIES = ["astana", "nyc", "tokyo"] as const;

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
