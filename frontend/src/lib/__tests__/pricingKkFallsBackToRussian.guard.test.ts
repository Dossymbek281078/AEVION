// Страница цен для kk: свой словарь (30.10.2026); до того говорила русским, как велит isEnglish.
// 27.10.2026, замер прода /pricing с кукой aevion_lang=kk: кнопки «Выбрать Max» по-русски, а купоны
// «up to −$10 (max 50% of the order)» по-английски — словарь цен для kk падал на en.
import { describe, it, expect } from "vitest";
import { pricingDictFor, PRICING_DICT, kkDict } from "@/lib/pricingI18n";

describe("словарь страницы цен: запасной язык", () => {
  it("контроль прибора: в ru и en у ключа купона разные строки", () => {
    expect(PRICING_DICT.ru["promo.capNote"]).toBeTruthy();
    expect(PRICING_DICT.en["promo.capNote"]).toBeTruthy();
    expect(PRICING_DICT.ru["promo.capNote"]).not.toBe(PRICING_DICT.en["promo.capNote"]);
  });

  // 30.10.2026: решение 27.10 пересмотрено — у kk свой словарь, русского на казахской странице быть не должно
  // (проход Бюро: «Цены AEVION», «Выбрать Max» на kk). Непереведённые ключи kk — английские, не русские.
  it("kk берёт свой словарь; непереведённый ключ — английский, не русский", () => {
    expect(pricingDictFor("kk")["promo.capNote"]).toBe(kkDict["promo.capNote"]);
    expect(pricingDictFor("kk")["promo.capNote"]).not.toBe(PRICING_DICT.ru["promo.capNote"]);
    expect(pricingDictFor("kk")["checkout.cancel.title"]).toBe(PRICING_DICT.en["checkout.cancel.title"]);
  });

  it("прочие языки без своего словаря — английский; ru и en — свои", () => {
    expect(pricingDictFor("ar")["promo.capNote"]).toBe(PRICING_DICT.en["promo.capNote"]);
    expect(pricingDictFor("de")["promo.capNote"]).toBe(PRICING_DICT.en["promo.capNote"]);
    expect(pricingDictFor("ru")["promo.capNote"]).toBe(PRICING_DICT.ru["promo.capNote"]);
    expect(pricingDictFor("en")["promo.capNote"]).toBe(PRICING_DICT.en["promo.capNote"]);
  });
});
