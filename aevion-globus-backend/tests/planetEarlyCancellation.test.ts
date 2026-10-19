/*
 * 🔴 19.10.2026 22:4x–22:5x, слово основателя: срочный план списывается помесячно
 * при обязательстве; вперёд — скидка 5/7,5/10/12,5 %; досрочная отмена — прожитые
 * дни по самой длинной пройденной ступени. Контрольные числа — из его слов
 * (00-НАЧНИ-ОТСЮДА/2026-10-19-ЦЕНЫ-помесячно-при-обязательстве-ЧЕРНОВИК.md):
 * год вперёд 1575, 200 дн → наше 1333.33, возврат 241.67;
 * год помесячно, 120 дн, оплачено 600 → доплата 300.
 */
import { describe, test, expect } from "vitest";
import {
  TERM_TIERS, PLANET_PREPAY_DISCOUNT_PERCENT, planetPrepayTotal, planetPaymentsCount,
  planetEarlyCancellation, planetLadderTierForDays, planetTermDays, DAYS_PER_YEAR,
} from "../src/data/pricing";

describe("оплата вперёд: скидка к сумме помесячных платежей", () => {
  test("641.25 / 1110 / 1417.50 / 1575 — числа основателя; без срока скидки нет", () => {
    expect(TERM_TIERS.map((t) => PLANET_PREPAY_DISCOUNT_PERCENT[t])).toEqual([0, 5, 7.5, 10, 12.5]);
    expect(TERM_TIERS.map((t) => planetPrepayTotal(t))).toEqual([250, 641.25, 1110, 1417.5, 1575]);
    expect(TERM_TIERS.map((t) => planetPaymentsCount(t))).toEqual([1, 3, 6, 9, 12]);
  });
  test("срок в днях: месяц 30, год 365", () => {
    expect(TERM_TIERS.map((t) => planetTermDays(t))).toEqual([30, 90, 180, 270, DAYS_PER_YEAR]);
    expect(DAYS_PER_YEAR).toBe(365);
  });
});

describe("досрочная отмена: по самой длинной пройденной ступени", () => {
  test("КОНТРОЛЬ основателя: год вперёд 1575, 200 дней → наше 1333.33, возврат 241.67, доплаты нет", () => {
    const r = planetEarlyCancellation({ term: "max", billing: "prepaid", daysUsed: 200, paidUsd: 1575 });
    expect(r).toEqual({ ladderTier: "pro", rateUsdPerMonth: 200, ourUsd: 1333.33, refundUsd: 241.67, surchargeUsd: 0, finished: false });
  });
  test("КОНТРОЛЬ основателя: год помесячно, 120 дней, оплачено 600 → наше 900, доплата 300", () => {
    const r = planetEarlyCancellation({ term: "max", billing: "monthly", daysUsed: 120, paidUsd: 600 });
    expect(r).toEqual({ ladderTier: "medium", rateUsdPerMonth: 225, ourUsd: 900, refundUsd: 0, surchargeUsd: 300, finished: false });
  });
  test("у оплаты вперёд доплаты не бывает, даже когда прожитые дни дороже оплаченного", () => {
    // 3 мес вперёд 641.25, прожито 60 дн по $250 → 500: возврат 141.25
    expect(planetEarlyCancellation({ term: "medium", billing: "prepaid", daysUsed: 60, paidUsd: 641.25 })).toMatchObject({ ourUsd: 500, refundUsd: 141.25, surchargeUsd: 0 });
    // те же 60 дн помесячно, оплачено 2 × 225 = 450 → доплата 50
    expect(planetEarlyCancellation({ term: "medium", billing: "monthly", daysUsed: 60, paidUsd: 450 })).toMatchObject({ ourUsd: 500, refundUsd: 0, surchargeUsd: 50 });
  });
  test("границы ступеней: 89-й день — $250, 90-й — $225, 180-й — $200, 270-й — $175", () => {
    expect([0, 89, 90, 179, 180, 269, 270, 364].map((d) => planetLadderTierForDays(d))).toEqual(["lite", "lite", "medium", "medium", "pro", "pro", "full", "full"]);
    expect(planetEarlyCancellation({ term: "max", billing: "monthly", daysUsed: 89, paidUsd: 450 }).rateUsdPerMonth).toBe(250);
    expect(planetEarlyCancellation({ term: "max", billing: "monthly", daysUsed: 90, paidUsd: 450 }).rateUsdPerMonth).toBe(225);
  });
  test("дослужил срок — цена плана, ни возврата, ни доплаты; без срока пересчёта нет", () => {
    expect(planetEarlyCancellation({ term: "max", billing: "monthly", daysUsed: 365, paidUsd: 1800 })).toEqual({ ladderTier: "max", rateUsdPerMonth: 150, ourUsd: 1800, refundUsd: 0, surchargeUsd: 0, finished: true });
    expect(planetEarlyCancellation({ term: "medium", billing: "prepaid", daysUsed: 90, paidUsd: 641.25 })).toMatchObject({ finished: true, refundUsd: 0, surchargeUsd: 0 });
    expect(planetEarlyCancellation({ term: "lite", billing: "monthly", daysUsed: 10, paidUsd: 250 })).toMatchObject({ finished: true, ourUsd: 250, refundUsd: 0, surchargeUsd: 0 });
  });
  test("враждебный вход: отрицательные дни и сумма не дают отрицательных денег", () => {
    const r = planetEarlyCancellation({ term: "max", billing: "monthly", daysUsed: -5, paidUsd: -100 });
    expect(r).toMatchObject({ ourUsd: 0, refundUsd: 0, surchargeUsd: 0, finished: false });
  });
});
