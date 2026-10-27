// Страница цен для kk говорит одним языком: русским, как велит isEnglish (ru и kk — не английский).
// 27.10.2026, замер прода /pricing с кукой aevion_lang=kk: кнопки «Выбрать Max» по-русски, а купоны
// «up to −$10 (max 50% of the order)» по-английски — словарь цен для kk падал на en.
import { describe, it, expect } from "vitest";
import { pricingDictFor, PRICING_DICT } from "@/lib/pricingI18n";

describe("словарь страницы цен: запасной язык", () => {
  it("контроль прибора: в ru и en у ключа купона разные строки", () => {
    expect(PRICING_DICT.ru["promo.capNote"]).toBeTruthy();
    expect(PRICING_DICT.en["promo.capNote"]).toBeTruthy();
    expect(PRICING_DICT.ru["promo.capNote"]).not.toBe(PRICING_DICT.en["promo.capNote"]);
  });

  it("kk берёт русский словарь, а не английский", () => {
    expect(pricingDictFor("kk")["promo.capNote"]).toBe(PRICING_DICT.ru["promo.capNote"]);
    expect(pricingDictFor("kk")["promo.upTo"]).toBe(PRICING_DICT.ru["promo.upTo"]);
  });

  it("прочие языки без своего словаря — английский; ru и en — свои", () => {
    expect(pricingDictFor("ar")["promo.capNote"]).toBe(PRICING_DICT.en["promo.capNote"]);
    expect(pricingDictFor("de")["promo.capNote"]).toBe(PRICING_DICT.en["promo.capNote"]);
    expect(pricingDictFor("ru")["promo.capNote"]).toBe(PRICING_DICT.ru["promo.capNote"]);
    expect(pricingDictFor("en")["promo.capNote"]).toBe(PRICING_DICT.en["promo.capNote"]);
  });
});
