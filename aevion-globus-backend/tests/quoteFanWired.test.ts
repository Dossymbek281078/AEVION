import { describe, test, expect } from "vitest";
import { buildQuote, MODULES_PRICING } from "../src/data/pricing";
import { MAX_TOTAL_DISCOUNT_RATIO } from "../src/data/discounts";

/**
 * Веер скидок обязан участвовать в РАСЧЁТЕ, а не лежать рядом готовым к
 * употреблению. Отдельно посчитанная скидка, которую не вычитают из счёта, —
 * это ровно тот класс, что я весь день закрывал: механизм есть, потребителя
 * нет, и снаружи всё выглядит исправным.
 */

/** Восемь самых дешёвых платных модулей — чтобы наверняка попасть на верхнюю ступень. */
function eightPaidModules(): string[] {
  return MODULES_PRICING
    .filter((m) => typeof m.addonMonthly === "number" && (m.addonMonthly ?? 0) > 0)
    .sort((a, b) => (a.addonMonthly ?? 0) - (b.addonMonthly ?? 0))
    .slice(0, 8)
    .map((m) => m.id);
}

describe("веер подключён к расчёту счёта", () => {
  test("восемь модулей поштучно дают ступень, и она видна отдельной строкой", () => {
    const q = buildQuote({ tierId: "free", modules: eightPaidModules() });

    const fan = q.fans.find((f) => f.id === "modules_volume");
    expect(fan, "ступень за объём модулей не сработала").toBeTruthy();
    expect(fan!.percent).toBe(0.20);
    expect(fan!.label).toContain("модул");
  });

  test("скидка ВЫЧИТАЕТСЯ из итога, а не только показывается", () => {
    const modules = eightPaidModules();
    const withFan = buildQuote({ tierId: "free", modules });
    const oneModule = buildQuote({ tierId: "free", modules: modules.slice(0, 1) });

    // Итог с восемью модулями обязан быть меньше суммы строк на размер веера.
    const fanUsd = withFan.fans.reduce((s, f) => s + f.amountUsd, 0);
    expect(fanUsd).toBeGreaterThan(0);
    expect(withFan.total).toBeCloseTo(withFan.subtotal - withFan.discount, 2);
    expect(withFan.discount).toBeGreaterThanOrEqual(fanUsd);
    // Контроль: у одного модуля ступени нет вовсе.
    expect(oneModule.fans).toEqual([]);
  });

  test("места дают свою ступень, не удешевляя тариф", () => {
    const q = buildQuote({ tierId: "medium", seats: 12 });

    const fan = q.fans.find((f) => f.id === "seats_volume");
    expect(fan).toBeTruthy();
    expect(fan!.percent).toBe(0.20);
    // База ступени — только строки мест, не весь подытог.
    expect(fan!.baseUsd).toBeLessThan(q.subtotal);
  });

  test("срок обязательства 36 месяцев добавляет свою ступень", () => {
    const q = buildQuote({ tierId: "full", period: "annual", commitmentMonths: 36 });

    expect(q.fans.map((f) => f.id)).toContain("commitment");
  });

  test("сумма скидок не превышает потолок и это честно сказано", () => {
    const q = buildQuote({
      tierId: "medium",
      modules: eightPaidModules(),
      seats: 30,
      period: "annual",
      commitmentMonths: 36,
    });

    expect(q.discount).toBeLessThanOrEqual(q.subtotal * MAX_TOTAL_DISCOUNT_RATIO + 0.01);
    expect(q.total).toBeGreaterThan(0);
    if (q.discountCappedBy > 0) {
      expect(q.notes.join(" ")).toContain("потолком");
    }
  });

  test("без объёма веера нет — цена остаётся полной", () => {
    const q = buildQuote({ tierId: "lite" });

    expect(q.fans).toEqual([]);
    expect(q.discountCappedBy).toBe(0);
  });
});
