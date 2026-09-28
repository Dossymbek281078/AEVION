import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  appSlugForReference,
  priceForReference,
  STOREFRONT_NAME_TO_REFERENCE,
} from "../src/data/lemonSqueezyVariants";
import { termMonthsForReference } from "../src/lib/payment/billingPeriod";

/**
 * Стартовая ступень DevHub включается ДВУМЯ действиями и ничем больше:
 * основатель называет цену и заводит одну строку в кабинете кассы.
 *
 * Зачем ступень: замер 28.09.2026 — между «бесплатно» и $200/мес у DevHub
 * пусто, и человек, готовый заплатить немного, уходит, потому что купить
 * нечего. Это магнит плана на 100 000 пользователей.
 *
 * Цену код НЕ выбирает: диапазон назвал основатель (9–19 $), значение живёт в
 * одной переменной. Пока её нет — позиции не существует нигде, и это «ещё
 * нет», а не поломка.
 */
const БЫЛО = process.env.DEVHUB_STARTER_USD;
beforeEach(() => { delete process.env.DEVHUB_STARTER_USD; });
afterEach(() => { if (БЫЛО === undefined) delete process.env.DEVHUB_STARTER_USD; else process.env.DEVHUB_STARTER_USD = БЫЛО; });

describe("стартовая ступень DevHub", () => {
  it("без цены не имеет потолка списания — значит и позиции нет", () => {
    expect(priceForReference("app_devhub_starter")).toBeNull();
  });

  it("с ценой потолок равен ровно ей, без пересчёта по лестнице", () => {
    process.env.DEVHUB_STARTER_USD = "12";
    expect(priceForReference("app_devhub_starter")).toBe(12);
  });

  it("выдаётся именно DevHub, а не выдуманный модуль", () => {
    // Контроль в обе стороны: обычная ступень режется так же.
    expect(appSlugForReference("app_devhub_starter")).toBe("devhub");
    expect(appSlugForReference("app_devhub_pro")).toBe("devhub");
  });

  it("срок — один месяц", () => {
    expect(termMonthsForReference("app_devhub_starter")).toBe(1);
  });

  it("имя товара для кабинета названо точно и всегда", () => {
    expect(STOREFRONT_NAME_TO_REFERENCE["AEVION DevHub — Starter (1 mo)"]).toBe("app_devhub_starter");
  });

  it("контроль: цена мусором не принимается", () => {
    for (const мусор of ["", "  ", "0", "-5", "дорого"]) {
      process.env.DEVHUB_STARTER_USD = мусор;
      expect(priceForReference("app_devhub_starter"), `«${мусор}» не должно стать ценой`).toBeNull();
    }
  });
});
