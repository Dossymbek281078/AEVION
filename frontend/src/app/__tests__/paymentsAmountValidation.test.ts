import { describe, expect, it } from "vitest";
import { MAX_AMOUNT_MINOR, parseAmountMinor } from "../api/payments/v1/_lib";

/**
 * Публичный финтех-API AEVION принимал сумму по проверке
 * `typeof amount === "number" && amount > 0`. Этого мало, и не в теории:
 * `JSON.parse('{"amount":1e400}')` возвращает **Infinity** — тело без единого
 * нечислового символа проходило проверку и создавало ссылку на оплату с
 * бесконечной суммой. Дальше возврат «в пределах остатка» разрешал любую сумму,
 * потому что остаток тоже был бесконечным.
 *
 * Проверка на реальном разборе JSON, а не на заранее собранных числах:
 * иначе тест доказывал бы только то, что функция умеет сравнивать.
 */
describe("сумма в минорных единицах: только целое, положительное, конечное", () => {
  const amountFromJson = (raw: string) => parseAmountMinor(JSON.parse(raw).amount);

  it("нормальная сумма проходит", () => {
    expect(amountFromJson('{"amount":4900}')).toBe(4900);
  });

  it("переполнение в JSON превращается в Infinity и отбивается", () => {
    expect(JSON.parse('{"amount":1e400}').amount).toBe(Infinity); // контроль предпосылки
    expect(amountFromJson('{"amount":1e400}')).toBe(
      "amount must be a finite number (minor units).",
    );
  });

  it("дробные минорные единицы отбиваются", () => {
    expect(amountFromJson('{"amount":0.5}')).toBe(
      "amount must be a whole number of minor units (no fractions).",
    );
  });

  it("ноль и отрицательное отбиваются", () => {
    expect(typeof amountFromJson('{"amount":0}')).toBe("string");
    expect(typeof amountFromJson('{"amount":-100}')).toBe("string");
  });

  it("выше верхней границы отбивается, ровно граница проходит", () => {
    expect(parseAmountMinor(MAX_AMOUNT_MINOR)).toBe(MAX_AMOUNT_MINOR);
    expect(typeof parseAmountMinor(MAX_AMOUNT_MINOR + 1)).toBe("string");
  });

  it("строка, null и отсутствие поля отбиваются", () => {
    expect(typeof amountFromJson('{"amount":"4900"}')).toBe("string");
    expect(typeof amountFromJson('{"amount":null}')).toBe("string");
    expect(typeof amountFromJson("{}")).toBe("string");
  });
});
