import { describe, expect, it } from "vitest";
import {
  kindPerUnitOf,
  basketTotals,
  realFactTotals,
  matchPercent,
  approxEqual,
  reconcilePositions,
  buildReconChecklist,
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

describe("approxEqual", () => {
  it("равные в пределах относительного допуска", () => {
    expect(approxEqual(100000, 100400)).toBe(true);  // 0.4% < 0.5%
    expect(approxEqual(100000, 101000)).toBe(false); // 1% > 0.5%
  });
  it("мелкие абсолютные расхождения считаются равными", () => {
    expect(approxEqual(0.2, 0.6)).toBe(true); // diff 0.4 ≤ abs 0.5
  });
});

describe("reconcilePositions", () => {
  const POS_A: PositionLite = { n: 1, code: "AAA", name: "Работа A", unit: "м3", qty: 10, unitPrice: 100, total: 1000 };
  const POS_B: PositionLite = { n: 2, code: "BBB", name: "Работа B", unit: "м2", qty: 5, unitPrice: 200, total: 1000 };
  const SMETA: SmetaLite = {
    sheet: "L1", smetaNo: "01-01", object: "школа",
    totals: { "всего": 2000 },
    positions: [POS_A, POS_B],
  };
  const item = (p: PositionLite, qty: number, sheet = "L1"): BasketItem => ({
    uid: `u-${p.code}-${qty}`, sheet, n: p.n, code: p.code, name: p.name,
    unit: p.unit, unitPrice: p.unitPrice, qty, kindPerUnit: kindPerUnitOf(p),
  });

  it("полное совпадение → все ok, matchedPct=100", () => {
    const r = reconcilePositions([item(POS_A, 10), item(POS_B, 5)], SMETA);
    expect(r.counts.ok).toBe(2);
    expect(r.matchedPct).toBeCloseTo(100, 5);
    expect(r.rows.every((x) => x.status === "ok")).toBe(true);
  });

  it("неверный объём → status qty с указанием направления", () => {
    const r = reconcilePositions([item(POS_A, 12), item(POS_B, 5)], SMETA);
    expect(r.counts.qty).toBe(1);
    const a = r.rows.find((x) => x.code === "AAA")!;
    expect(a.status).toBe("qty");
    expect(a.factQty).toBe(10);
    expect(a.mineQty).toBe(12);
    expect(a.note).toContain("завышен");
  });

  it("пропущенная позиция → missing, лишняя из другой ЛС → extra", () => {
    const foreign = { ...item(POS_A, 10), code: "ZZZ", name: "чужая" };
    const r = reconcilePositions([foreign], SMETA);
    // AAA и BBB пропущены (нет в корзине по листу L1), ZZZ — лишняя
    expect(r.counts.missing).toBe(2);
    expect(r.counts.extra).toBe(1);
    expect(r.matchedPct).toBeCloseTo(0, 5);
  });

  it("позиция из другого листа не зачитывается за сверяемую ЛС", () => {
    const r = reconcilePositions([item(POS_A, 10, "L2"), item(POS_B, 5)], SMETA);
    const a = r.rows.find((x) => x.code === "AAA")!;
    expect(a.status).toBe("missing"); // L2-позиция не участвует → AAA в L1 пропущена
    expect(r.counts.missing).toBe(1);
    expect(r.counts.extra).toBe(0); // чужой лист не зачитывается как «лишняя»
  });

  it("неверная расценка → status price", () => {
    const r = reconcilePositions(
      [{ ...item(POS_A, 10), unitPrice: 150 }, item(POS_B, 5)],
      SMETA,
    );
    const a = r.rows.find((x) => x.code === "AAA")!;
    expect(a.status).toBe("price");
    expect(r.counts.price).toBe(1);
  });

  it("агрегирует одинаковые шифры в корзине", () => {
    const r = reconcilePositions([item(POS_A, 6), item(POS_A, 4), item(POS_B, 5)], SMETA);
    const a = r.rows.find((x) => x.code === "AAA")!;
    expect(a.mineQty).toBe(10); // 6+4
    expect(a.status).toBe("ok");
  });

  it("сортирует ошибки выше ok", () => {
    const r = reconcilePositions([item(POS_A, 99), item(POS_B, 5)], SMETA);
    expect(r.rows[0].status).not.toBe("ok"); // qty-расхождение первым
  });
});

describe("buildReconChecklist", () => {
  const POS_A: PositionLite = { n: 1, code: "AAA", name: "Работа A", unit: "м3", qty: 10, unitPrice: 100, total: 1000 };
  const POS_B: PositionLite = { n: 2, code: "BBB", name: "Работа B", unit: "м2", qty: 5, unitPrice: 200, total: 1000 };
  const SMETA: SmetaLite = { sheet: "L1", smetaNo: "01", object: "o", totals: { "всего": 2000 }, positions: [POS_A, POS_B] };
  const item = (p: PositionLite, qty: number): BasketItem => ({
    uid: `u-${p.code}-${qty}`, sheet: "L1", n: p.n, code: p.code, name: p.name,
    unit: p.unit, unitPrice: p.unitPrice, qty, kindPerUnit: kindPerUnitOf(p),
  });

  it("полное совпадение → ready, пустой список, 100%", () => {
    const c = buildReconChecklist(reconcilePositions([item(POS_A, 10), item(POS_B, 5)], SMETA));
    expect(c.ready).toBe(true);
    expect(c.items).toHaveLength(0);
    expect(c.readiness).toBe(100);
    expect(c.summary).toContain("сошлась");
  });

  it("missing/price идут выше qty/extra", () => {
    // AAA объём неверный (qty), BBB отсутствует (missing)
    const c = buildReconChecklist(reconcilePositions([item(POS_A, 12)], SMETA));
    expect(c.items[0].severity).toBe("high"); // missing BBB
    expect(c.items.some((x) => x.status === "missing" && x.code === "BBB")).toBe(true);
    expect(c.items.some((x) => x.status === "qty" && x.code === "AAA")).toBe(true);
    expect(c.ready).toBe(false);
  });

  it("summary перечисляет что сделать", () => {
    const c = buildReconChecklist(reconcilePositions([item(POS_A, 12)], SMETA));
    expect(c.summary).toContain("добавить 1");
    expect(c.summary).toContain("исправить объёмов 1");
  });

  it("текст императивный по статусу", () => {
    const c = buildReconChecklist(reconcilePositions([item(POS_A, 12)], SMETA));
    expect(c.items.find((x) => x.code === "BBB")!.text).toContain("Добавьте");
    expect(c.items.find((x) => x.code === "AAA")!.text).toContain("Исправьте объём");
  });
});
