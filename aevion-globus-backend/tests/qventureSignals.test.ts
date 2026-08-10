import { describe, test, expect } from "vitest";
import { parsePlanSignals } from "../src/lib/qventure/signals";

// parsePlanSignals is a regex parser that lifts ~15 quantitative fields out of
// free-text traction notes, and those fields drive the composite. A bad pattern
// silently misreads a metric and skews the score with no error — so this was a
// real coverage gap. Writing it found one such bug (see the LTV/CAC case).

describe("parsePlanSignals — revenue", () => {
  test("$40k MRR is annualized into revenue", () => {
    const s = parsePlanSignals("$40k MRR");
    expect(s.revenueUsd).toBe(480_000);
    expect(s.revenueBasis).toBe("MRR");
  });
  test("$2.4M ARR is taken as-is", () => {
    const s = parsePlanSignals("$2.4M ARR");
    expect(s.revenueUsd).toBe(2_400_000);
    expect(s.revenueBasis).toBe("ARR");
  });
  test("revenue mentioned without a figure sets the soft flag", () => {
    const s = parsePlanSignals("we have strong revenue momentum");
    expect(s.revenueUsd).toBeNull();
    expect(s.mentionsRevenueNoNumber).toBe(true);
  });
  test("an explicit denial of revenue is NOT the soft flag", () => {
    const s = parsePlanSignals("pre-launch with no revenue");
    expect(s.mentionsRevenueNoNumber).toBe(false);
  });
});

describe("parsePlanSignals — growth", () => {
  test("18% MoM", () => {
    const s = parsePlanSignals("growing 18% MoM");
    expect(s.growthPct).toBe(18);
    expect(s.growthPeriod).toBe("MoM");
  });
  test("38% YoY", () => {
    const s = parsePlanSignals("38% YoY growth");
    expect(s.growthPct).toBe(38);
    expect(s.growthPeriod).toBe("YoY");
  });
});

describe("parsePlanSignals — unit economics", () => {
  test("LTV/CAC stated as a ratio does NOT become a dollar CAC (regression)", () => {
    // "LTV/CAC 4.2" is a ratio of 4.2, not a $4.20 CAC. The CAC regex used to
    // also match "cac 4.2" inside it, setting cacUsd=4.2 — nonsense data that
    // inflated fieldsFound / signalCoverage with a metric never disclosed.
    const s = parsePlanSignals("$40k MRR, LTV/CAC 4.2");
    expect(s.ltvCacRatio).toBe(4.2);
    expect(s.cacUsd).toBeNull();
  });
  test("a real dollar CAC is still parsed", () => {
    const s = parsePlanSignals("CAC $500, LTV $1500");
    expect(s.cacUsd).toBe(500);
    expect(s.ltvUsd).toBe(1500);
    expect(s.ltvCacRatio).toBe(3); // derived 1500/500
  });
  test("both a ratio and an absolute CAC in one plan", () => {
    const s = parsePlanSignals("LTV/CAC 3.5, CAC $600");
    expect(s.ltvCacRatio).toBe(3.5); // stated ratio wins, not the derived one
    expect(s.cacUsd).toBe(600);
  });
  test("gross margin", () => {
    expect(parsePlanSignals("82% gross margin").grossMarginPct).toBe(82);
    expect(parsePlanSignals("gross margin of 72%").grossMarginPct).toBe(72);
  });
  test("payback in months", () => {
    expect(parsePlanSignals("payback of 14 months").paybackMonths).toBe(14);
    expect(parsePlanSignals("8-month payback").paybackMonths).toBe(8);
  });
  test("churn and retention", () => {
    expect(parsePlanSignals("12% monthly churn").churnPct).toBe(12);
    expect(parsePlanSignals("94% net retention").retentionPct).toBe(94);
  });
});

describe("parsePlanSignals — customers, TAM, patents", () => {
  test("customer count with a comma", () => {
    expect(parsePlanSignals("1,200 paying customers").customers).toBe(1200);
  });
  test("bottom-up TAM in billions", () => {
    expect(parsePlanSignals("bottom-up TAM of $6 billion").bottomUpTamUsd).toBe(6_000_000_000);
  });
  test("a granted patent is a moat signal", () => {
    expect(parsePlanSignals("our patent was granted in 2025").mentionsPatent).toBe(true);
  });
  test("a denied patent is NOT a moat signal", () => {
    expect(parsePlanSignals("we have no patents").mentionsPatent).toBe(false);
  });
});

describe("parsePlanSignals — fieldsFound & determinism", () => {
  test("fieldsFound counts only the concrete quantitative fields", () => {
    const s = parsePlanSignals("$40k MRR, LTV/CAC 4.2");
    // revenue + ratio = 2. The spurious cacUsd used to make this 3.
    expect(s.fieldsFound).toBe(2);
  });
  test("empty text yields all-null, no fields", () => {
    const s = parsePlanSignals("");
    expect(s.fieldsFound).toBe(0);
    expect(s.revenueUsd).toBeNull();
  });
  test("the same text parses identically every time", () => {
    const t = "$2.4M ARR, 38% YoY, 120 customers, 94% net retention, LTV/CAC 4.1";
    expect(JSON.stringify(parsePlanSignals(t))).toBe(JSON.stringify(parsePlanSignals(t)));
  });
});
