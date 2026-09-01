import { describe, expect, test } from "vitest";
import request from "supertest";
import express from "express";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Ни одна «часть» в ответах модуля не больше своего «целого».
 *
 * ПОВОД (29.08.2026). У пары `zeroCeilingCells` / `gridCells` нашлось,
 * что завышение части не ловит никто: мутация до 99999 при 8858 ячейках
 * прошла молча. Дефект не в одном поле — в модуле таких пар много, а
 * проверяли их поштучно и не все.
 *
 * Почему это важнее, чем кажется. Каждая пара публикуется РЯДОМ и
 * читается как доля: «6 из 42 маршрутов», «2520 ячеек из 8858». Внешний
 * проверяющий видит пару, а не поле. Часть больше целого разрушает
 * доверие ко всему ответу, включая верные соседние числа.
 *
 * Отношения выведены из КОДА, а не из сегодняшних данных:
 *   • маршрутизуемых не больше, чем пар площадок;
 *   • соответствующих и строго маршрутизуемых не больше, чем маршрутизуемых;
 *   • задетых зданий не больше, чем подставленных;
 *   • задетых пар не больше, чем маршрутизуемых;
 *   • участков с превышением и без потолка не больше, чем участков всего.
 * Поэтому проверка не устареет при обновлении данных города.
 *
 * Замер в день написания (nyc): pairs=42 routable=42 compliant=6
 * strictRoutable=20 zeroCeilingCells=2520 gridCells=8858; (astana)
 * buildings=38 underRoutes=27 affectedPairs=23.
 */
const app = express();
app.use(express.json());
app.use("/api/qskyway", qskywayRouter);

const CITIES = ["astana", "nyc", "tokyo"];

/** Проверяет отношение и НЕ молчит, если одного из чисел нет вовсе. */
function partFitsWhole(part: unknown, whole: unknown, label: string): number {
  if (typeof part !== "number" || typeof whole !== "number") return 0;
  expect(part, label + ": часть отрицательна").toBeGreaterThanOrEqual(0);
  expect(part, label + ": часть (" + part + ") больше целого (" + whole + ")").toBeLessThanOrEqual(whole);
  return 1;
}

describe("части не превышают целых", () => {
  test.each(CITIES)("[%s] влияние на площадки", async (city) => {
    const r = await request(app).get("/api/qskyway/airspace/impact?city=" + city);
    expect(r.status).toBe(200);
    const b = r.body as Record<string, unknown>;

    let checked = 0;
    checked += partFitsWhole(b.routable, b.pairs, "routable/pairs");
    checked += partFitsWhole(b.compliant, b.routable, "compliant/routable");
    checked += partFitsWhole(b.strictRoutable, b.routable, "strictRoutable/routable");
    checked += partFitsWhole(b.padsNeedingAtc, b.pairs, "padsNeedingAtc/pairs");
    checked += partFitsWhole(b.zeroCeilingCells, b.gridCells, "zeroCeilingCells/gridCells");

    // Считаем ВЫПОЛНЕННЫЕ сравнения. Без этого город без сетки дал бы
    // ноль сравнений и зелёный результат — проверка, которой не было.
    if (b.available === true) {
      expect(checked, city + ": сетка объявлена, а сравнивать нечего").toBeGreaterThan(2);
    }
  }, 60000);

  test.each(CITIES)("[%s] влияние подставленных высот", async (city) => {
    const r = await request(app).get("/api/qskyway/height-substitution?city=" + city);
    expect(r.status).toBe(200);
    const b = r.body as Record<string, unknown>;

    let checked = 0;
    checked += partFitsWhole(b.buildingsUnderRoutes, b.buildings, "underRoutes/buildings");
    checked += partFitsWhole(b.routable, b.pairs, "routable/pairs");
    checked += partFitsWhole(b.affectedPairs, b.routable, "affectedPairs/routable");
    if (b.available === true) {
      expect(checked, city + ": подстановки объявлены, а сравнивать нечего").toBeGreaterThan(1);
    }
  }, 60000);

  test.each(CITIES)("[%s] участки маршрута", async (city) => {
    const r = await request(app).post("/api/qskyway/route").send({ from: 0, to: 3, city });
    expect(r.status).toBe(200);
    const segments = (r.body.alts as number[] | undefined)?.length;
    const air = (r.body.airspace ?? {}) as Record<string, unknown>;

    let checked = 0;
    checked += partFitsWhole(r.body.measuredObstacleSegments, r.body.obstacleSegments, "measured/obstacle");
    checked += partFitsWhole(r.body.obstacleSegments, segments, "obstacle/segments");
    checked += partFitsWhole(air.exceedingSegments, segments, "exceeding/segments");
    checked += partFitsWhole(air.zeroCeilingSegments, segments, "zeroCeiling/segments");

    expect(checked, city + ": ни одного сравнения по участкам — маршрут не отдал чисел").toBeGreaterThan(1);
  }, 60000);
});
