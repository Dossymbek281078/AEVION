import { describe, test, expect } from "vitest";
import { CASES } from "../scripts/qventure-disclosed";
import { analyze } from "../src/lib/qventure/engine";
import { parsePlanSignals } from "../src/lib/qventure/signals";
import { toUsd } from "../src/lib/metrics/currency";

/**
 * The gate for the disclosed-figures corpus.
 *
 * Every figure in `scripts/qventure-disclosed.ts` is one a real company put in a
 * real public document. Six of them were silently unreadable when the corpus was
 * first run — a negative gross margin, a net dollar expansion rate, a membership
 * count, a reservation book, units delivered — and each miss meant the engine
 * scored a filed disclosure as "nothing disclosed" and fell back to the sector
 * average. That is the failure mode this module keeps rediscovering: not a
 * crash, a quiet substitution of the sector prior for the company's own number.
 *
 * These tests pin the readers so a future rubric edit cannot re-break them
 * without CI saying so.
 */

const signalsFor = (i: { description: string; tractionNotes?: string }) =>
  parsePlanSignals(`${i.description} ${i.tractionNotes ?? ""}`);

describe("real filing figures are actually read", () => {
  for (const c of CASES) {
    if (!c.expect.length) continue;
    describe(`${c.input.name} — ${c.round}`, () => {
      const s = signalsFor(c.input);
      for (const e of c.expect) {
        test(e.label, () => {
          const actual = e.read(s);
          if (typeof e.expected === "boolean") {
            expect(actual).toBe(e.expected);
          } else if (e.expected === 0) {
            // "nothing to find here" — the figure must NOT be invented.
            expect(actual === null || actual === 0).toBe(true);
          } else {
            expect(typeof actual).toBe("number");
            expect(Math.abs((actual as number) - e.expected)).toBeLessThanOrEqual(
              Math.abs(e.expected) * (e.tol ?? 0.02),
            );
          }
        });
      }
    });
  }
});

describe("a negative gross margin is read at its sign, not its magnitude", () => {
  // Four spellings, all used in filings and press. Before the fix every one of
  // them parsed to null and the company was scored on the sector prior.
  for (const text of [
    "Gross margin of -45%.",
    "Gross margin of (45)%.",
    "Gross margin of negative 45%.",
    "Gross margin -45%.",
  ]) {
    test(text, () => {
      expect(parsePlanSignals(text).grossMarginPct).toBe(-45);
    });
  }

  // Reading the sign introduces the mirror-image risk: turning ordinary prose
  // punctuation into a minus and flipping a healthy margin negative. These pin
  // the cases where a dash is NOT a sign.
  test("an en/em dash before the figure is punctuation, not a minus", () => {
    expect(parsePlanSignals("Gross margin — 45%.").grossMarginPct).toBeNull();
    expect(parsePlanSignals("Gross margin – 45%.").grossMarginPct).toBeNull();
  });
  test("a range separator is not a minus", () => {
    expect(parsePlanSignals("70-80% gross margin.").grossMarginPct).toBe(70);
    expect(parsePlanSignals("Gross margin of 70-80%.").grossMarginPct).toBe(70);
  });
  test("an ordinary positive margin is unaffected", () => {
    expect(parsePlanSignals("Gross margin of 45%.").grossMarginPct).toBe(45);
    expect(parsePlanSignals("80% gross margin.").grossMarginPct).toBe(80);
  });

  test("the sign reaches the composite, it does not stop at the parser", () => {
    // Same company, same words, one character different. If the score does not
    // move, the parser fix is cosmetic — this is the discriminating assertion.
    const base = {
      name: "Margin probe", sector: "climate", stage: "growth" as const, geography: "US",
      askUsd: 300_000_000,
      description: "Thin-film solar panels manufactured in a company-owned plant.",
    };
    const negative = analyze({ ...base, tractionNotes: "Revenue of $100M in 2009. Gross margin of -45%." });
    const positive = analyze({ ...base, tractionNotes: "Revenue of $100M in 2009. Gross margin of 45%." });
    expect(negative.composite).toBeLessThan(positive.composite);
  });
});

describe("expansion and retention are the same disclosure under different names", () => {
  for (const [text, expected] of [
    ["Net dollar expansion rate 140%.", 140],
    ["Dollar-based net retention rate of 130%.", 130],
    ["Net revenue retention rate of 158%.", 158],
    ["NDR of 120%.", 120],
  ] as const) {
    test(text, () => {
      expect(parsePlanSignals(text).retentionPct).toBe(expected);
    });
  }
});

