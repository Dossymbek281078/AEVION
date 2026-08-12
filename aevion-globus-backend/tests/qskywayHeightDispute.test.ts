import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";

import { qskywayRouter, __engineForTests } from "../src/routes/qskyway";
import type { CityData } from "../src/routes/qskyway.city";

/**
 * Высота, которой твин сам не верит, до 12.08.2026 влияла на коридор молча:
 * чип «⚠ высота под вопросом» говорил про ГОРОД, а маршрут закладывался на то
 * же спорное число и об этом не сообщал ни в ответе, ни в подписанном
 * обосновании. Здесь проверяется обе стороны новой ручки `heightDispute`:
 *
 *  1) она СРАБАТЫВАЕТ, когда коридор действительно опирается на спорную высоту
 *     (на живых городах это не воспроизвести — площадок рядом с башней нет, и
 *     молчащий детектор был бы неотличим от сломанного);
 *  2) она МОЛЧИТ, когда коридор до спорного здания не доходит — иначе
 *     предупреждение висело бы на каждом рейсе Астаны и его перестали бы читать.
 */

const app = express();
app.use(express.json());
app.use("/api/qskyway", qskywayRouter);

/**
 * Узкий коридор шириной в одну ячейку: обойти башню физически негде, поэтому
 * маршрут обязан её перелететь. Индекс здания — 194, тот же, что у разобранной
 * Абу-Даби Плаза, чтобы подтянулся настоящий разбор (382 м тег / 310.8 м статья).
 */
function twinWithTowerOnTheOnlyPath(): CityData {
  const cols = 12, rows = 1, cell = 20;
  const heights = new Array(cols * rows).fill(0);
  const src = new Array(cols * rows).fill(0);
  heights[6] = 382; // башня ровно посреди единственного пути
  const buildings: CityData["buildings"] = [];
  for (let i = 0; i < 195; i++) buildings.push({ h: 10, hs: 0, r: [[0, 0], [1, 0], [1, 1], [0, 1]] });
  buildings[194] = {
    h: 382, hs: 1,
    // габарит здания — ровно ячейка с индексом 6 (x 120..140 при cell=20)
    r: [[121, 1], [139, 1], [139, 19], [121, 19]],
  };
  return {
    city: "тестовый твин",
    bbox: { minLat: 51.1, maxLat: 51.11, minLon: 71.4, maxLon: 71.41 },
    meters: { w: cols * cell, h: rows * cell },
    grid: { cols, rows, cell, heights, src },
    buildings,
    vertiports: [{ c: 0, r: 0, x: 10, y: 10 }, { c: 11, r: 0, x: 230, y: 10 }],
    dataQuality: {
      total: 195, measured: 194, derived: 1, guessed: 0, measuredPct: 99, realPct: 100,
      source: "test", note: "test",
      suspect: [{ i: 194, h: 382, times: 4.66, why: "towers over the city" }],
    },
  };
}

