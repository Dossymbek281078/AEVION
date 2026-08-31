import { describe, test, expect } from "vitest";

import { __engineForTests } from "../src/routes/qskyway";
import type { CityData } from "../src/routes/qskyway.city";

/**
 * Страховочный запас за неуверенность бывает СЪЕДЕН полом коридора.
 *
 * Замер 27.08.2026 по живому твину Астаны: из 237 зданий с угаданной высотой
 * 199 сидят на слепом дефолте 12 м, и для них 12 + 15 запаса + 16 штрафа = 43,
 * что меньше пола в 50 м. Ступеней вверх ноль — коридор ложится ровно туда же,
 * куда лёг бы без всякого штрафа. Снаружи это неотличимо от работающей защиты:
 * /health перечисляет confidence-clearance, а byHeightSourceM показывает 16
 * метров, которые в эти участки не идут.
 *
 * Поле `blindHeight` — единственное место, где это видно. Здесь проверяются обе
 * стороны, потому что односторонний сторож не отличить от сломанного:
 *
 *  1) он СЧИТАЕТ участок, где высота угадана низко и штраф не сработал;
 *  2) он МОЛЧИТ, когда угаданное здание достаточно высокое, чтобы штраф
 *     действительно поднял коридор.
 */

function twin(height: number, hs: number): CityData {
  const cols = 12, rows = 1, cell = 20;
  const heights = new Array(cols * rows).fill(0);
  const src = new Array(cols * rows).fill(0);
  heights[6] = height;
  src[6] = hs;
  const buildings: CityData["buildings"] = [
    { h: height, hs, r: [[121, 1], [139, 1], [139, 19], [121, 19]] },
  ];
  return {
    city: "тестовый твин",
    bbox: { minLat: 51.1, maxLat: 51.11, minLon: 71.4, maxLon: 71.41 },
    meters: { w: cols * cell, h: rows * cell },
    grid: { cols, rows, cell, heights, src },
    buildings,
    vertiports: [{ c: 0, r: 0, x: 10, y: 10 }, { c: 11, r: 0, x: 230, y: 10 }],
    dataQuality: {
      total: 1, measured: 0, derived: 0, guessed: 1, measuredPct: 0, realPct: 0,
      source: "test", note: "test",
    },
  };
}

describe("слепая высота: видно, когда страховочный запас ничего не дал", () => {
  test("угаданные 12 м — штраф съеден полом, участок посчитан", () => {
    const route = __engineForTests.buildRoute("astana", twin(12, 2), 0, 1, false);
    expect(route).not.toBeNull();
    const b = route!.blindHeight;

    expect(b.guessedSegments).toBeGreaterThan(0);
    // Ровно тот случай, ради которого поле заведено.
    expect(b.inertPenaltySegments).toBeGreaterThan(0);

    // Высота коридора над этим зданием — пол, а не пол плюс штраф.
    const overBuilding = Math.min(...route!.alts);
    expect(overBuilding).toBe(50);

    // Заявленный просвет держится только до (пол − запас).
    // ⚠️ Это ПИН на обещанное число, а НЕ проверка поведения. Поле равно
    // `FLOOR - CLEAR` всегда и другого значения принять не может, поэтому
    // утверждение зелено и на сломанном коде (проверено мутацией 28.08:
    // замена вычисления на константу набор не роняет).
    //
    // Смысл пина в другом: изменят пол коридора или запас — тест покраснеет и
    // заставит подумать, а не молча поменяет обещание пользователю.
    //
    // И отдельно, чтобы не считать это поле точным: штраф бывает инертным и
    // при ПОДНЯТОМ коридоре. При здании 61 м обе ступени равны 2, коридор
    // стоит на 100 м, настоящая гарантия там 85 — а поле скажет 35. Занижение
    // безопасно по направлению, но числом оно неверно.
    expect(b.clearedUpToM).toBe(35);
    expect(b.note).toContain("35");
    // Английская пара обязана нести ТО ЖЕ число и не быть копией русской.
    // Первая версия поля была только русской: модуль держит соглашение
    // note/noteEn в семи местах, и я нарушил его через несколько часов после
    // того, как сам записал «защищает та версия, которую читатель понимает».
    expect(b.noteEn).toContain("35");
    // Русское числительное СКЛОНЯЕТСЯ, а не прикрывается скобками. Правило
    // записано в самом модуле: цифра, которую он честно считает, а потом рисует
    // как «1 площадок», обесценивает всю аккуратность расчёта. Первая версия
    // этого поля писала «участк(ах)» — я нарушил своё же правило через час.
    expect(b.note).not.toContain("участк(ах)");
    expect(b.note.includes("участке") || b.note.includes("участках")).toBe(true);
    expect(b.noteEn).not.toBe(b.note);
    // Проверяем ЯЗЫК, а не просто «строка не пуста»: копия русского текста в
    // поле с именем En прошла бы оба утверждения выше.
    expect(/[а-яё]/i.test(b.noteEn)).toBe(false);
    expect(b.noteEn.toLowerCase()).toContain("clearance");
  });

  test("угаданные 59 м — штраф реально поднимает коридор, участок НЕ считается", () => {
    const route = __engineForTests.buildRoute("astana", twin(59, 2), 0, 1, false);
    expect(route).not.toBeNull();
    const b = route!.blindHeight;

    expect(b.guessedSegments).toBeGreaterThan(0);
    expect(b.inertPenaltySegments).toBe(0);

    // 59 + 15 + 16 = 90 против 59 + 15 = 74: штраф добавляет ступень.
    expect(route!.cruiseAltM).toBeGreaterThan(75);
  });

  test("обмеренная высота в счётчик угаданных не попадает", () => {
    const route = __engineForTests.buildRoute("astana", twin(12, 0), 0, 1, false);
    expect(route).not.toBeNull();
    expect(route!.blindHeight.guessedSegments).toBe(0);
    expect(route!.blindHeight.inertPenaltySegments).toBe(0);
    expect(route!.blindHeight.note).toContain("настоящий страховочный запас");
  });
});