describe("filings name revenue in the plural, and sometimes call it sales", () => {
  // "revenue" matched inside "revenues" and then failed on the trailing "s", so
  // the most standard phrasing in the corpus dropped the figure entirely.
  for (const [text, expected] of [
    ["Net revenues of $87.9M in 2018.", 87_900_000],
    ["Net sales of $423M in 2019.", 423_000_000],
    ["Revenue of $1.54B in the first half of 2019.", 1_540_000_000],
    ["$2M ARR.", 2_000_000],
  ] as const) {
    test(text, () => {
      expect(parsePlanSignals(text).revenueUsd).toBe(expected);
    });
  }
});

describe("a margin stated as a share of revenue is still a margin", () => {
  test("gross profit of $17.6 million, or 20% of net revenue", () => {
    const s = parsePlanSignals("Gross profit of $17.6 million, or 20% of net revenue.");
    expect(s.grossMarginPct).toBe(20);
    // Gross profit is not revenue — the same sentence must not set both.
    expect(s.revenueUsd).toBeNull();
  });
});

describe("customers are not always called customers", () => {
  for (const [text, expected] of [
    ["Approximately 527,000 memberships.", 527_000],
    ["162,261 merchants on the platform.", 162_261],
    ["4,200 active sellers.", 4_200],
    ["511,202 Connected Fitness Subscribers.", 511_202],
    ["1,200 paying enterprise customers.", 1_200],
  ] as const) {
    test(text, () => {
      expect(parsePlanSignals(text).customers).toBe(expected);
    });
  }

  // Allowing qualifier words between the count and the noun creates the risk of
  // swallowing a money figure from a different clause. These pin the guards.
  test("a spend figure in another clause is not a customer count", () => {
    expect(parsePlanSignals("$144.1 million on marketing to acquire customers.").customers).toBeNull();
  });
  test("a per-customer figure is not a customer count", () => {
    expect(parsePlanSignals("Spent $5 million per customer.").customers).toBeNull();
  });
});

describe("a reservation book is disclosed, never credited", () => {
  const s = parsePlanSignals(
    "Approximately 14,000 reservations for fuel-cell trucks, of which up to 800 are subject to a binding commitment. No truck revenue recognised.",
  );

  test("the count is read", () => {
    expect(s.reservations).toBe(14_000);
  });
  test("it is not read as contracted revenue", () => {
    expect(s.contractedRevenueUsd).toBeNull();
  });
  test("it is not read as deployments", () => {
    expect(s.pilots).toBeNull();
  });
  test("it does not count toward disclosure coverage", () => {
    // Coverage claims a share of the composite is backed by the company's own
    // numbers. Reservations back no factor, so counting them would overstate it.
    expect(s.fieldsFound).toBe(0);
  });
  test("the reader is told it is uncommitted", () => {
    const r = analyze({
      name: "Reservation probe", sector: "climate", stage: "growth", geography: "US",
      description: "Hydrogen fuel-cell heavy trucks sold with the fuelling infrastructure.",
      tractionNotes: "Approximately 14,000 reservations. No revenue recognised.",
    });
    expect(r.redFlags.some((f) => /reservations \/ pre-orders/i.test(f))).toBe(true);
  });
});

describe("a marketplace's headline number outside US filings", () => {
  // v5 claimed money is read in the currency it was quoted in; that had never
  // met a real filing quoting pounds. Two things had to hold at once, and only
  // one did: the currency was detected, the noun was not.
  const s = parsePlanSignals("Gross transaction value of £4.1bn in 2020, up 64.3% from £2.5bn in 2019.");

  test("the pound is detected", () => {
    expect(s.currency).toBe("GBP");
  });
  test("gross transaction value is GMV under another name", () => {
    expect(s.gmvUsd).toBe(toUsd(4_100_000_000, "GBP"));
  });
  test("it is converted, not passed through as if it were dollars", () => {
    expect(s.gmvUsd).toBeGreaterThan(4_100_000_000);
  });
  test("GTV as an initialism reads the same", () => {
    expect(parsePlanSignals("GTV of $2.5B in 2024.").gmvUsd).toBe(2_500_000_000);
  });
});

