import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * «Согласование с УВД не требуется» нельзя говорить о городе, о потолках
 * которого мы не знаем ничего.
 *
 * ПОВОД. Поле считалось как `ceilingM === 0`. У города без сетки потолков
 * `ceilingM` равен null, а `null === 0` даёт **false** — то есть каждая
 * площадка Астаны и Токио сообщала «согласование не требуется», хотя данных
 * о потолках нет вовсе. Ложное успокоение в модуле про воздушное пространство.
 *
 * Отличие от остальных семи случаев этого класса: тот был НЕ латентным.
 * У Астаны сетки потолков нет на самом деле, значит неверный ответ уходил
 * пользователю уже сегодня, а не ждал первого города без данных.
 *
 * Проверка сравнивает ДВА города, а не смотрит на один: у NYC потолки есть,
 * и там false — законный ответ. Только разница между городами доказывает, что
 * поле отражает знание, а не умолчание.
 */
function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
}

async function pads(city: string) {
  const res = await request(app()).get("/api/qskyway/city").query({ city });
  expect(res.status, "город " + city + " не отдал маршрут").toBe(200);
  const v = res.body?.vertiportScores;
  expect(Array.isArray(v) && v.length > 0, "нет площадок у " + city).toBe(true);
  return v as { needsAtcCoordination: boolean | null; ceilingM: number | null }[];
}

describe("незнание о потолках не выдаётся за «согласование не требуется»", () => {
  test("город БЕЗ сетки потолков: null, а не false", async () => {
    const v = await pads("astana");
    // Контроль: убеждаемся, что попали именно в случай «потолки неизвестны».
    expect(v.every((p) => p.ceilingM === null), "у Астаны появились потолки — проверка смотрит не на тот случай").toBe(true);

    const falses = v.filter((p) => p.needsAtcCoordination === false).length;
    expect(falses, "площадок с ответом «не требуется» при неизвестном потолке: " + falses).toBe(0);
    expect(v.every((p) => p.needsAtcCoordination === null), "ожидалось null у каждой площадки").toBe(true);
  });

  test("город С сеткой потолков: ответ по существу, не null", async () => {
    const v = await pads("nyc");
    // Иначе починку можно было бы «сделать», вернув null всегда — и потерять
    // настоящий ответ там, где он есть.
    expect(v.some((p) => p.needsAtcCoordination !== null), "у NYC потолки есть, ответ обязан быть по существу").toBe(true);
    for (const p of v) {
      if (p.ceilingM === null) continue;
      expect(p.needsAtcCoordination, "потолок известен — ответ обязан быть булевым").toBe(p.ceilingM === 0);
    }
  });
});
