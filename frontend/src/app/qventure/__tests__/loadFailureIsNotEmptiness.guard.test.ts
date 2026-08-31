import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Отказ загрузки не выдаётся за отсутствие данных.
 *
 * В разборе QVenture два раздела подтягиваются отдельными запросами:
 * «Recent comparable rounds» и «QVenture benchmark». Замер 31.08.2026: при
 * отказе запроса оба возвращали null, то есть раздел ИСЧЕЗАЛ со страницы.
 *
 * Для венчурного аналитика это не мелочь. Пустое место читается как факт о
 * рынке — «сравнимых сделок в этом секторе не бывает», — и на таком факте
 * принимают решение о сделке. А на самом деле у нас не загрузилось.
 *
 * Что показывает, что это слепое пятно, а не небрежность: у эталона ЕСТЬ
 * честная обработка случая «данных недостаточно» (mode === "insufficient")
 * со своим текстом. Автор различал случаи; пропущен был только отказ.
 */
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, "$1"));
const SRC = fs.readFileSync(path.resolve(HERE, "..", "_result.tsx"), "utf8");
const NL = String.fromCharCode(10);
const BODY = SRC.split(NL).filter((l) => !l.trim().startsWith("//")).join(NL);

describe("отказ загрузки отличим от отсутствия данных", () => {
  it("контроль: файл прочитан и это он", () => {
    expect(SRC.length, "разметка разбора не прочитана").toBeGreaterThan(5000);
    expect(SRC, "читается не тот файл").toContain("Recent comparable rounds");
    expect(SRC, "второй раздел не найден").toContain("QVenture benchmark");
  });

  it("отказ запоминается, а не теряется", () => {
    // Оба раздела грузятся отдельно, значит и помнить отказ должны оба.
    const owners = (BODY.match(/const \[failed, setFailed\]/g) || []).length;
    const marks = (BODY.match(/setFailed\(true\)/g) || []).length;
    expect(owners, "состояние отказа заведено не во всех разделах").toBeGreaterThanOrEqual(2);
    expect(marks, "отказ отмечается не во всех обработчиках").toBe(owners);
  });

  it("при отказе на экране остаётся текст, а не пустота", () => {
    const shown = (BODY.match(/if \(failed\)/g) || []).length;
    expect(
      shown,
      "раздел исчезает при отказе: человек прочитает пустое место как факт о " +
        "рынке, а не как нашу неисправность",
    ).toBeGreaterThanOrEqual(2);
    expect(BODY, "нет честного текста про неудачу загрузки").toMatch(/Could not load/i);
  });

  it("текст отказа не выдаёт себя за вердикт", () => {
    // «не загрузилось» не должно читаться как «данных нет» — иначе мы просто
    // переписали ту же ложь словами.
    expect(BODY).toMatch(/does not mean there are none|not a verdict/i);
  });
});