describe("расхождение по высоте — коридор поднят числом, которому мы не верим", () => {
  test("детектор срабатывает и называет цену расхождения", () => {
    const twin = twinWithTowerOnTheOnlyPath();
    const route = __engineForTests.buildRoute("astana", twin, 0, 1, false);
    expect(route).not.toBeNull();

    const d = __engineForTests.heightDisputeFor("astana", twin, route!);
    expect(d).not.toBeNull();
    expect(d!.affected).toBe(true);
    expect(d!.building).toBe(194);
    expect(d!.segments).toBeGreaterThan(0);

    // Число из тега и число из статьи — оба из разбора, а не выдуманы здесь.
    expect(d!.taggedM).toBe(382);
    expect(d!.publishedM).toBe(310.8);
    expect(d!.osm).toBe("way/486561786");

    // Главное утверждение: с опубликованной высотой коридор был бы НИЖЕ.
    expect(d!.cruiseAltMIfPublished).not.toBeNull();
    expect(d!.cruiseAltMIfPublished!).toBeLessThan(d!.cruiseAltM);
    expect(d!.cruiseDeltaM!).toBe(d!.cruiseAltM - d!.cruiseAltMIfPublished!);
    // 382 против 310.8 — это ~71 м разницы, то есть минимум две высотные полосы
    // по 25 м. Полоса меньше означала бы, что подстановка не доехала до сетки.
    expect(d!.cruiseDeltaM!).toBeGreaterThanOrEqual(50);
  });

  test("два спорных здания на одном коридоре не сваливаются в один счётчик", () => {
    // Ведущим должно стать то, что подняло больше участков, а второе — попасть
    // в alsoDisputed, а не в его счётчик: «участков 5» рядом с числами одного
    // здания было бы неправдой, и в подписанном документе её не отличить от правды.
    const twin = twinWithTowerOnTheOnlyPath();
    twin.grid.heights[5] = 382;               // башня 194 занимает две ячейки → 3 участка
    twin.buildings[194] = { ...twin.buildings[194], r: [[101, 1], [139, 1], [139, 19], [101, 19]] };
    twin.grid.heights[9] = 200;               // вторая спорная высота → 2 участка
    twin.buildings[100] = { h: 200, hs: 1, r: [[181, 1], [199, 1], [199, 19], [181, 19]] };
    twin.dataQuality.suspect = [
      { i: 194, h: 382, times: 4.66, why: "towers over the city" },
      { i: 100, h: 200, times: 2.4, why: "towers over the city" },
    ];

    const route = __engineForTests.buildRoute("astana", twin, 0, 1, false);
    const d = __engineForTests.heightDisputeFor("astana", twin, route!)!;
    expect(d.building).toBe(194);
    expect(d.segments).toBe(3);
    expect(d.alsoDisputed).toEqual([100]);
    // числа в карточке — по ведущему зданию, а не по сумме
    expect(d.taggedM).toBe(382);
    expect(d.publishedM).toBe(310.8);
  });

  test("молчит там, где коридор спорного здания не касается", () => {
    const twin = twinWithTowerOnTheOnlyPath();
    // тот же твин без пометки «спорная» — предупреждать не о чем
    const clean: CityData = { ...twin, dataQuality: { ...twin.dataQuality, suspect: [] } };
    const route = __engineForTests.buildRoute("astana", clean, 0, 1, false);
    expect(__engineForTests.heightDisputeFor("astana", clean, route!)).toBeNull();
  });

  test("ячейки спорного здания находятся по габариту и его же высоте", () => {
    const cells = __engineForTests.suspectCellsOf(twinWithTowerOnTheOnlyPath());
    expect([...cells.keys()]).toEqual([6]);
    expect(cells.get(6)).toBe(194);
  });
});

describe("живая Астана — предупреждение только по факту", () => {
  /**
   * Замер 12.08.2026: спорная башня (Абу-Даби Плаза, 382 м) не задевает НИ ОДИН
   * из 42 маршрутов между площадками — A* платит за высоту и обходит её, а
   * ячеек у башни всего шесть. Опасение из handoff'а («каждый маршрут над
   * центром Астаны поднимается») замером не подтвердилось.
   *
   * Тест не прибивает ноль гвоздями: появится площадка рядом с башней — маршрут
   * законно станет затронутым. Прибито другое: если предупреждение выдано, оно
   * обязано быть согласованным, а не «просто висеть».
   */
  test("каждое выданное предупреждение сходится с собственными числами", async () => {
    let affected = 0;
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        if (i === j) continue;
        const r = await request(app).post("/api/qskyway/route").send({ from: i, to: j, city: "astana" });
        expect(r.status).toBe(200);
        const d = r.body.heightDispute;
        if (!d) continue;
        affected++;
        expect(d.segments).toBeGreaterThan(0);
        expect(d.cruiseAltM).toBe(r.body.cruiseAltM);
        // разбор вынес «завышено» — коридор по опубликованной высоте не может
        // оказаться выше того, которым мы летим сейчас
        expect(d.cruiseAltMIfPublished).toBeLessThanOrEqual(d.cruiseAltM);
      }
    }
    expect(affected).toBeLessThanOrEqual(42);
  }, 60000);

  test("GET /height-dispute отвечает замером, а не рассуждением", async () => {
    const r = await request(app).get("/api/qskyway/height-dispute?city=astana");
    expect(r.status).toBe(200);
    expect(r.body.available).toBe(true);
    // разобранная башня видна в ответе вместе с обоими числами
    const abu = r.body.disputed.find((d: { building: number }) => d.building === 194);
    expect(abu).toBeTruthy();
    expect(abu.taggedM).toBe(382);
    expect(abu.publishedM).toBe(310.8);
    expect(abu.cells).toBeGreaterThan(0);
    // ответ обязан быть согласован сам с собой: нельзя заявить «влияет на N пар»
    // и тут же не иметь ни одного поднятого участка
    expect(r.body.affectedPairs).toBeLessThanOrEqual(r.body.routable);
    expect(r.body.routable).toBeGreaterThan(0);
    if (r.body.affectedPairs === 0) {
      expect(r.body.maxSegments).toBe(0);
      expect(r.body.note).toContain("ни один");
    } else {
      expect(r.body.maxSegments).toBeGreaterThan(0);
    }
  }, 60000);

  test("город без спорных высот отвечает «нечего мерить», а не пустым успехом", async () => {
    const r = await request(app).get("/api/qskyway/height-dispute?city=tokyo");
    expect(r.status).toBe(200);
    // Токио: плохие теги перекрыты обмером PLATEAU, спорных высот в твине нет
    expect(r.body.available).toBe(false);
    expect(r.body.note).toContain("нет");
  }, 30000);

  test("подписанное обоснование несёт расхождение, а не умалчивает о нём", async () => {
    const j = await request(app).post("/api/qskyway/route/justification").send({ from: 0, to: 3, city: "astana" });
    expect(j.status).toBe(200);
    // Поле присутствует всегда: null означает «проверено, расхождения нет», а
    // отсутствие поля означало бы «не проверяли» — для бумаги это разные вещи.
    expect(j.body.document).toHaveProperty("heightDispute");

    const v = await request(app)
      .post("/api/qskyway/route/justification/verify")
      .send({ document: j.body.document, attestation: j.body.attestation });
    expect(v.body.valid).toBe(true);
  }, 30000);
});

