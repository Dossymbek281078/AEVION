import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { Lsr, Resource, SmetaPosition, AppliedCoefficient, Rate, AiNotice } from "../../types";
import { registerRuntimeRate, clearRuntimeRates } from "../../corpus";
import { checkDuplicateMaterial } from "./duplicateMaterial";
import { checkMaterialPriceUnjustified } from "./materialPriceUnjustified";
import { checkCoefDouble } from "./coefDouble";
import { checkIndexDouble } from "./indexDouble";
import { deterministicBreakdown } from "./scenarioBreakdowns";

function mat(name: string, basePrice: number, qty = 1, unit = "м²"): Resource {
  return { kind: "материал", name, qtyPerUnit: qty, unit, basePrice };
}

function pos(over: Partial<SmetaPosition>): SmetaPosition {
  return { id: "p1", rateCode: "TST-01", volume: 1, coefficients: [], ...over };
}

function lsr(positions: SmetaPosition[]): Lsr {
  return {
    id: "l", title: "L", objectId: "o", method: "ресурсный",
    indexQuarter: "2026-Q2", indexRegion: "Алматы",
    sections: [{ id: "s1", title: "Раздел", category: "отделочные", positions }],
    createdAt: "", updatedAt: "",
  };
}

const testRate = (resources: Resource[]): Rate =>
  ({
    code: "TST-01", title: "Тестовая расценка", category: "отделочные",
    unit: "м²", composition: [], resources, baseCostPerUnit: 0,
  } as Rate);

beforeEach(() => {
  registerRuntimeRate(testRate([mat("Плитка керамическая", 2000)]));
});
afterEach(() => clearRuntimeRates());

describe("checkDuplicateMaterial", () => {
  it("ловит дубль материала в позиции", () => {
    const l = lsr([pos({ resourceOverrides: [mat("Плитка керамическая", 2000), mat("плитка  керамическая", 2000)] })]);
    const n = checkDuplicateMaterial(l);
    expect(n).toHaveLength(1);
    expect(n[0].scenario).toBe("duplicate-material");
    expect(n[0].severity).toBe("error");
    expect(n[0].title).toContain("2 раза");
  });

  it("не флагует, если материал один", () => {
    const l = lsr([pos({ resourceOverrides: [mat("Плитка керамическая", 2000)] })]);
    expect(checkDuplicateMaterial(l)).toHaveLength(0);
  });

  it("не флагует без resourceOverrides", () => {
    expect(checkDuplicateMaterial(lsr([pos({})]))).toHaveLength(0);
  });
});

describe("checkMaterialPriceUnjustified", () => {
  it("флагует цену выше нормативной на >15% без обоснования", () => {
    const l = lsr([pos({ resourceOverrides: [mat("Плитка керамическая", 3000)] })]); // +50%
    const n = checkMaterialPriceUnjustified(l);
    expect(n).toHaveLength(1);
    expect(n[0].scenario).toBe("material-price-unjustified");
    expect(n[0].message).toContain("50%");
  });

  it("не флагует, если есть обоснование в заметке", () => {
    const l = lsr([pos({ resourceOverrides: [mat("Плитка керамическая", 3000)], note: "цена по КП поставщика №12" })]);
    expect(checkMaterialPriceUnjustified(l)).toHaveLength(0);
  });

  it("не флагует отклонение в пределах 15%", () => {
    const l = lsr([pos({ resourceOverrides: [mat("Плитка керамическая", 2200)] })]); // +10%
    expect(checkMaterialPriceUnjustified(l)).toHaveLength(0);
  });
});

describe("checkCoefDouble", () => {
  const coef = (kind: AppliedCoefficient["kind"], value: number): AppliedCoefficient =>
    ({ kind, value, justification: "" });

  it("ловит повтор одного kind", () => {
    const l = lsr([pos({ coefficients: [coef("высота", 1.2), coef("высота", 1.1)] })]);
    const n = checkCoefDouble(l);
    expect(n).toHaveLength(1);
    expect(n[0].severity).toBe("error");
    expect(n[0].title).toContain("высота");
  });

  it("ловит перекрытие стеснённые + действующий-объект", () => {
    const l = lsr([pos({ coefficients: [coef("стеснённые", 1.15), coef("действующий-объект", 1.15)] })]);
    const n = checkCoefDouble(l);
    expect(n).toHaveLength(1);
    expect(n[0].severity).toBe("warning");
  });

  it("не флагует независимые коэффициенты", () => {
    const l = lsr([pos({ coefficients: [coef("высота", 1.2), coef("охранные-зоны", 1.1)] })]);
    expect(checkCoefDouble(l)).toHaveLength(0);
  });
});

