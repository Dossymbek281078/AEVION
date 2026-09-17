import { describe, it, expect } from "vitest";
import { resolveLemonSqueezyVariant } from "../src/data/lemonSqueezyVariants";

// Ключи прототипа не должны сходить за ссылку на платёжный вариант.
//
// На 28.07.2026 это ещё не было дефектом: значения словаря — ИМЕНА переменных
// окружения, поэтому поиск по функции давал undefined и результат null. Тест
// закрепляет не сегодняшнюю случайность, а требование: неизвестная строка и
// строка-ключ прототипа обязаны вести себя одинаково.

describe("resolveLemonSqueezyVariant — ключ прототипа не ссылка", () => {
  it.each(["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"])(
    "«%s» разрешается так же, как неизвестная ссылка",
    (key) => {
      expect(resolveLemonSqueezyVariant(key)).toBe(resolveLemonSqueezyVariant("zzz_unknown"));
      expect(resolveLemonSqueezyVariant(key)).toBeNull();
    },
  );

  it("настоящая ссылка по-прежнему разрешается — иначе защита выродилась бы в «всегда null»", () => {
    process.env.LEMON_SQUEEZY_VARIANT_LITE = "12345";
    process.env.LEMON_SQUEEZY_VARIANT_CYBERCHESS_PRO = "23456";
    try {
      expect(resolveLemonSqueezyVariant("tier_lite")).toBe("12345");
      expect(resolveLemonSqueezyVariant("app_cyberchess_pro")).toBe("23456");
    } finally {
      delete process.env.LEMON_SQUEEZY_VARIANT_LITE;
      delete process.env.LEMON_SQUEEZY_VARIANT_CYBERCHESS_PRO;
    }
  });

  it("прежняя ссылка в кассу не ведёт: она не продаётся (15.09.2026)", () => {
    // Прежний вариант узнаётся вебхуком при продлении, но начать по нему
    // покупку нельзя — иначе продавался бы снятый товар по снятой цене.
    process.env.LEMON_SQUEEZY_VARIANT_LITE_MONTHLY = "34567";
    try {
      expect(resolveLemonSqueezyVariant("tier_lite_monthly")).toBeNull();
    } finally {
      delete process.env.LEMON_SQUEEZY_VARIANT_LITE_MONTHLY;
    }
  });
});
