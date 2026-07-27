import { describe, it, expect } from "vitest";
import { parseStringArray } from "../src/routes/i18n";

/**
 * Перевод UI-строк теперь идёт сначала бесплатным флотом и только потом платным
 * Haiku. Единственное, что удерживает качество на этом пути, — вот эта проверка:
 * ответ должен разобраться в массив РОВНО той же длины, что и вход. Потерянная
 * строка означает, что ключи и тексты на экране разъедутся, а лишняя болтовня
 * модели — что в интерфейс попадёт «Sure, here is the translation».
 *
 * Пока проверка работает, бесплатная модель участвует, только если справилась.
 */
describe("parseStringArray — фильтр качества перевода", () => {
  it("честный ответ разбирается", () => {
    expect(parseStringArray('["Home","Pricing"]', 2)).toEqual(["Home", "Pricing"]);
  });

  it("массив внутри болтовни всё равно достаётся", () => {
    expect(parseStringArray('Sure! Here you go:\n["Главная","Цены"]\nHope that helps', 2))
      .toEqual(["Главная", "Цены"]);
  });

  it("потерянная строка отклоняется — иначе тексты разъедутся с ключами", () => {
    expect(parseStringArray('["Home"]', 2)).toBeNull();
  });

  it("лишняя строка тоже отклоняется", () => {
    expect(parseStringArray('["Home","Pricing","Extra"]', 2)).toBeNull();
  });

  it("проза без массива отклоняется, а не попадает на экран", () => {
    expect(parseStringArray("Я перевёл ваши строки: Главная, Цены", 2)).toBeNull();
    expect(parseStringArray("", 1)).toBeNull();
  });

  it("не-строки приводятся к строкам, а не роняют перевод", () => {
    expect(parseStringArray("[1, true, null]", 3)).toEqual(["1", "true", "null"]);
  });

  it("объект вместо массива — отказ", () => {
    expect(parseStringArray('{"0":"Home","1":"Pricing"}', 2)).toBeNull();
  });
});
