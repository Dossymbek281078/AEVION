import { describe, test, expect } from "vitest";
import { buildQuote } from "../src/data/pricing";
import { MAX_TOTAL_DISCOUNT_RATIO } from "../src/data/discounts";

/**
 * Сумма всех скидок не может превысить потолок — ни при каком сочетании.
 *
 * Скидок в системе четыре вида, и каждая по отдельности выглядит скромно:
 * годовая оплата (−17%), объём мест (до −30%), объём модулей (до −20%) и
 * промо-код (до −50% или фиксированная сумма). Вместе они способны отдать
 * товар почти даром, и по одной цифре итога это не заметить — ровно поэтому
 * потолок и появился.
 *
 * Замер 19.08.2026 на новых ценах: по всем проверенным сочетаниям максимум
 * составил ровно 50%, и в самом тяжёлом случае (Full, 25 мест, 8 модулей,
 * TEAM100) потолок честно срезал $265.
 *
 * Тест проверяет не конкретные суммы, а СВОЙСТВО: сколько ни складывай, ниже
 * потолка не уйдёт. Суммы меняются с каждым репрайсом, свойство — нет.
 */

const MODULES_8 = ["qright", "qsign", "qcoreai", "qai", "qlearn", "qnews", "qstore", "qmedia"];

/** Сочетания, где скидки складываются сильнее всего. */
const CASES = [
  { name: "один, помесячно", period: "monthly" as const, seats: 1, modules: [] as string[], promo: undefined },
  { name: "один, годовая", period: "annual" as const, seats: 1, modules: [], promo: undefined },
  { name: "25 мест, годовая", period: "annual" as const, seats: 25, modules: [], promo: undefined },
  { name: "25 мест + 8 модулей", period: "annual" as const, seats: 25, modules: MODULES_8, promo: undefined },
  { name: "всё + процентный промо", period: "annual" as const, seats: 25, modules: MODULES_8, promo: "AEVION20" },
  { name: "всё + фиксированный промо", period: "annual" as const, seats: 25, modules: MODULES_8, promo: "TEAM100" },
  { name: "всё + STARTUP50", period: "annual" as const, seats: 25, modules: MODULES_8, promo: "STARTUP50" },
];

const TIERS = ["lite", "medium", "full", "pro"] as const;

describe("потолок суммарной скидки держится", () => {
  test("контроль: потолок объявлен и разумен", () => {
    // Если константу однажды уберут или обнулят, все проверки ниже станут
    // бессмысленными — а выглядеть будут зелёными.
    //
    // Верхняя граница здесь не косметика. Проверено мутацией 19.08.2026: если
    // поднять сам потолок до 0.9, все проверки ниже проходят — они сравнивают
    // скидку с ОБЪЯВЛЕННЫМ потолком, а не с разумным. То есть планку можно
    // поднять молча, и сторож это одобрит. Поэтому граница 0.6: выше — значит
    // мы отдаём больше половины продукта, и такое решение должно быть видимым
    // (тест краснеет и требует поменять его же).
    expect(MAX_TOTAL_DISCOUNT_RATIO).toBeGreaterThan(0);
    expect(
      MAX_TOTAL_DISCOUNT_RATIO,
      "потолок скидок подняли выше 60% — это решение о цене, а не правка",
    ).toBeLessThanOrEqual(0.6);
  });

  test("контроль: сочетания действительно дают заметную скидку", () => {
    // Иначе тест «не превышает потолок» проходил бы на нулевых скидках.
    const q = buildQuote({ tierId: "full", period: "annual", seats: 25, modules: MODULES_8, promoCode: "TEAM100" } as never);
    const pct = (q.subtotal - q.total) / q.subtotal;
    expect(pct, "самое тяжёлое сочетание почти не даёт скидки — проверять нечего").toBeGreaterThan(0.3);
  });

  for (const tier of TIERS) {
    for (const c of CASES) {
      test(`${tier} · ${c.name} — не ниже потолка`, () => {
        const q = buildQuote({
          tierId: tier,
          period: c.period,
          seats: c.seats,
          modules: c.modules,
          promoCode: c.promo,
        } as never);

        expect(q.subtotal, "смета без суммы — считать нечего").toBeGreaterThan(0);
        expect(q.total, "итог не может быть отрицательным").toBeGreaterThanOrEqual(0);

        const ratio = (q.subtotal - q.total) / q.subtotal;
        // Допуск в один цент: округление до копеек, а не превышение по смыслу.
        expect(
          ratio,
          `${tier} / ${c.name}: скидка ${Math.round(ratio * 100)}% при потолке ${Math.round(MAX_TOTAL_DISCOUNT_RATIO * 100)}% ` +
            `(итого $${q.total}, из $${q.subtotal})`,
        ).toBeLessThanOrEqual(MAX_TOTAL_DISCOUNT_RATIO + 0.001);
      });
    }
  }
});
