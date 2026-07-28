import { describe, it, expect } from "vitest";
import { stableCellId } from "../scripts/lib/airspace-cell-id.mjs";

// Ключ ячейки задаёт, когда сторож считает слой изменившимся. Пока он брался из
// OBJECTID — номера строки в базе публикатора — сторож кричал «дрейф» на каждой
// перепубликации FAA при неизменных потолках. К такому сторожу привыкают, и
// настоящее изменение воздушного пространства проходит мимо.

describe("stableCellId — ключ описывает ячейку, а не строку в чужой базе", () => {
  const cell = { minLat: 40.75, minLon: -74.0, airportIcao: "KJFK" };

  it("не меняется, когда публикатор пересобрал слой", () => {
    // Тот же участок неба, другая выгрузка: сместился седьмой знак геометрии и
    // сменился OBJECTID. Ключ обязан остаться прежним, иначе тревога ложная.
    const republished = { minLat: 40.7500002, minLon: -73.9999998, airportIcao: "KJFK" };
    expect(stableCellId(republished)).toBe(stableCellId(cell));
  });

  it("различает соседние ячейки", () => {
    // Ячейки UASFM — километры, поэтому 4 знака (~11 м) их не сливают.
    expect(stableCellId({ ...cell, minLat: 40.76 })).not.toBe(stableCellId(cell));
    expect(stableCellId({ ...cell, minLon: -73.99 })).not.toBe(stableCellId(cell));
  });

  it("читается человеком: аэропорт и юго-западный угол", () => {
    expect(stableCellId(cell)).toBe("faa-KJFK-40.7500_-74.0000");
  });

  it("обходится без аэропорта, а не подставляет «unknown»", () => {
    // Притворяться, что мы знаем ICAO, нельзя — часть ключа просто отсутствует.
    expect(stableCellId({ minLat: 40.75, minLon: -74.0, airportIcao: null }))
      .toBe("faa-40.7500_-74.0000");
  });

  it("приводит ICAO к верхнему регистру и обрезает пробелы", () => {
    expect(stableCellId({ ...cell, airportIcao: " kjfk " })).toBe(stableCellId(cell));
  });

  it("не рождает «-0.0000» у Гринвича", () => {
    // Настоящий случай — не литерал -0 (его `toFixed` и так печатает «0.0000»),
    // а долгота чуть западнее нуля: -0.00001 округляется в «-0.0000», и ячейка
    // получила бы ключ, отличный от такой же ячейки чуть восточнее. Первая
    // версия теста брала именно -0 и мутацию не ловила — проверяла вход, на
    // котором нормализация не работает вовсе.
    expect(stableCellId({ minLat: 0, minLon: -0.00001, airportIcao: null }))
      .toBe(stableCellId({ minLat: 0, minLon: 0.00001, airportIcao: null }));
    // Проверять `.not.toContain("-0.0000")` НЕЛЬЗЯ: дефис приходит из префикса
    // `faa-`, и ассерт падал бы на правильном ключе `faa-0.0000_0.0000`.
    // Равенства двух ключей достаточно — без нормализации они расходятся.
  });

  it("не падает на мусоре, а отдаёт различимый ключ", () => {
    expect(stableCellId({ minLat: NaN, minLon: 5, airportIcao: null })).toContain("nan");
    expect(stableCellId(undefined as unknown as { minLat: number })).toContain("nan");
  });
});

// Две копии функции существуют вынужденно: ингест живёт в scripts/ (вне области
// сборки бэкенда), сторож свежести — в src/. Обычно такую развилку сторожит
// комментарий «держите одинаковыми». Здесь вместо комментария — тест: пока
// копии расходятся МОЛЧА, сторож и ингест говорят на разных языках ключей, и
// расхождение станет стопроцентным при неизменных потолках.
import { stableCellId as serverStableCellId } from "../src/lib/airspaceCellId";

describe("серверная и скриптовая копии ключа обязаны совпадать", () => {
  const cases = [
    { minLat: 40.75, minLon: -74.0, airportIcao: "KJFK" },
    { minLat: 40.7500002, minLon: -73.9999998, airportIcao: " kjfk " },
    { minLat: 0, minLon: -0.00001, airportIcao: null },
    { minLat: -33.8688, minLon: 151.2093, airportIcao: "YSSY" },
    { minLat: 51.4775, minLon: -0.4614, airportIcao: null },
  ];

  it.each(cases)("совпадают на $minLat / $minLon", (c) => {
    expect(serverStableCellId(c)).toBe(stableCellId(c));
  });

  it("совпадают и на мусоре — иначе разойдутся именно там, где никто не смотрит", () => {
    expect(serverStableCellId({ minLat: NaN, minLon: 5 })).toBe(stableCellId({ minLat: NaN, minLon: 5 }));
  });
});

// Отгруженный слой всё ещё несёт СТАРЫЕ id вида `faa-<OBJECTID>`: пересобрать его
// нельзя дёшево — `id` входит в подписываемое содержимое, и пересборка потребовала
// бы переякорения в Bitcoin. Но геометрия у отгруженной ячейки лежит тут же, в её
// собственных minLat/minLon, поэтому сверка выводит ключ из геометрии с ОБЕИХ
// сторон и работает уже сейчас, не трогая подпись.
import { compareSnapshot } from "../src/routes/qskyway.airspace.freshness";

describe("сверка не зависит от того, какой id записан в отгруженном слое", () => {
  const cell = { id: "faa-118", minLat: 40.75, minLon: -73.9917, airportIcao: "KLGA", ceilingFt: 200 };
  const live = [{ id: stableCellId(cell), ceilingFt: 200, effective: "2026-07-09" }];

  it("старый OBJECTID-ключ в слое не считается расхождением", () => {
    const r = compareSnapshot({ cells: [cell] } as never, live);
    expect({ a: r.cellsAdded, d: r.cellsRemoved, c: r.cellsChanged }).toEqual({ a: 0, d: 0, c: 0 });
    expect(r.upToDate).toBe(true);
  });

  it("а настоящее изменение потолка по-прежнему видно", () => {
    const r = compareSnapshot({ cells: [cell] } as never, [{ ...live[0], ceilingFt: 400 }]);
    expect(r.cellsChanged).toBe(1);
  });

  it("и настоящая новая ячейка тоже", () => {
    const r = compareSnapshot({ cells: [cell] } as never,
      [...live, { id: stableCellId({ ...cell, minLat: 41 }), ceilingFt: 100, effective: null }]);
    expect(r.cellsAdded).toBe(1);
  });
});
