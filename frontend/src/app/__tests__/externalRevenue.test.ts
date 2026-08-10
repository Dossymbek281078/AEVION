import { describe, expect, it } from "vitest";
import { externalRevenueAt } from "../revenue/externalRevenue";

/**
 * Все числа здесь — реальные строки из прод-таблицы RevenueSnapshot за
 * 27.07.2026, а не выдуманные примеры. Тест на придуманных входах проверил бы
 * только саму функцию; эти входы проверяют её на том, что действительно
 * пришло с сервера в день, когда график показал минус.
 */
describe("выручка снаружи на точке графика", () => {
  it("вычитает свои покупки у снимка, который их включает", () => {
    // Снимок 27.07 06:05Z — снят до правки, гросс завышен на $158.99.
    expect(externalRevenueAt({ grossUsd: 178.97, includesInternal: true, internalUsd: 158.99 })).toBeCloseTo(19.98, 2);
  });

  it("НЕ вычитает у снимка, чей гросс уже очищен", () => {
    // Снимок 27.07 08:09Z. Именно здесь безусловное вычитание дало −$139.01.
    expect(externalRevenueAt({ grossUsd: 19.98, includesInternal: false, internalUsd: 158.99 })).toBeCloseTo(19.98, 2);
  });

  it("не уходит в минус ни на одной точке реальной истории", () => {
    const series = [
      { grossUsd: 29.97, includesInternal: true, internalUsd: 9.99 }, // 13.07
      { grossUsd: 178.97, includesInternal: true, internalUsd: 158.99 }, // 21.07
      { grossUsd: 178.97, includesInternal: true, internalUsd: 158.99 }, // 27.07 06:05
      { grossUsd: 19.98, includesInternal: false, internalUsd: 158.99 }, // 27.07 08:09
    ];
    const values = series.map(externalRevenueAt);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    // Внешних денег все эти дни было ровно $19.98 — линия обязана быть ровной.
    expect(values.every((v) => Math.abs(v - 19.98) < 0.011)).toBe(true);
  });

  it("не падает, когда сумма своих покупок ещё не досчитана", () => {
    expect(externalRevenueAt({ grossUsd: 178.97, includesInternal: true })).toBeCloseTo(178.97, 2);
    expect(externalRevenueAt({ grossUsd: 178.97, includesInternal: true, internalUsd: null })).toBeCloseTo(178.97, 2);
  });

  it("трактует отсутствующий признак как «гросс уже чистый»", () => {
    // Точка без флага приходит только от старого API; вычесть вслепую хуже,
    // чем показать завышенное число — минус на графике читается как убыток.
    expect(externalRevenueAt({ grossUsd: 19.98, internalUsd: 158.99 })).toBeCloseTo(19.98, 2);
  });
});
