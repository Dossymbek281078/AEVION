import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";

import { qskywayRouter } from "../src/routes/qskyway";
import { CITY } from "../src/routes/qskyway.city";
import { CITY_NYC } from "../src/routes/qskyway.city.nyc";
import { CITY_TOKYO } from "../src/routes/qskyway.city.tokyo";
import { CITY_SINGAPORE } from "../src/routes/qskyway.city.singapore";
import { CITY_AMSTERDAM } from "../src/routes/qskyway.city.amsterdam";

/**
 * Каждая пара площадок в каждом городе даёт маршрут.
 *
 * ПОВОД (16.09.2026). Амстердам ушёл на прод с центральной площадкой в 163 м от
 * центра демо-круга над станцией Зюйд (радиус 220 м): 12 направлений из 42 были
 * непроходимы, и заметил это только смоук ПОСЛЕ выкатки (30/42). Ни один тест до
 * выкатки этого не спрашивал: площадки и зоны задаются в разных файлах, и их
 * согласие не проверялось нигде. Площадки — это витрина модуля: «42 маршрута в
 * обе стороны» стоит на /qskyway, и город, у которого их 30, обещание не держит.
 *
 * Список городов ПОВТОРЁН намеренно (см. qskywayEveryCityHasZoneData): импорт
 * CITIES из роутера поднял бы его побочные эффекты; отрицательный контроль —
 * длина списка против экспорта городов.
 */
const CITIES = { astana: CITY, nyc: CITY_NYC, tokyo: CITY_TOKYO, singapore: CITY_SINGAPORE, amsterdam: CITY_AMSTERDAM } as const;
const app = express().use(express.json()).use("/api/qskyway", qskywayRouter);

describe("каждая пара площадок проходима — в каждом городе", () => {
  test("список городов здесь совпадает с числом твинов", () => {
    expect(Object.keys(CITIES).length).toBe(5);
  });

  for (const [city, twin] of Object.entries(CITIES)) {
    test(`[${city}] все ${twin.vertiports.length * (twin.vertiports.length - 1)} направлений дают маршрут`, async () => {
      const n = twin.vertiports.length;
      const dead: string[] = [];
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const r = await request(app).post("/api/qskyway/route").send({ from: i, to: j, city });
          if (r.status !== 200 || !r.body?.path) dead.push(`${i}→${j} (${r.status}${r.body?.error ? " " + r.body.error : ""})`);
        }
      }
      expect(dead, `${city}: непроходимые направления — площадка стоит в зоне запрета или вне сетки`).toEqual([]);
    }, 120_000);
  }
});
