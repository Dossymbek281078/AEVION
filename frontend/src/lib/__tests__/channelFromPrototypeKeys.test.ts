/**
 * Служебное слово в метке канала не становится каналом.
 *
 * `?c=<метка>` разбирается прямой индексацией словаря каналов, а `?? null`
 * отсеивает только null и undefined. Унаследованное значение проходит: замер
 * 02.09.2026 показал, что `channelFrom("constructor")` возвращал ФУНКЦИЮ.
 *
 * Дальше она уезжала как «канал» по двум путям, и оба тихие:
 *   - в meta события учёта, где JSON.stringify молча выбрасывает функции —
 *     канал исчезал совсем, и покупка становилась «прямой»;
 *   - в withChannel(), то есть в адрес кассы строкой
 *     «function Object() { [native code] }».
 *
 * Достаточно было зайти по ссылке с `?c=constructor`. Ни падения, ни ошибки.
 *
 * Тот же класс платформа уже ловила у ссылок Gumroad и вариантов LemonSqueezy —
 * там стоят такие же сторожа. Этот закрывает третью дверь.
 */
import { describe, it, expect } from "vitest";
import { channelFrom, withChannel } from "../products";

const СЛУЖЕБНЫЕ = ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty", "prototype"];

describe("метка канала", () => {
  it.each(СЛУЖЕБНЫЕ)("«%s» каналом не считается", (k) => {
    const r = channelFrom(k);
    expect(typeof r, `${k} вернул ${typeof r}`).not.toBe("function");
    expect(r, `${k} принят за канал`).toBeNull();
  });

  it("настоящая метка по-прежнему работает", () => {
    // Контроль: без него «всегда null» выглядело бы как починка.
    expect(channelFrom("tg")).toBe("telegram");
  });

  it("в адрес кассы служебное слово не попадает", () => {
    /*
     * Проверяем СЛЕДСТВИЕ, а не только разбор: адрес — то, что реально уедет
     * к продавцу и вернётся в запись подписки.
     */
    const адрес = withChannel("https://example.test/checkout", channelFrom("constructor"), "pricing");
    expect(адрес, "в адрес кассы уехала функция").not.toContain("native code");
    expect(адрес, "в адрес кассы уехало служебное слово").not.toContain("constructor");
  });

  it("настоящая метка в адрес кассы попадает", () => {
    const адрес = withChannel("https://example.test/checkout", channelFrom("tg"), "pricing");
    expect(адрес, "канал не доехал до адреса кассы").toContain("telegram");
  });
});
