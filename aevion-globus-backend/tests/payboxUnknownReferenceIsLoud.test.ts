import { describe, test, expect, vi, afterEach } from "vitest";
import { tierForReference } from "../src/routes/payboxWebhook";

/**
 * Сторож: незнакомая ссылка заказа не имеет права выдавать тариф МОЛЧА.
 *
 * Тариф здесь выводится только из строки заказа — сверки суммы в
 * обработчике нет вовсе. Незнакомая ссылка даёт `lite`, то есть самый
 * дешёвый тариф за любые деньги, и раньше это происходило без следа.
 *
 * Поведение намеренно НЕ меняется: тест закрепляет не выбор тарифа, а то,
 * что выбор по умолчанию ВИДЕН. Проверять надо пару — на известной ссылке
 * шума быть не должно, иначе предупреждение утонет в собственном фоне.
 */
describe("незнакомая ссылка заказа PayBox видна", () => {
  afterEach(() => vi.restoreAllMocks());

  test("незнакомая ссылка предупреждает и всё равно даёт lite", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(tierForReference("совершенно-другой-формат-42")).toBe("lite");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("совершенно-другой-формат-42");
  });

  test("известные ссылки НЕ шумят", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(tierForReference("aevion-lite-monthly")).toBe("lite");
    expect(tierForReference("aevion-medium-annual")).toBe("medium");
    expect(tierForReference("aevion-business-annual")).toBe("full");
    expect(warn).not.toHaveBeenCalled();
  });
});
