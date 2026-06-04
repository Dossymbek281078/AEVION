import { describe, expect, it } from "vitest";
import { buildLsrFormHtml } from "./printForms";
import type { Lsr, LsrCalc } from "./types";

const lsr: Lsr = {
  id: "L1", title: "Школа №47 — отделка", objectId: "o", method: "ресурсный",
  indexQuarter: "2026-Q2", indexRegion: "Алматы",
  meta: { lsrNumber: "02-01-01", strojkaTitle: "Капремонт школы №47", author: "Иванов И." },
  sections: [], createdAt: "", updatedAt: "",
};

const calc: LsrCalc = {
  lsr,
  sections: [
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      section: { id: "s1", title: "Отделочные работы", category: "отделочные", positions: [] } as any,
      positions: [
        {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          position: { id: "p1", rateCode: "ОТД-15-04", volume: 0.83, coefficients: [{ kind: "действующий-объект", value: 1.15, justification: "" }] } as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rate: { code: "ОТД-15-04", title: "Окраска стен", unit: "100 м²" } as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          base: {} as any,
          appliedCoefMultiplier: 1.15,
          current: { fot: 5000, em: 200, materials: 3000, direct: 8200 },
          unitPrice: 9879,
        },
      ],
      direct: 8200, fot: 5000, overhead: 4500, profit: 3000, total: 15700,
    },
  ],
  totalBeforeVat: 15700, vat: 1884, totalWithVat: 17584,
};

describe("buildLsrFormHtml", () => {
  const html = buildLsrFormHtml(lsr, calc);

  it("это валидный самодостаточный HTML-документ", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Форма 4*");
    expect(html).toContain("window.print()");
  });

  it("содержит реквизиты шапки", () => {
    expect(html).toContain("02-01-01");
    expect(html).toContain("Капремонт школы №47");
    expect(html).toContain("Иванов И.");
  });

  it("содержит позицию, раздел и коэффициент", () => {
    expect(html).toContain("Отделочные работы");
    expect(html).toContain("ОТД-15-04");
    expect(html).toContain("Окраска стен");
    expect(html).toContain("К=1.15");
  });

  it("содержит итоги (ПЗ, НР+СП, НДС, итого)", () => {
    expect(html).toContain("ВСЕГО прямых затрат");
    expect(html).toContain("НДС 12%");
    expect(html).toContain("ИТОГО с НДС");
  });

  it("экранирует спецсимволы из данных", () => {
    const evil: Lsr = { ...lsr, meta: { ...lsr.meta, strojkaTitle: "<script>x</script>" } };
    const h = buildLsrFormHtml(evil, { ...calc, lsr: evil });
    expect(h).toContain("&lt;script&gt;");
    expect(h).not.toContain("<script>x</script>");
  });

  it("не падает на пустой смете", () => {
    const empty: LsrCalc = { lsr, sections: [], totalBeforeVat: 0, vat: 0, totalWithVat: 0 };
    const h = buildLsrFormHtml(lsr, empty);
    expect(h).toContain("Смета пуста");
  });
});