/**
 * Замер 12.08.2026, из-за которого появился второй показатель уверенности:
 * маршруты Астаны отдавали `heightConfidencePct` 78–97%, при том что в твине
 * города ОБМЕРЕНО НОЛЬ зданий (все высоты — вывод из тега/этажей или слепой
 * дефолт 12 м). Причина не в ошибке: показатель считает по всем участкам, а
 * открытая земля идёт как «известно». Но рядом с чипом города «0% обмерено»
 * это два наших же ответа, спорящих между собой, и читается высокая цифра как
 * «с данными всё хорошо».
 */
describe("уверенность по зданиям — отдельно от уверенности по всему коридору", () => {
  test("[astana] коридор не может заявлять обмеренные здания там, где их ноль", async () => {
    let checked = 0;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if (i === j) continue;
        const r = await request(app).post("/api/qskyway/route").send({ from: i, to: j, city: "astana" });
        expect(r.status).toBe(200);
        checked++;
        // участков со зданием под крылом меньше, чем всего участков, и они есть
        expect(r.body.obstacleSegments).toBeGreaterThan(0);
        expect(r.body.obstacleSegments).toBeLessThanOrEqual(r.body.alts.length);
        // в Астане городского обмера нет ни у одного здания
        expect(r.body.measuredObstacleSegments).toBe(0);
        // а общий показатель при этом высокий — ровно то расхождение, ради
        // которого второе число и заведено
        expect(r.body.heightConfidencePct).toBeGreaterThan(50);
      }
    }
    expect(checked).toBe(12);
  }, 60000);

  test("[nyc] город с городским обмером даёт ненулевую цифру по зданиям", async () => {
    const r = await request(app).post("/api/qskyway/route").send({ from: 0, to: 3, city: "nyc" });
    expect(r.status).toBe(200);
    expect(r.body.obstacleSegments).toBeGreaterThan(0);
    expect(r.body.measuredObstacleSegments).toBeGreaterThan(0);
  }, 30000);

  test("подписанное обоснование несёт обе цифры, а не только удобную", async () => {
    const j = await request(app).post("/api/qskyway/route/justification").send({ from: 0, to: 3, city: "astana" });
    expect(j.status).toBe(200);
    expect(j.body.document.heightConfidencePct).toBeGreaterThan(50);
    expect(j.body.document.measuredObstacleSegments).toBe(0);
    expect(j.body.document.obstacleSegments).toBeGreaterThan(0);
  }, 30000);
});
