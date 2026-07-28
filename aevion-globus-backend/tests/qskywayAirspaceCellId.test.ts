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