describe("units delivered to customers count as deployments", () => {
  test("937 Roadsters sold to customers", () => {
    expect(parsePlanSignals("937 Roadsters sold to customers in 18 countries.").pilots).toBe(937);
  });
  test("production capacity is not demand", () => {
    // "16 GWh of installed capacity" must not become a deployment count.
    expect(parsePlanSignals("The plant has 16 GWh of installed capacity.").pilots).toBeNull();
  });
});

describe("the corpus as a whole", () => {
  const scored = CASES.map((c) => ({ ...c, r: analyze(c.input) }));
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const failed = scored.filter((c) => c.outcome === "failed").map((c) => c.r.composite);
  const succeeded = scored.filter((c) => c.outcome === "succeeded").map((c) => c.r.composite);

  test("every stated figure is recovered", () => {
    const missed: string[] = [];
    for (const c of CASES) {
      const s = signalsFor(c.input);
      for (const e of c.expect) {
        const a = e.read(s);
        const ok = typeof e.expected === "boolean" ? a === e.expected
          : e.expected === 0 ? (a === null || a === 0)
            : typeof a === "number" && Math.abs(a - e.expected) <= Math.abs(e.expected) * (e.tol ?? 0.02);
        if (!ok) missed.push(`${c.input.name}: ${e.label} → ${String(a)}`);
      }
    }
    expect(missed).toEqual([]);
  });

  test("disclosed evidence separates the two groups by at least 6 points", () => {
    // A floor well under the measured gap (12.6 at the time of writing), set to
    // catch a change that COLLAPSES discrimination, not one that moves it.
    expect(mean(succeeded) - mean(failed)).toBeGreaterThanOrEqual(6);
  });

  test("a large ask with no disclosure at all cannot reach 'watch'", () => {
    const control = scored.find((c) => c.disclosureFree);
    expect(control).toBeDefined();
    expect(control!.r.strategy.verdict).toBe("pass");
  });
});

describe("structured input is not worse than typing it in a sentence", () => {
  const base = {
    name: "Structured probe", sector: "climate", stage: "growth" as const, geography: "US",
    askUsd: 300_000_000,
    description: "Thin-film solar panels manufactured in a company-owned plant.",
    tractionNotes: "Revenue of $100M in 2009.",
  };

  test("a below-cost margin supplied as an exact figure survives to the score", () => {
    // Two guards in series both rejected negatives (`sanitizeFinancials` in the
    // route and `numOrNull` in the merge), so a client sending the precise
    // number -45 lost it while a client writing "-45%" in prose kept it.
    const structured = analyze({ ...base, financials: { grossMarginPct: -45 } });
    expect(structured.signals.grossMarginPct).toBe(-45);
    const positive = analyze({ ...base, financials: { grossMarginPct: 45 } });
    expect(structured.composite).toBeLessThan(positive.composite);
  });

  test("the prose path and the exact path agree", () => {
    const typed = analyze({ ...base, tractionNotes: "Revenue of $100M in 2009. Gross margin of -45%." });
    const exact = analyze({ ...base, financials: { grossMarginPct: -45 } });
    expect(exact.composite).toBe(typed.composite);
  });
});

describe("a figure that moves the score is named in the report", () => {
  // Retention added up to 6 points to execution and appeared nowhere in the
  // report — the reader saw the points and not the reason. Found by sweeping
  // every parsed field against everything a human can actually see, which is
  // the same sweep that found the reservation count missing from the exports.
  const withRetention = analyze({
    name: "Retention probe", sector: "saas", stage: "growth", geography: "US",
    description: "Observability platform sold bottom-up to engineering teams.",
    tractionNotes: "Revenue of $198.1M in 2018. Net revenue retention 146%.",
  });

  test("retention is parsed", () => {
    expect(withRetention.signals.retentionPct).toBe(146);
  });

  test("retention is named in a factor rationale", () => {
    const visible = withRetention.factors.map((f) => f.rationale).join(" ");
    expect(visible).toMatch(/146%\s*net revenue retention/i);
  });

  test("it still moves the score, so the note describes real points", () => {
    const without = analyze({
      name: "Retention probe", sector: "saas", stage: "growth", geography: "US",
      description: "Observability platform sold bottom-up to engineering teams.",
      tractionNotes: "Revenue of $198.1M in 2018.",
    });
    expect(withRetention.composite).toBeGreaterThan(without.composite);
  });
});
