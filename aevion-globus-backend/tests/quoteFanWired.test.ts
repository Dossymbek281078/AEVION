import { describe, test, expect } from "vitest";
import { buildQuote, MODULES_PRICING } from "../src/data/pricing";
import { MAX_TOTAL_DISCOUNT_RATIO, MODULE_VOLUME_LADDER } from "../src/data/discounts";

/**
 * Веер скидок обязан участвовать в РАСЧЁТЕ, а не лежать рядом готовым к
 * употреблению. Отдельно посчитанная скидка, которую не вычитают из счёта, —
 * это ровно тот класс: механизм есть, потребителя нет, и снаружи всё выглядит
 * исправным.
 *
 * С 15.09.2026 модули на платном сроке входят в подписку, и надстройкой платно
 * продаются только отдельные приложения (у пяти из них четыре с ценой надстройки).
 * Поэтому ступень за объём модулей проверяется на free, где надстройки платные, и
 * ожидаемый процент берётся ИЗ ЛЕСТНИЦЫ для настоящего числа надстроек, а не
 * зашивается «0.20 за восемь»: восьми платных надстроек в каталоге больше нет.
 */

/** Все платные надстройки, от дешёвых к дорогим. */
function paidAddons(): string[] {
  return MODULES_PRICING
    .filter((m) => typeof m.addonMonthly === "number" && (m.addonMonthly ?? 0) > 0)
    .sort((a, b) => (a.addonMonthly ?? 0) - (b.addonMonthly ?? 0))
    .map((m) => m.id);
}

/** Ступень лестницы для числа модулей: последняя, чей порог достигнут. */
function ожидаемыйПроцент(count: number): number | null {
  const ступени = MODULE_VOLUME_LADDER.filter((s) => count >= s.from);
  return ступени.length ? ступени[ступени.length - 1].percent : null;
}

describe("веер подключён к расчёту счёта", () => {
  test("контроль: платных надстроек хватает на первую ступень веера", () => {
    expect(
      paidAddons().length,
      "надстроек меньше первого порога лестницы — ступень модулей проверить нечем",
    ).toBeGreaterThanOrEqual(MODULE_VOLUME_LADDER[0].from);
  });

  test("все платные надстройки поштучно дают ступень, и она видна отдельной строкой", () => {
    const modules = paidAddons();
    const q = buildQuote({ tierId: "free", modules });

    const fan = q.fans.find((f) => f.id === "modules_volume");
    expect(fan, "ступень за объём модулей не сработала").toBeTruthy();
    expect(fan!.percent).toBe(ожидаемыйПроцент(modules.length));
    expect(fan!.label).toContain("модул");
  });

  test("скидка ВЫЧИТАЕТСЯ из итога, а не только показывается", () => {
    const modules = paidAddons();
    const withFan = buildQuote({ tierId: "free", modules });
    const oneModule = buildQuote({ tierId: "free", modules: modules.slice(0, 1) });

    // Итог с надстройками обязан быть меньше суммы строк на размер веера.
    const fanUsd = withFan.fans.reduce((s, f) => s + f.amountUsd, 0);
    expect(fanUsd).toBeGreaterThan(0);
    expect(withFan.total).toBeCloseTo(withFan.subtotal - withFan.discount, 2);
    expect(withFan.discount).toBeGreaterThanOrEqual(fanUsd);
    // Контроль: у одного модуля ступени нет вовсе.
    expect(oneModule.fans).toEqual([]);
  });

  test("КОНТРОЛЬ: на платном сроке модули в подписке — ступени за модули нет", () => {
    const q = buildQuote({ tierId: "medium", modules: paidAddons() });
    expect(q.fans.find((f) => f.id === "modules_volume"), "скидка за модули, которые и так в подписке").toBeUndefined();
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
    const q = buildQuote({ tierId: "max", commitmentMonths: 36 });

    expect(q.fans.map((f) => f.id)).toContain("commitment");
  });

  test("сумма скидок не превышает потолок и это честно сказано", () => {
    const q = buildQuote({
      tierId: "free",
      modules: paidAddons(),
      seats: 30,
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
