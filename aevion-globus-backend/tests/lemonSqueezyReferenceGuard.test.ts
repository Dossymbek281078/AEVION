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
    process.env.LEMON_SQUEEZY_VARIANT_LITE_MONTHLY = "12345";
    expect(resolveLemonSqueezyVariant("tier_lite_monthly")).toBe("12345");
  });
});