/**
 * Разбавка открытой землёй: то же число, посчитанное по всем участкам, врёт.
 *
 * Замер 27.08.2026 на живом маршруте Астаны 0→3: avgConfClearM = 0.7 при
 * страховочном запасе 16 м на каждом из 4 участков со зданием — делится на все
 * 97 участков, 93 из которых открытая земля. Плитка «Запас на неувер-ть 0.7 м»
 * читается как «мы почти ничего не добавляем», хотя там, где запас нужен, он в
 * двадцать с лишним раз больше показанного.
 *
 * Ровно эту разбавку уже чинили 12.08 для heightConfidencePct; в соседнем поле
 * она осталась.
 */
function twinOneBuildingOnOpenGround(): CityData {
  const cols = 40, rows = 1, cell = 20;
  const heights = new Array(cols * rows).fill(0);
  const src = new Array(cols * rows).fill(0);
  heights[20] = 12; // единственное здание, высота УГАДАНА
  src[20] = 2;
  return {
    city: "тестовый твин",
    bbox: { minLat: 51.1, maxLat: 51.11, minLon: 71.4, maxLon: 71.41 },
    meters: { w: cols * cell, h: rows * cell },
    grid: { cols, rows, cell, heights, src },
    buildings: [{ h: 12, hs: 2, r: [[401, 1], [419, 1], [419, 19], [401, 19]] }],
    vertiports: [{ c: 0, r: 0, x: 10, y: 10 }, { c: 39, r: 0, x: 790, y: 10 }],
    dataQuality: {
      total: 1, measured: 0, derived: 0, guessed: 1, measuredPct: 0, realPct: 0,
      source: "test", note: "test",
    },
  };
}

describe("страховочный запас: среднее по всем участкам топит настоящее число", () => {
  test("по зданиям запас настоящий, по всему маршруту — размыт открытой землёй", () => {
    const route = __engineForTests.buildRoute("astana", twinOneBuildingOnOpenGround(), 0, 1, false);
    expect(route).not.toBeNull();

    // Здание ровно одно, и оно с угаданной высотой: запас на нём — полные 16 м.
    expect(route!.obstacleSegments).toBeGreaterThan(0);
    expect(route!.confClearOnObstaclesM).toBe(16);

    // А среднее по всему коридору — в разы меньше, потому что делится на
    // десятки участков открытой земли. Это и есть разбавка.
    expect(route!.avgConfClearM).toBeLessThan(4);
    expect(route!.confClearOnObstaclesM!).toBeGreaterThan(route!.avgConfClearM * 4);
  });

  test("здания под крылом не было ни разу — числу неоткуда взяться, отдаём null", () => {
    const cols = 10, rows = 1, cell = 20;
    const empty: CityData = {
      city: "пустой твин",
      bbox: { minLat: 51.1, maxLat: 51.11, minLon: 71.4, maxLon: 71.41 },
      meters: { w: cols * cell, h: rows * cell },
      grid: { cols, rows, cell, heights: new Array(cols).fill(0), src: new Array(cols).fill(0) },
      buildings: [],
      vertiports: [{ c: 0, r: 0, x: 10, y: 10 }, { c: 9, r: 0, x: 190, y: 10 }],
      dataQuality: { total: 0, measured: 0, derived: 0, guessed: 0, measuredPct: 0, realPct: 0, source: "test", note: "test" },
    };
    const route = __engineForTests.buildRoute("astana", empty, 0, 1, false);
    expect(route).not.toBeNull();
    expect(route!.obstacleSegments).toBe(0);
    // Именно null, а не 0: ноль читался бы как «запас нулевой», хотя его просто
    // не над чем считать.
    expect(route!.confClearOnObstaclesM).toBeNull();
  });
});