describe("checkIndexDouble", () => {
  const biLsr = (positions: SmetaPosition[]): Lsr => ({ ...lsr(positions), method: "базисно-индексный" });

  it("флагует текущую цену материала при базисно-индексном методе", () => {
    // baseline 2000, индекс Алматы 2026-Q2 = ×1.1 → «текущая» ≈ 2200 (ratio 1.1 ≥ midpoint 1.05).
    // Завышенная цена (16000) тем более ловится.
    const l = biLsr([pos({ resourceOverrides: [mat("Плитка керамическая", 2200)] })]);
    const n = checkIndexDouble(l);
    expect(n).toHaveLength(1);
    expect(n[0].scenario).toBe("index-double");
    expect(n[0].severity).toBe("error");
  });

  it("не флагует при ресурсном методе", () => {
    const l = lsr([pos({ resourceOverrides: [mat("Плитка керамическая", 2200)] })]); // ресурсный
    expect(checkIndexDouble(l)).toHaveLength(0);
  });

  it("не флагует базисную цену", () => {
    // Цена ≈ нормативная (база) — ниже середины между базой и «текущей», не флагуется.
    const l = biLsr([pos({ resourceOverrides: [mat("Плитка керамическая", 2000)] })]);
    expect(checkIndexDouble(l)).toHaveLength(0);
  });
});

describe("deterministicBreakdown — batch D", () => {
  it("дубль материала → текст с именем и числом", () => {
    const l = lsr([pos({ resourceOverrides: [mat("Плитка керамическая", 2000), mat("Плитка керамическая", 2000)] })]);
    const notice = checkDuplicateMaterial(l)[0];
    const txt = deterministicBreakdown(l, notice)!;
    expect(txt).toContain("Плитка керамическая");
    expect(txt).toContain("2 раза");
  });

  it("цена без обоснования → упоминание КП", () => {
    const l = lsr([pos({ resourceOverrides: [mat("Плитка керамическая", 3000)] })]);
    const notice = checkMaterialPriceUnjustified(l)[0];
    const txt = deterministicBreakdown(l, notice)!;
    expect(txt).toContain("КП");
  });

  it("двойной коэффициент → произведение", () => {
    const l = lsr([pos({ coefficients: [{ kind: "высота", value: 1.2, justification: "" }, { kind: "высота", value: 1.1, justification: "" }] })]);
    const notice = checkCoefDouble(l)[0];
    const txt = deterministicBreakdown(l, notice)!;
    expect(txt).toContain("1.32"); // 1.2 × 1.1
  });

  it("индекс (базисно-индексный) → ненулевой разбор", () => {
    const l: Lsr = { ...lsr([pos({})]), method: "базисно-индексный" };
    const txt = deterministicBreakdown(l, {
      id: "n", severity: "warning", scenario: "index-stale", context: {}, title: "T", message: "m",
    });
    expect(txt).toBeTruthy();
    expect(txt!).toContain("индекс");
  });

  const mk = (scenario: string, ctx: { positionId?: string; sectionId?: string }): AiNotice => ({
    id: "n", severity: "warning", scenario, context: ctx, title: "T", message: "m",
  });

  it("зимнее удорожание → текст про СН РК 8.02-09", () => {
    const l = lsr([pos({})]);
    const txt = deterministicBreakdown(l, mk("winter-surcharge", { positionId: "p1" }));
    expect(txt).toBeTruthy();
    expect(txt!).toContain("8.02-09");
  });

  it("коэф. высоты → диапазон K", () => {
    const l = lsr([pos({})]);
    const txt = deterministicBreakdown(l, mk("height-coefficient", { positionId: "p1" }));
    expect(txt).toBeTruthy();
    expect(txt!).toContain("1.20");
  });

  it("потери материала → типовой % и расход", () => {
    const l = lsr([pos({ resourceOverrides: [mat("Плитка керамическая", 2000, 1.0)] })]);
    const txt = deterministicBreakdown(l, mk("waste-factor-missing", { positionId: "p1" }));
    expect(txt).toBeTruthy();
    expect(txt!).toContain("Плитка керамическая");
  });

  it("НР/СП раздела → разбор с названием раздела", () => {
    const l = lsr([pos({})]);
    const txt = deterministicBreakdown(l, mk("overhead-mismatch", { sectionId: "s1" }));
    expect(txt).toBeTruthy();
    expect(txt!).toContain("Раздел");
  });

  it("двойной индекс → упоминание индекса материалов", () => {
    const l: Lsr = { ...lsr([pos({ resourceOverrides: [mat("Плитка керамическая", 16000)] })]), method: "базисно-индексный" };
    const txt = deterministicBreakdown(l, mk("index-double", { positionId: "p1" }));
    expect(txt).toBeTruthy();
    expect(txt!).toContain("индекс материалов");
  });
});
