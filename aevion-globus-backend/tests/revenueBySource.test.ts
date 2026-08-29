import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { aggregateRecentSales } from "../src/routes/revenue";

// Свод последних продаж по источнику трафика. Issue #1039: выручка перестала
// считать наши тестовые покупки, а этот свод продолжал — два разреза по одним
// и тем же данным жили по разным правилам.
//
// Цена ошибки здесь выше, чем кажется: внешних продаж пока ноль, поэтому одна
// проверочная покупка своего же товара дала бы каналу 100% приписанной выручки.

const INTERNAL = "internal-tester@aevion.test";

beforeEach(() => {
  process.env.REVENUE_INTERNAL_EMAILS = INTERNAL;
});
afterEach(() => {
  delete process.env.REVENUE_INTERNAL_EMAILS;
});

const row = (over: Partial<Parameters<typeof aggregateRecentSales>[0][number]> = {}) => ({
  appId: "book",
  email: "buyer@example.com",
  amountUsd: 19,
  refunded: false,
  channel: "facebook",
  ...over,
});

describe("свод по источникам не считает наши покупки", () => {
  test("внутренняя покупка с меткой не создаёт источник", () => {
    const { bySource } = aggregateRecentSales([row({ email: INTERNAL })]);
    expect(bySource.facebook).toBeUndefined();
  });

  test("внешняя покупка с той же меткой считается", () => {
    const { bySource } = aggregateRecentSales([row()]);
    expect(bySource.facebook).toEqual({ count: 1, totalUsd: 19 });
  });

  test("внутренняя не попадает и в разрез по приложению", () => {
    const { byApp } = aggregateRecentSales([row({ email: INTERNAL })]);
    expect(byApp.book).toBeUndefined();
  });

  test("возврат по-прежнему исключается", () => {
    const { bySource } = aggregateRecentSales([row({ refunded: true })]);
    expect(bySource.facebook).toBeUndefined();
  });

  test("продажа без метки собирается в unattributed, а не теряется", () => {
    const { bySource } = aggregateRecentSales([row({ channel: null })]);
    expect(bySource.unattributed).toEqual({ count: 1, totalUsd: 19 });
  });

  test("смешанный набор: считается только внешнее", () => {
    const { bySource, byApp } = aggregateRecentSales([
      row({ email: INTERNAL, amountUsd: 100 }),
      row({ amountUsd: 19 }),
      row({ amountUsd: 9, channel: "instagram" }),
      row({ refunded: true, amountUsd: 50 }),
    ]);
    expect(bySource.facebook).toEqual({ count: 1, totalUsd: 19 });
    expect(bySource.instagram).toEqual({ count: 1, totalUsd: 9 });
    expect(byApp.book.totalUsd).toBe(28);
  });

  test("инвариант: сумма по источникам равна сумме по приложениям", () => {
    // Оба разреза считают одни и те же строки — расхождение между ними и есть
    // симптом, который в #1039 никто не заметил.
    const rows = [
      row({ email: INTERNAL, amountUsd: 100 }),
      row({ amountUsd: 19 }),
      row({ amountUsd: 9, channel: null, appId: "protocol" }),
    ];
    const { bySource, byApp } = aggregateRecentSales(rows);
    const sum = (r: Record<string, { totalUsd: number }>) =>
      Object.values(r).reduce((a, b) => a + b.totalUsd, 0);
    expect(sum(bySource)).toBe(sum(byApp));
    expect(sum(bySource)).toBe(28);
  });
});
