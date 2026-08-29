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

import { pdfAnchorField } from "../src/lib/opentimestamps/anchorSummary";

describe("строка про якорь в PDF-сертификате", () => {
  test("подтверждено — назван номер блока", () => {
    const f = pdfAnchorField({ status: "bitcoin-confirmed", bitcoinBlockHeight: 912345 });
    expect(f.value).toContain("912345");
    expect(f.label).toMatch(/without AEVION/i);
  });

  test("ярлык обещает проверяемость — значение говорит, ЧЕМ проверять", () => {
    // Обещание без способа его исполнить хуже отсутствия обещания: документ
    // говорил «verifiable without AEVION» и предлагал поверить нашему же
    // выводу «confirmed». Теперь рядом стоит путь к байтам доказательства.
    const f = pdfAnchorField({ status: "bitcoin-confirmed", bitcoinBlockHeight: 912345 });
    expect(f.label).toMatch(/without AEVION/i);
    expect(f.value, "сказано «проверяемо», но не сказано чем").toMatch(/\.ots/i);
    expect(f.value).toMatch(/OpenTimestamps client/i);
  });

  test("подтверждено без высоты — номер не выдумывается", () => {
    const f = pdfAnchorField({ status: "bitcoin-confirmed", bitcoinBlockHeight: null });
    expect(f.value).not.toMatch(/[0-9]/);
    expect(f.value).toMatch(/confirmed/i);
  });

  test("не якорено — так и написано, а не пропущено", () => {
    // Молчание читалось бы как «якорь есть, просто не напечатали».
    const f = pdfAnchorField({ status: "not_stamped", bitcoinBlockHeight: null });
    expect(f.value.length).toBeGreaterThan(0);
    expect(f.value).toMatch(/none/i);
    expect(f.value, "документ обещает будущее, которого не будет").toMatch(/will not receive/i);
  });

  test("«готовится» и «не будет» — разные строки", () => {
    const p = pdfAnchorField({ status: "pending", bitcoinBlockHeight: null });
    const n = pdfAnchorField({ status: "not_stamped", bitcoinBlockHeight: null });
    expect(p.value).not.toBe(n.value);
    expect(p.value).toMatch(/pending/i);
    expect(n.value).not.toMatch(/pending/i);
  });

  test("все четыре состояния дают четыре разные строки", () => {
    const seen = new Set(
      ["not_stamped", "pending", "bitcoin-confirmed", "failed"].map(
        (s) => pdfAnchorField({ status: s, bitcoinBlockHeight: null }).value,
      ),
    );
    expect(seen.size).toBe(4);
  });

  test("ни одно состояние не даёт пустой строки", () => {
    for (const s of ["not_stamped", "pending", "bitcoin-confirmed", "failed", "что-то новое"]) {
      const f = pdfAnchorField({ status: s, bitcoinBlockHeight: null });
      expect(f.value.trim().length, `пустое значение при статусе ${s}`).toBeGreaterThan(0);
      expect(f.label.trim().length, `пустая подпись при статусе ${s}`).toBeGreaterThan(0);
    }
  });
});
