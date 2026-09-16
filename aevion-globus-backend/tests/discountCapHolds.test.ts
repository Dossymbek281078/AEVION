import { describe, test, expect } from "vitest";
import { buildQuote, TERM_TIERS, STANDALONE_APPS, getModulePrice } from "../src/data/pricing";
import { MAX_TOTAL_DISCOUNT_RATIO } from "../src/data/discounts";

/**
 * Сумма всех скидок не может превысить потолок — ни при каком сочетании.
 *
 * Каждая скидка по отдельности выглядит скромно: объём мест (до −30%), объём
 * модулей (до −20%), срок обязательства (до −10%) и промо-код (до −50% или
 * фиксированная сумма). Вместе они способны отдать товар почти даром, и по одной
 * цифре итога это не заметить — ровно поэтому потолок и появился.
 *
 * С 15.09.2026 тариф — это срок: отдельной годовой скидки нет (выгода длинного
 * срока уже в цене месяца), модули на платном сроке входят в подписку, а
 * фиксированный промокод применяется ОДИН раз за покупку. Складываются теперь
 * места, срок обязательства и промокод; модули — на free, где надстройки платные.
 *
 * Тест проверяет не конкретные суммы, а СВОЙСТВО: сколько ни складывай, ниже
 * потолка не уйдёт. Суммы меняются с каждым репрайсом, свойство — нет.
 */

const НАДСТРОЙКИ = STANDALONE_APPS.map((a) => a.moduleId).filter((id) => (getModulePrice(id)?.addonMonthly ?? 0) > 0);

/** Сочетания, где скидки складываются сильнее всего. */
const CASES = [
  { name: "один, без ничего", seats: 1, commitmentMonths: undefined, promo: undefined },
  { name: "25 мест", seats: 25, commitmentMonths: undefined, promo: undefined },
  { name: "25 мест + обязательство 36 мес", seats: 25, commitmentMonths: 36, promo: undefined },
  { name: "всё + процентный промо", seats: 25, commitmentMonths: 36, promo: "AEVION20" },
  { name: "всё + фиксированный промо", seats: 25, commitmentMonths: 36, promo: "TEAM100" },
  { name: "всё + STARTUP50", seats: 25, commitmentMonths: 36, promo: "STARTUP50" },
];

describe("потолок суммарной скидки держится", () => {
  test("контроль: потолок объявлен и разумен", () => {
    // Если константу однажды уберут или обнулят, все проверки ниже станут
    // бессмысленными — а выглядеть будут зелёными.
    //
    // Верхняя граница здесь не косметика. Проверено мутацией 19.08.2026: если
    // поднять сам потолок до 0.9, все проверки ниже проходят — они сравнивают
    // скидку с ОБЪЯВЛЕННЫМ потолком, а не с разумным. Поэтому граница 0.6.
    expect(MAX_TOTAL_DISCOUNT_RATIO).toBeGreaterThan(0);
    expect(
      MAX_TOTAL_DISCOUNT_RATIO,
      "потолок скидок подняли выше 60% — это решение о цене, а не правка",
    ).toBeLessThanOrEqual(0.6);
  });

  test("контроль: сочетания действительно дают заметную скидку", () => {
    // Иначе тест «не превышает потолок» проходил бы на нулевых скидках.
    const q = buildQuote({ tierId: "full", seats: 25, commitmentMonths: 36, promoCode: "AEVION20" });
    const pct = (q.subtotal - q.total) / q.subtotal;
    expect(pct, "самое тяжёлое сочетание почти не даёт скидки — проверять нечего").toBeGreaterThan(0.3);
  });

  test("контроль: STARTUP50 поверх мест и срока упирается в потолок, и это сказано", () => {
    // Случай, где потолок обязан СРАБОТАТЬ, а не только не нарушаться.
    const q = buildQuote({ tierId: "lite", seats: 25, commitmentMonths: 36, promoCode: "STARTUP50" });
    expect(q.discountCappedBy, "потолок не срезал ничего — проверка «не выше потолка» не видела его работы").toBeGreaterThan(0);
    expect(q.notes.join(" ")).toContain("потолком");
  });

  for (const tier of TERM_TIERS) {
    for (const c of CASES) {
      test(`${tier} · ${c.name} — не ниже потолка`, () => {
        const q = buildQuote({
          tierId: tier,
          seats: c.seats,
          commitmentMonths: c.commitmentMonths,
          promoCode: c.promo,
        });

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

  test("free с платными надстройками, местами, сроком и промо — не ниже потолка", () => {
    // Скидка за объём модулей теперь возможна только вне подписки.
    const q = buildQuote({ tierId: "free", modules: НАДСТРОЙКИ, seats: 25, commitmentMonths: 36, promoCode: "AEVION20" });
    expect(q.subtotal).toBeGreaterThan(0);
    expect((q.subtotal - q.total) / q.subtotal).toBeLessThanOrEqual(MAX_TOTAL_DISCOUNT_RATIO + 0.001);
  });
});
