import { describe, test, expect } from "vitest";
import { anchorSummary } from "../src/lib/opentimestamps/anchorSummary";

/**
 * Состояние якоря спрашивают четыре поверхности. Пока ответ считался в каждой
 * отдельно, публичный реестр не показывал его вовсе — главный козырь продукта
 * («доказательство, которое переживёт AEVION») был невидим на его же витрине.
 */
describe("состояние якоря считается одинаково для всех поверхностей", () => {
  test("не якорили — честный not_stamped, а не «ожидает»", () => {
    expect(anchorSummary({ otsStatus: null })).toEqual({ status: "not_stamped", bitcoinBlockHeight: null });
    expect(anchorSummary({})).toEqual({ status: "not_stamped", bitcoinBlockHeight: null });
    expect(anchorSummary({ otsStatus: "" })).toEqual({ status: "not_stamped", bitcoinBlockHeight: null });
  });

  test("подтверждено — высота блока доезжает числом даже строкой из pg", () => {
    expect(anchorSummary({ otsStatus: "bitcoin-confirmed", otsBitcoinBlockHeight: "912345" }))
      .toEqual({ status: "bitcoin-confirmed", bitcoinBlockHeight: 912345 });
    expect(anchorSummary({ otsStatus: "bitcoin-confirmed", otsBitcoinBlockHeight: 912345 }))
      .toEqual({ status: "bitcoin-confirmed", bitcoinBlockHeight: 912345 });
  });

  test("пустая высота НЕ превращается в блок №0", () => {
    // Number("") === 0, а ноль — правдоподобная высота: подмена была бы тихой.
    expect(anchorSummary({ otsStatus: "pending", otsBitcoinBlockHeight: "" }).bitcoinBlockHeight).toBeNull();
    expect(anchorSummary({ otsStatus: "pending", otsBitcoinBlockHeight: null }).bitcoinBlockHeight).toBeNull();
  });

  test("мусор в высоте — null, а не NaN", () => {
    expect(anchorSummary({ otsStatus: "pending", otsBitcoinBlockHeight: "zzz" }).bitcoinBlockHeight).toBeNull();
  });

  test("незнакомое состояние НЕ выдаётся за «якоря нет»", () => {
    // Подмена на not_stamped сказала бы «якоря нет» там, где неизвестно что.
    expect(anchorSummary({ otsStatus: "какое-то-новое" }).status).toBe("какое-то-новое");
  });

  test("четыре состояния словаря различимы", () => {
    const seen = new Set(
      ["not_stamped", "pending", "bitcoin-confirmed", "failed"].map(
        (s) => anchorSummary({ otsStatus: s }).status,
      ),
    );
    expect(seen.size).toBe(4);
  });
});
