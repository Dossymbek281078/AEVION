import { describe, expect, it } from "vitest";
import {
  kindPerUnitOf,
  basketTotals,
  realFactTotals,
  matchPercent,
  type PositionLite,
  type SmetaLite,
  type BasketItem,
} from "./realBuild";

// Реальная позиция №1 из real-rates.json (объект «коллектор»): qty=18, unitPrice=438,
// ресурсы труд total=7792, машины total=82. Семантика: total — на всю позицию.
const POS_VALKA: PositionLite = {
  n: 1,
  code: "1101-0705-0107",
  name: "Валка деревьев",
  unit: "дерево",
  qty: 18,
  unitPrice: 438,
  total: 7884,
  resources: [
    { kind: "труд", total: 7792 },
    { kind: "машины", total: 82 },
  ],
};

function mkItem(pos: PositionLite, qty: number): BasketItem {
  return {
    uid: `t-${pos.n}`,
    sheet: "s",
    n: pos.n,
    code: pos.code,
    name: pos.name,
    unit: pos.unit,
    unitPrice: pos.unitPrice,
    qty,
    kindPerUnit: kindPerUnitOf(pos),
  };
}

describe("kindPerUnitOf", () => {
  it("делит стоимость вида ресурса на количество позиции", () => {
    const k = kindPerUnitOf(POS_VALKA);
    expect(k["труд"]).toBeCloseTo(7792 / 18, 4); // ≈ 432.89
    expect(k["машины"]).toBeCloseTo(82 / 18, 4); // ≈ 4.56
    expect(k["материал"]).toBe(0);
    expect(k["перевозка"]).toBe(0);
  });

  it("сумма видов на единицу × qty ≈ сумме ресурсов позиции", () => {
    const k = kindPerUnitOf(POS_VALKA);
    const reconstructed = (k["труд"] + k["машины"]) * POS_VALKA.qty;
    expect(reconstructed).toBeCloseTo(7792 + 82, 2);
  });

  it("не делит на ноль при qty=0", () => {
    const zero: PositionLite = { ...POS_VALKA, qty: 0 };
    const k = kindPerUnitOf(zero);
    expect(Number.isFinite(k["труд"])).toBe(true);
    expect(k["труд"]).toBe(7792); // qty||1 → делит на 1
  });

  it("игнорирует неизвестные виды ресурсов", () => {
    const pos: PositionLite = {
      ...POS_VALKA,
      qty: 1,
      resources: [{ kind: "прочее", total: 999 }, { kind: "труд", total: 10 }],
    };
    const k = kindPerUnitOf(pos);
    expect(k["труд"]).toBe(10);
    expect(k["материал"]).toBe(0);
  });
});

describe("basketTotals", () => {
  it("суммирует цену×объём и разбивку по видам", () => {
    const basket = [mkItem(POS_VALKA, 18), mkItem(POS_VALKA, 2)];
    const t = basketTotals(basket);
    expect(t.all).toBeCloseTo(438 * 18 + 438 * 2, 2); // 8760
    // труд: (7792/18)*18 + (7792/18)*2
    expect(t.byKind["труд"]).toBeCloseTo((7792 / 18) * 20, 2);
    expect(t.byKind["машины"]).toBeCloseTo((82 / 18) * 20, 2);
  });

  it("пустая корзина даёт нулевые итоги", () => {
    const t = basketTotals([]);
    expect(t.all).toBe(0);
    expect(t.byKind["труд"]).toBe(0);
  });
});

describe("realFactTotals", () => {
  it("извлекает итоги из шапки ЛС", () => {
    const smeta: SmetaLite = {
      sheet: "s", smetaNo: "01-01", object: "o",
      totals: { "всего": 339429, "труд": 22594, "машины": 11453, "перевозки": 81177 },
      positions: [],
    };
    const f = realFactTotals(smeta);
    expect(f["всего"]).toBe(339429);
    expect(f["труд"]).toBe(22594);
    expect(f["перевозки"]).toBe(81177);
  });

  it("возвращает null для отсутствующих ключей", () => {
    const smeta: SmetaLite = { sheet: "s", smetaNo: null, object: null, positions: [] };
    const f = realFactTotals(smeta);
    expect(f["всего"]).toBeNull();
    expect(f["машины"]).toBeNull();
  });
});

describe("matchPercent", () => {
  it("100% при равенстве", () => {
    expect(matchPercent(500, 500)).toBeCloseTo(100, 5);
  });
  it("null при отсутствующем или нулевом факте", () => {
    expect(matchPercent(500, null)).toBeNull();
    expect(matchPercent(500, 0)).toBeNull();
  });
  it("корректное отношение", () => {
    expect(matchPercent(250, 500)).toBeCloseTo(50, 5);
  });
});
