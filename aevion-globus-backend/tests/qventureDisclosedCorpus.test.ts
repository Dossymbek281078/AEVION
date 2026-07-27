import { describe, test, expect } from "vitest";
import { CASES } from "../scripts/qventure-disclosed";
import { analyze } from "../src/lib/qventure/engine";
import { parsePlanSignals, metricStatedAsIntention } from "../src/lib/qventure/signals";
import { PAIRS } from "../scripts/qventure-hardcases";
import fs from "node:fs";
import path from "node:path";
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

describe("no parsed figure is invisible to the reader", () => {
  /**
   * Two defects in one window had the same shape: a figure the engine read and
   * scored, that no human could see. Reservations were missing from both the
   * on-screen evidence list and the exported memo; retention added up to six
   * points and was named nowhere. Both were found by hand, and a third would
   * have been found by hand too — after shipping.
   *
   * This is that sweep as a gate. Every quantitative field the parser fills
   * must be accounted for: either named in the prose a reader sees (factor
   * rationales, assumptions, red flags, stress and TAM panels), or listed below
   * as rendered by the evidence panel, which both surfaces build field by
   * field. A field added to the parser and to nothing else fails here with the
   * name of the field, which is the message that was missing.
   */

  // Rendered by EvidencePanel (frontend/src/app/qventure/_result.tsx) and by the
  // matching block in the PDF export (src/routes/qventure.ts). Adding a field
  // here without adding it to BOTH of those is the bug this list exists to make
  // visible, so keep them in step.
  const RENDERED_BY_EVIDENCE_PANEL = new Set([
    "revenueUsd", "gmvUsd", "takeRatePct", "contractedRevenueUsd",
    "nonDilutiveUsd", "pilots", "reservations", "capacityDeployedMw", "churnPct",
  ]);
  // Shown through a figure derived from them: LTV/CAC and payback are both
  // rendered, and each is a stated function of these two.
  const SHOWN_VIA_DERIVED = new Set(["cacUsd", "ltvUsd"]);

  const probe = analyze({
    name: "Full disclosure probe", sector: "saas", stage: "growth", geography: "US",
    askUsd: 50_000_000,
    description: "Observability platform sold bottom-up to engineering teams.",
    tractionNotes:
      "Revenue of $198.1M in 2018, up 97% year over year. Gross margin 77%. " +
      "Net revenue retention 146%. 12,000 customers. CAC of $9,000. LTV of $45,000. " +
      "Payback of 14 months. 3% annual churn. Bottom-up TAM of $12B. GMV of $400M at a 9% take rate. " +
      "Contracted backlog of $60M. $4M non-dilutive. 11 deployments. 14,000 reservations.",
  });

  const visible = [
    ...probe.factors.map((f) => `${f.label} ${f.rationale}`),
    ...probe.assumptions,
    ...probe.redFlags,
    JSON.stringify(probe.stress),
    JSON.stringify(probe.tam),
    JSON.stringify(probe.strategy),
  ].join(" | ").toLowerCase();

  // DERIVED from what the probe actually parsed, never hand-listed. A hardcoded
  // list is the same hole this gate exists to close: `reservations` was added to
  // the parser and to nothing else, and a list someone has to remember to update
  // would have missed it in exactly the same way. Anything numeric the parser
  // fills is checked automatically.
  const META_FIELDS = new Set([
    "fieldsFound",      // a count of the others, not a disclosure
    "churnMonthlyPct",  // the normalized form of churnPct, shown with it
  ]);
  const QUANT_FIELDS = Object.entries(probe.signals)
    .filter(([k, v]) => typeof v === "number" && !META_FIELDS.has(k))
    .map(([k]) => k);

  test("the probe discloses a broad set of fields, or this gate proves nothing", () => {
    // A probe that stopped parsing would leave nothing to check and go green.
    expect(QUANT_FIELDS.length).toBeGreaterThanOrEqual(17);
  });

  for (const key of QUANT_FIELDS) {
    test(`${key} is visible somewhere`, () => {
      const v = (probe.signals as unknown as Record<string, number | null>)[key];
      if (v === null) return;
      if (RENDERED_BY_EVIDENCE_PANEL.has(key) || SHOWN_VIA_DERIVED.has(key)) return;
      const named = visible.includes(String(v)) || visible.includes(String(Math.round(Math.abs(v))));
      expect(named, `${key} = ${v} is parsed and scored but appears in nothing a reader sees. Name it in a factor rationale, or render it and add it to RENDERED_BY_EVIDENCE_PANEL.`).toBe(true);
    });
  }
});

describe("a disclosed decline is not growth", () => {
  // The worst reading found in this window: "revenue declined 20% year over
  // year" parsed as +20 and scored identically to 20% growth, because the bare
  // "<n>% year-over-year" pattern never looked at the verb in front of it. Not
  // a dropped figure — an inverted one, always in the company's favour.
  for (const text of [
    "Revenue declined 20% year over year.",
    "Revenue of $10M, down 20% year over year.",
    "Revenue decreased 20% year over year.",
  ]) {
    test(text, () => {
      expect(parsePlanSignals(text).growthPct).toBe(-20);
    });
  }
  test("growth still reads positive", () => {
    expect(parsePlanSignals("Revenue of $10M, up 20% year over year.").growthPct).toBe(20);
    expect(parsePlanSignals("Growing 97% year over year.").growthPct).toBe(97);
  });

  test("declining scores below saying nothing, which scores below growing", () => {
    const base = { name: "g", sector: "saas", stage: "growth" as const, geography: "US", description: "Observability platform." };
    const silent = analyze({ ...base, tractionNotes: "Revenue of $10M." });
    const down = analyze({ ...base, tractionNotes: "Revenue of $10M, down 20% year over year." });
    const up = analyze({ ...base, tractionNotes: "Revenue of $10M, up 20% year over year." });
    expect(down.composite).toBeLessThan(silent.composite);
    expect(silent.composite).toBeLessThan(up.composite);
  });

  test("the decline is named, not just charged", () => {
    const base = { name: "g", sector: "saas", stage: "growth" as const, geography: "US", description: "Observability platform." };
    const down = analyze({ ...base, tractionNotes: "Revenue of $10M, down 20% year over year." });
    expect(down.factors.some((f) => /declining 20%/i.test(f.rationale))).toBe(true);
  });
});

describe("a level stated after a direction verb", () => {
  /**
   * "Churn fell to 3%", "retention declined to 85%", "margin improved to 62%" —
   * filings say which way a number moved constantly, and every metric pattern
   * accepted `of / = / : / at` between the name and the figure while none
   * accepted this. Seven fields out of eight dropped the number outright.
   *
   * Fixed with one shared connector rather than seven patterns, because seven
   * near-identical regexes drift apart and this family is exactly what drift
   * looks like.
   */
  const cases: Array<[string, string, number]> = [
    ["Churn fell to 3% monthly, down from 8%.", "churnPct", 3],
    ["Churn improved from 8% to 3% monthly.", "churnPct", 3],
    ["Churn declined to 3% monthly.", "churnPct", 3],
    ["Net revenue retention declined to 85%.", "retentionPct", 85],
    ["Net revenue retention improved to 130%.", "retentionPct", 130],
    ["Retention improved from 85% to 130%.", "retentionPct", 130],
    ["Gross margin declined to 20%.", "grossMarginPct", 20],
    ["Gross margin improved to 62%.", "grossMarginPct", 62],
    ["Take rate declined to 9%.", "takeRatePct", 9],
    ["Customers fell to 900 from 1,200.", "customers", 900],
    ["Customers grew to 12,000.", "customers", 12_000],
    ["LTV/CAC fell to 0.8.", "ltvCacRatio", 0.8],
    ["Payback lengthened to 26 months.", "paybackMonths", 26],
    ["Payback shortened to 6 months.", "paybackMonths", 6],
    ["Revenue fell to $5M in 2024.", "revenueUsd", 5_000_000],
    ["Revenue grew to $10M.", "revenueUsd", 10_000_000],
  ];
  for (const [text, field, expected] of cases) {
    test(`${field}: ${text}`, () => {
      expect((parsePlanSignals(text) as unknown as Record<string, number | null>)[field]).toBe(expected);
    });
  }

  test("in 'from X to Y' the current value is Y", () => {
    // Reading X would report the number the company moved AWAY from, as fact.
    expect(parsePlanSignals("Churn improved from 8% to 3% monthly.").churnPct).toBe(3);
    expect(parsePlanSignals("Retention improved from 85% to 130%.").retentionPct).toBe(130);
  });

  test("two metrics in one sentence keep their own figures", () => {
    const s = parsePlanSignals("Gross margin declined to 20% and churn rose to 7% monthly.");
    expect(s.grossMarginPct).toBe(20);
    expect(s.churnPct).toBe(7);
  });

  // Over-match guards. A direction verb is common prose, so the connector must
  // stay anchored to the metric's own name.
  test("a direction verb on something that is not a metric reads nothing", () => {
    expect(parsePlanSignals("The team grew to 40 people.").customers).toBeNull();
    expect(parsePlanSignals("Headcount fell to 900.").customers).toBeNull();
  });
  test("the plain forms are untouched", () => {
    expect(parsePlanSignals("3% annual churn.").churnPct).toBe(3);
    expect(parsePlanSignals("Net revenue retention 146%.").retentionPct).toBe(146);
    expect(parsePlanSignals("12,000 customers.").customers).toBe(12_000);
    expect(parsePlanSignals("Gross margin of -45%.").grossMarginPct).toBe(-45);
    expect(parsePlanSignals("70-80% gross margin.").grossMarginPct).toBe(70);
    expect(parsePlanSignals("GMV of $180M annualized with a 14% take rate.").takeRatePct).toBe(14);
  });
  test("a denial is still a denial", () => {
    expect(parsePlanSignals("No churn figure is disclosed.").churnPct).toBeNull();
  });
});

describe("a growth rate knows what grew", () => {
  /**
   * Affirm's S-1 states GMV up 77% and revenue up 93% in consecutive sentences.
   * Taking the first match reported 77% as the company's revenue growth — one
   * metric's number under another metric's name. That is a wrong figure, not a
   * missing one, and it is the second inversion-class defect the corpus found.
   */
  const affirm = parsePlanSignals(
    "GMV of $4.6B in the fiscal year ended 30 June 2020, up 77% year over year. Revenue of $509.5M, up 93% year over year.",
  );

  test("the revenue-attached rate wins when several are disclosed", () => {
    expect(affirm.growthPct).toBe(93);
    expect(affirm.growthBasis).toBe("revenue");
  });

  test("a rate attached to volume keeps its own name instead of borrowing revenue's", () => {
    const s = parsePlanSignals("Gross transaction value of £4.1bn in 2020, up 64.3% from £2.5bn in 2019.");
    expect(s.growthPct).toBe(64.3);
    expect(s.growthBasis).toBe("gmv");
  });

  test("the report says which metric grew", () => {
    // Printing only "64.3% growth" would hide that it is volume, not revenue.
    const r = analyze({
      name: "Basis probe", sector: "marketplace", stage: "growth", geography: "UK",
      description: "Three-sided food delivery marketplace.",
      tractionNotes: "Gross transaction value of £4.1bn in 2020, up 64.3% from £2.5bn in 2019.",
    });
    expect(r.factors.map((f) => f.rationale).join(" ")).toMatch(/64\.3%.*GMV growth/i);
  });

  test("an ordinary single disclosure is unchanged and attributed to revenue", () => {
    const s = parsePlanSignals("Revenue of $198.1M in 2018, up 97% year over year.");
    expect(s.growthPct).toBe(97);
    expect(s.growthBasis).toBe("revenue");
  });

  test("a decline keeps both its sign and its basis", () => {
    const s = parsePlanSignals("Revenue of $10M, down 20% year over year.");
    expect(s.growthPct).toBe(-20);
    expect(s.growthBasis).toBe("revenue");
  });

  test("processed volume is GMV under the name a European payments filing uses", () => {
    expect(parsePlanSignals("Processed volume of $108B in 2017.").gmvUsd).toBe(108_000_000_000);
  });
});

describe("filings that are not American, not software, and not yet true", () => {
  // Three families found by adding an insurer, a Chinese marketplace and a
  // European payments company to the corpus.

  test("a currency code written against the digits still marks the currency", () => {
    // "RMB52,504 million" — the code patterns required a word boundary AFTER
    // themselves, which a digit does not provide, so the marker vanished and
    // the figure was read as dollars or not at all. Same for USD8,463, EUR218.
    const rmb = parsePlanSignals("Revenue of RMB52,504 million in the fiscal year ended 31 March 2014.");
    expect(rmb.currency).toBe("CNY");
    expect(rmb.revenueUsd).toBe(toUsd(52_504_000_000, "CNY"));
    expect(parsePlanSignals("Revenue of USD8,463 million in fiscal 2014.").revenueUsd).toBe(8_463_000_000);
    expect(parsePlanSignals("Revenue of EUR218 million in 2017.").revenueUsd).toBe(toUsd(218_000_000, "EUR"));
  });

  test("an insurer's top line and its customers have their own names", () => {
    const s = parsePlanSignals("In-force premium of $116M in 2019. 730,000 policyholders as of 31 March 2020.");
    expect(s.revenueUsd).toBe(116_000_000);
    expect(s.customers).toBe(730_000);
  });

  test("the larger side of a two-sided marketplace is not swapped for the smaller", () => {
    // Alibaba disclosed 279M active buyers and 8.5M active sellers. "buyers"
    // was not a customer noun, so the parser skipped to "sellers" and reported
    // 8.5M as the customer count — a wrong number, not a missing one.
    const s = parsePlanSignals("279 million active buyers and 8.5 million active sellers.");
    expect(s.customers).toBe(279_000_000);
  });

  test("a target is not traction", () => {
    // "We target $20M ARR next year" was read as $20M of current revenue.
    expect(parsePlanSignals("Projected revenue of $100M in 2030.").revenueUsd).toBeNull();
    expect(parsePlanSignals("The company expects $50M in revenue by 2027.").revenueUsd).toBeNull();
  });

  test("but the real figure in the next sentence survives the target", () => {
    // The forward test is clause-bounded; a 60-character lookback crossed the
    // sentence and suppressed the actual disclosure too, trading one wrong
    // reading for another.
    expect(parsePlanSignals("We target $20M ARR next year. Revenue of $5M today.").revenueUsd).toBe(5_000_000);
    expect(parsePlanSignals("The company expects $50M in revenue by 2027. Revenue of $8M in 2026.").revenueUsd).toBe(8_000_000);
  });

  test("two contradictory revenue figures are flagged in the ordinary phrasing too", () => {
    // The contradiction check knew only "$5M ARR" and never "ARR of $5M" — the
    // form the parser itself has always supported — so a plan stating two
    // different figures the normal way raised nothing.
    expect(parsePlanSignals("ARR of $5M. ARR of $8M.").conflicts.length).toBe(1);
    expect(parsePlanSignals("$5M ARR. $8M ARR.").conflicts.length).toBe(1);
    // A prior-year comparison is not a contradiction.
    expect(parsePlanSignals("Revenue of $198.1M in 2018, up 97% year over year from $100.8M in 2017.").conflicts.length).toBe(0);
  });
});

describe("when a plan discloses two periods, the later one is the company", () => {
  /**
   * Lemonade's S-1 states in-force premium of $116M for 2019 and $133M as of
   * Q1 2020. Both are true. Scoring 2019 because it appeared first in the text
   * was an accident of `firstMatch`, not a reading — and the 14.7% gap sits
   * under the threshold that treats a difference as rounding, so nothing was
   * flagged either.
   */
  test("the later disclosed period wins", () => {
    const s = parsePlanSignals("In-force premium of $116M in 2019. In-force premium of $133M as of 31 March 2020.");
    expect(s.revenueUsd).toBe(133_000_000);
  });

  test("and the reader is told the choice was made", () => {
    const s = parsePlanSignals("In-force premium of $116M in 2019. In-force premium of $133M as of 31 March 2020.");
    expect(s.parseNotes.some((n) => /latest \(2020\)/i.test(n))).toBe(true);
  });

  test("a prior-year comparison is not a second period to choose from", () => {
    // "from $100.8M in 2017" is context for the growth rate, not a competing
    // disclosure — it is not attached to a revenue noun and never was a candidate.
    const s = parsePlanSignals("Revenue of $198.1M in 2018, up 97% year over year from $100.8M in 2017.");
    expect(s.revenueUsd).toBe(198_100_000);
    expect(s.parseNotes.some((n) => /latest/i.test(n))).toBe(false);
  });

  test("undated figures keep the old ordering, and still raise the contradiction", () => {
    const s = parsePlanSignals("ARR of $5M. ARR of $8M.");
    expect(s.revenueUsd).toBe(5_000_000);
    expect(s.conflicts.length).toBe(1);
  });

  test("a single disclosure is untouched", () => {
    expect(parsePlanSignals("Revenue of $10M.").revenueUsd).toBe(10_000_000);
    expect(parsePlanSignals("Revenue of $10M.").parseNotes.length).toBe(0);
  });
});

describe("every metric reads its latest disclosed period, not its first typed", () => {
  /**
   * The revenue fix was one field. `firstMatch` was used by all of them, so
   * "churn of 8% in 2019, churn of 3% in 2020" scored 8% — a figure the same
   * document supersedes two sentences later. All eight metric fields did this.
   * Direction was arbitrary: for churn and payback the stale figure was the
   * harsher one, for margin, retention, customers, GMV and backlog the kinder.
   * Either way it is not what the plan says about itself today.
   */
  const cases: Array<[string, string, number]> = [
    ["Churn of 8% monthly in 2019. Churn of 3% monthly in 2020.", "churnPct", 3],
    ["Gross margin of 40% in 2019. Gross margin of 62% in 2020.", "grossMarginPct", 62],
    ["Net revenue retention of 110% in 2019. Net revenue retention of 146% in 2020.", "retentionPct", 146],
    ["12,000 customers in 2019. 30,000 customers in 2020.", "customers", 30_000],
    ["GMV of $100M in 2019. GMV of $400M in 2020.", "gmvUsd", 400_000_000],
    ["Payback of 26 months in 2019. Payback of 14 months in 2020.", "paybackMonths", 14],
    ["Take rate of 9% in 2019. Take rate of 14% in 2020.", "takeRatePct", 14],
    ["Contracted backlog of $20M in 2019. Contracted backlog of $60M in 2020.", "contractedRevenueUsd", 60_000_000],
  ];
  for (const [text, field, expected] of cases) {
    test(`${field} takes the later period`, () => {
      expect((parsePlanSignals(text) as unknown as Record<string, number | null>)[field]).toBe(expected);
    });
  }

  // Identical to the previous behaviour unless two matches carry different
  // years, so the conservative-end rules for ranges and the plain single
  // disclosures must be untouched.
  test("ranges still take their conservative end", () => {
    expect(parsePlanSignals("2-3% monthly churn.").churnPct).toBe(3);
    expect(parsePlanSignals("9-12 months payback.").paybackMonths).toBe(12);
    expect(parsePlanSignals("70-80% gross margin.").grossMarginPct).toBe(70);
  });
  test("single disclosures are unchanged", () => {
    expect(parsePlanSignals("3% annual churn.").churnPct).toBe(3);
    expect(parsePlanSignals("GMV of $180M annualized with a 14% take rate.").gmvUsd).toBe(180_000_000);
    expect(parsePlanSignals("Gross margin of -45%.").grossMarginPct).toBe(-45);
  });
  test("the reader is told when a later period was chosen", () => {
    const s = parsePlanSignals("Churn of 8% monthly in 2019. Churn of 3% monthly in 2020.");
    expect(s.parseNotes.some((n) => /latest \(2020\)/i.test(n))).toBe(true);
  });
});

describe("a stated band is read, and read at the end that is worse for the plan", () => {
  /**
   * Seven fields already resolved a band to its conservative end. Six did not,
   * and two of those were not misses but magnitude errors: "GMV of $100-150M"
   * matched the single-figure pattern on "$100" while the "M" stayed attached
   * to 150, so the engine recorded a GMV of one hundred dollars. Backlog did
   * the same. Growth and the customer count read their FLATTERING end, against
   * the rule every other band follows; retention and take rate were dropped
   * entirely.
   */
  const cases: Array<[string, string, number]> = [
    ["GMV of $100-150M in 2024.", "gmvUsd", 100_000_000],
    ["Contracted backlog of $20-60M.", "contractedRevenueUsd", 20_000_000],
    ["Net revenue retention of 110-130%.", "retentionPct", 110],
    ["Take rate of 9-14%.", "takeRatePct", 9],
    ["12,000-15,000 customers.", "customers", 12_000],
    ["Growing 20-40% year over year.", "growthPct", 20],
  ];
  for (const [text, field, expected] of cases) {
    test(`${field}: ${text}`, () => {
      expect((parsePlanSignals(text) as unknown as Record<string, number | null>)[field]).toBe(expected);
    });
  }

  test("the multiplier reaches both ends of a money band", () => {
    // The specific defect: one hundred million, not one hundred.
    expect(parsePlanSignals("GMV of $100-150M in 2024.").gmvUsd).toBeGreaterThan(1_000_000);
    expect(parsePlanSignals("Contracted backlog of $20-60M.").contractedRevenueUsd).toBeGreaterThan(1_000_000);
  });

  test("the bands that already worked still resolve the same way", () => {
    expect(parsePlanSignals("Revenue of $10-15M in 2024.").revenueUsd).toBe(10_000_000);
    expect(parsePlanSignals("Gross margin of 70-80%.").grossMarginPct).toBe(70);
    expect(parsePlanSignals("CAC of $8-12k.").cacUsd).toBe(12_000);
    expect(parsePlanSignals("LTV of $40-60k.").ltvUsd).toBe(40_000);
    expect(parsePlanSignals("Payback of 9-12 months.").paybackMonths).toBe(12);
    expect(parsePlanSignals("Churn of 2-3% monthly.").churnPct).toBe(3);
    expect(parsePlanSignals("LTV/CAC of 3-5x.").ltvCacRatio).toBe(3);
  });

  test("single figures are untouched by the new band readers", () => {
    expect(parsePlanSignals("Net revenue retention 146%.").retentionPct).toBe(146);
    expect(parsePlanSignals("GMV of $180M annualized with a 14% take rate.").takeRatePct).toBe(14);
    expect(parsePlanSignals("12,000 customers.").customers).toBe(12_000);
    expect(parsePlanSignals("Revenue of $198.1M in 2018, up 97% year over year.").growthPct).toBe(97);
    expect(parsePlanSignals("Revenue of $10M, down 20% year over year.").growthPct).toBe(-20);
  });

  test("every band states its choice to the reader", () => {
    for (const [text] of cases) {
      expect(parsePlanSignals(text).parseNotes.some((n) => /range/i.test(n))).toBe(true);
    }
  });
});

describe("a rate's period and a duration's unit are read, not assumed", () => {
  /**
   * The repository already has machinery for this on churn — "4% annual" is
   * excellent and "4% monthly" is a company bleeding out. It covered the period
   * word BEFORE the figure and the "per year" form after it, and missed the
   * bare adverb that is the most natural phrasing of all.
   */
  test("a period adverb after the figure is read", () => {
    for (const [text, monthly] of [
      ["Churn of 24% annually.", 2.26],
      ["Churn of 24% yearly.", 2.26],
      ["Churn rate of 24% annualised.", 2.26],
      ["Churn of 24% a year.", 2.26],
    ] as const) {
      const s = parsePlanSignals(text);
      expect(s.churnPeriod).toBe("annual");
      expect(s.churnMonthlyPct).toBeCloseTo(monthly, 1);
    }
  });

  test("24% a year is not scored as 24% a month", () => {
    // The whole point: a normal annual churn was being charged as catastrophic.
    const annual = parsePlanSignals("Churn of 24% annually.").churnMonthlyPct as number;
    const monthly = parsePlanSignals("Churn of 24% monthly.").churnMonthlyPct as number;
    expect(annual).toBeLessThan(monthly / 5);
  });

  test("the existing phrasings are unchanged", () => {
    expect(parsePlanSignals("3% annual churn.").churnPeriod).toBe("annual");
    expect(parsePlanSignals("Churn of 2% monthly.").churnMonthlyPct).toBe(2);
    expect(parsePlanSignals("2-3% monthly churn.").churnPct).toBe(3);
    expect(parsePlanSignals("Churn of 5%.").churnPeriod).toBe("unspecified");
  });

  test("payback stated in years is converted, not dropped", () => {
    expect(parsePlanSignals("Payback of 2 years.").paybackMonths).toBe(24);
    expect(parsePlanSignals("Payback period of 1.5 years.").paybackMonths).toBe(18);
    expect(parsePlanSignals("Payback of 2 years.").parseNotes.some((n) => /2 years.*24 months/i.test(n))).toBe(true);
  });

  test("payback in months is unchanged, bands included", () => {
    expect(parsePlanSignals("Payback of 18 months.").paybackMonths).toBe(18);
    expect(parsePlanSignals("14-month payback.").paybackMonths).toBe(14);
    expect(parsePlanSignals("9-12 months payback.").paybackMonths).toBe(12);
  });

  test("a denial is never adopted as a figure", () => {
    // Checked across the fields at the same time; recorded because it came back
    // clean, which is worth knowing rather than assuming.
    expect(parsePlanSignals("We do not disclose gross margin; the industry average is 70%.").grossMarginPct).toBeNull();
    expect(parsePlanSignals("No revenue yet. The market is $12B.").revenueUsd).toBeNull();
    expect(parsePlanSignals("No customers yet.").customers).toBeNull();
    expect(parsePlanSignals("No signed backlog. Pipeline discussions only.").contractedRevenueUsd).toBeNull();
    expect(parsePlanSignals("We have not disclosed churn.").churnPct).toBeNull();
  });
});

describe("the top line stated monthly is annualized, however it is written", () => {
  // "MRR of $500k" was recognised; "monthly recurring revenue of $500k" and
  // "revenue of $500k per month" were not, and both parsed as $500k of ANNUAL
  // revenue — the same figure understated twelvefold, on the phrasing an
  // early-stage plan is most likely to use.
  for (const text of [
    "MRR of $500k.",
    "$500k MRR.",
    "Monthly recurring revenue of $500k.",
    "Revenue of $500k per month.",
    "Revenue of $500k/mo.",
  ]) {
    test(text, () => {
      const s = parsePlanSignals(text);
      expect(s.revenueUsd).toBe(6_000_000);
      expect(s.revenueBasis).toBe("MRR");
    });
  }

  test("annual phrasings are not multiplied", () => {
    expect(parsePlanSignals("ARR of $6M.").revenueUsd).toBe(6_000_000);
    expect(parsePlanSignals("Revenue of $6M.").revenueUsd).toBe(6_000_000);
    expect(parsePlanSignals("Annual recurring revenue of $6M.").revenueUsd).toBe(6_000_000);
  });

  test("the annualization is stated to the reader", () => {
    expect(parsePlanSignals("Monthly recurring revenue of $500k.").parseNotes.some((n) => /annualized/i.test(n))).toBe(true);
  });
});

describe("a plan that disagrees with itself says so on every metric, not just revenue", () => {
  // `detectRevenueConflict` guarded one field. Two different margins, churns or
  // customer counts scored one of them and said nothing.
  for (const [text, label] of [
    ["Gross margin of 70%. Gross margin of 40%.", "gross margin"],
    ["Churn of 2% monthly. Churn of 9% monthly.", "churn rate"],
    ["12,000 customers. 4,000 customers.", "customer count"],
    ["Revenue of $5M. Revenue of $12M.", "revenue"],
  ] as const) {
    test(label, () => {
      expect(parsePlanSignals(text).conflicts.length).toBeGreaterThanOrEqual(1);
    });
  }

  test("figures the plan dates to different periods are not a disagreement", () => {
    // The latest-period rule already resolves those; flagging them would turn
    // every ordinary year-on-year disclosure into a warning.
    expect(parsePlanSignals("Gross margin of 70% in 2019. Gross margin of 74% in 2020.").conflicts.length).toBe(0);
  });
  test("the same figure rounded twice is not a disagreement", () => {
    expect(parsePlanSignals("Gross margin of 70%. Gross margin of 72%.").conflicts.length).toBe(0);
  });
  test("a target is not a competing disclosure", () => {
    expect(parsePlanSignals("We target 80% gross margin. Gross margin of 40% today.").conflicts.length).toBe(0);
  });
  test("a single figure raises nothing", () => {
    expect(parsePlanSignals("Gross margin of 77%.").conflicts.length).toBe(0);
    expect(parsePlanSignals("12,000 customers.").conflicts.length).toBe(0);
  });
});

describe("the exact input path is held to the same standard as the prose", () => {
  const base = {
    name: "Structured bounds", sector: "saas", stage: "growth" as const, geography: "US",
    description: "B2B platform.",
  };
  const sig = (financials: Record<string, number>) => analyze({ ...base, financials: financials as never }).signals;

  test("impossible figures are rejected, as the text path already rejected them", () => {
    // 250% monthly churn and 900% retention were accepted as "exact" numbers
    // and scored as facts. The precise path is meant to be MORE trustworthy
    // than a regex, not less.
    expect(sig({ churnPct: 250 }).churnPct).toBeNull();
    expect(sig({ retentionPct: 900 }).retentionPct).toBeNull();
    expect(sig({ paybackMonths: 600 }).paybackMonths).toBeNull();
  });

  test("ordinary figures still pass", () => {
    expect(sig({ churnPct: 8 }).churnPct).toBe(8);
    expect(sig({ retentionPct: 146 }).retentionPct).toBe(146);
    expect(sig({ paybackMonths: 14 }).paybackMonths).toBe(14);
  });

  test("a decline can be stated exactly, not only in prose", () => {
    // The prose path reads "revenue declined 20%"; the structured path dropped
    // -20 outright — the same asymmetry that made a below-cost margin
    // unstateable in exact form, one field over.
    expect(sig({ growthPct: -20 }).growthPct).toBe(-20);
    expect(sig({ growthPct: 97 }).growthPct).toBe(97);
  });

  test("the two paths agree on a decline", () => {
    const typed = analyze({ ...base, tractionNotes: "Revenue of $10M, down 20% year over year." });
    const exact = analyze({ ...base, tractionNotes: "Revenue of $10M.", financials: { growthPct: -20, growthPeriod: "YoY" } as never });
    expect(exact.signals.growthPct).toBe(typed.signals.growthPct);
  });
});

describe("a filing states the size of a move before its rate", () => {
  /**
   * "Total revenue decreased by $14.3 million, or 13%, to $99.6 million" is how
   * an MD&A writes a decline. Both readers that handle direction — the level
   * connector and the decline detector — allowed only a short, fixed connector
   * and could not cross the amount, so Moderna's most recent period was invisible
   * and the flattering prior year was scored instead.
   *
   * The span is constrained by SHAPE, not by length: only amount-like tokens and
   * the words that introduce them. A first attempt used a length-bounded span and
   * was reverted the same session — it let "gross margin declined to 20% and
   * churn rose to 7%" read the churn figure as the margin.
   */
  test("the decline is read through the amount", () => {
    const s = parsePlanSignals("Total revenue decreased by $14.3 million, or 13%, to $99.6 million.");
    expect(s.growthPct).toBe(-13);
    expect(s.revenueUsd).toBe(99_600_000);
  });

  test("and the later period wins over the flattering earlier one", () => {
    const s = parsePlanSignals(
      "Total revenue of $205.8M in 2017, up 90% from $108.4M in 2016. Total revenue decreased by $14.3 million, or 13%, to $99.6 million for the nine months ended 30 September 2018.",
    );
    expect(s.revenueUsd).toBe(99_600_000);
    expect(s.growthPct).toBe(-13);
  });

  test("a conjunction still ends the span", () => {
    // The guard that the reverted length-bounded version failed.
    const s = parsePlanSignals("Gross margin declined to 20% and churn rose to 7% monthly.");
    expect(s.grossMarginPct).toBe(20);
    expect(s.churnPct).toBe(7);
  });

  test("the plain forms are unchanged", () => {
    expect(parsePlanSignals("Revenue of $10M, down 20% year over year.").growthPct).toBe(-20);
    expect(parsePlanSignals("Revenue declined 20% year over year.").growthPct).toBe(-20);
    expect(parsePlanSignals("Revenue of $198.1M in 2018, up 97% year over year.").growthPct).toBe(97);
    expect(parsePlanSignals("Churn fell to 3% monthly, down from 8%.").churnPct).toBe(3);
    expect(parsePlanSignals("Customers fell to 900 from 1,200.").customers).toBe(900);
  });
});

describe("a per-customer figure is not the company's revenue", () => {
  /**
   * Nubank's F-1 states "Monthly ARPAC was approximately US$4". Annualizing the
   * top line when a plan says "monthly" was added earlier today, and this is the
   * sentence that could have turned it into a defect: $4 a month is a
   * per-customer figure, and reading it as the company's MRR would report $48 of
   * annual revenue for a bank with $1.06B. It does not — recorded as a verified
   * negative, because a guard nobody checks is a guard nobody has.
   */
  test("ARPAC is not read as revenue", () => {
    const s = parsePlanSignals("Monthly average revenue per active customer of approximately $4.");
    expect(s.revenueUsd).toBeNull();
    expect(parsePlanSignals("Monthly ARPAC was approximately US$4.").revenueUsd).toBeNull();
  });

  test("and it does not disturb the real revenue line beside it", () => {
    const s = parsePlanSignals(
      "Revenue of $1.06B in the nine months ended 30 September 2021, up 98% year over year from $534M. 48.1 million active customers as of 30 September 2021. Monthly average revenue per active customer of approximately $4.",
    );
    expect(s.revenueUsd).toBe(1_060_000_000);
    expect(s.customers).toBe(48_100_000);
    expect(s.growthPct).toBe(98);
  });
});

describe("a rate belongs to a period, like every other figure", () => {
  /**
   * A decline won by default regardless of which period it described — the one
   * field left inconsistent after every other reader learned to prefer the
   * later disclosure. Left narrow yesterday because no case needed it; closed
   * now because "the rule covers all fields except this one" is the shape of
   * every defect found today.
   */
  test("when both are dated, the later period decides", () => {
    expect(parsePlanSignals("Revenue fell 30% in 2023. Revenue grew 40% year over year in 2024.").growthPct).toBe(40);
  });

  test("Moderna's decline is the later period, so it still wins", () => {
    const s = parsePlanSignals(
      "Total revenue of $205.8M in 2017, up 90% from $108.4M in 2016. Total revenue decreased by $14.3 million, or 13%, to $99.6 million for the nine months ended 30 September 2018.",
    );
    expect(s.growthPct).toBe(-13);
  });

  test("undated figures keep the previous rule — a decline wins", () => {
    expect(parsePlanSignals("Revenue grew 40% year over year. Revenue fell 30%.").growthPct).toBe(-30);
  });

  test("single disclosures are untouched in both directions", () => {
    expect(parsePlanSignals("Revenue of $10M, down 20% year over year.").growthPct).toBe(-20);
    expect(parsePlanSignals("Revenue of $198.1M in 2018, up 97% year over year.").growthPct).toBe(97);
    expect(parsePlanSignals("GMV of $4.6B, up 77% year over year. Revenue of $509.5M, up 93% year over year.").growthPct).toBe(93);
  });
});

describe("the third currency", () => {
  // Pound (Deliveroo), euro (Adyen), now yen (LINE's 2016 F-1). Each was a real
  // filing, and the first two each broke something — GBP detected but the noun
  // unrecognised, EUR lost when the code touched the digits.
  test("yen written with the symbol and a unit word", () => {
    const s = parsePlanSignals("Revenues of ¥120,406 million in 2015, up from ¥86,366 million in 2014.");
    expect(s.currency).toBe("JPY");
    expect(s.revenueUsd).toBe(toUsd(120_406_000_000, "JPY"));
  });
  test("it is converted, not passed through as if it were dollars", () => {
    const s = parsePlanSignals("Revenues of ¥120,406 million in 2015.");
    expect(s.revenueUsd).toBeLessThan(120_406_000_000);
  });
  test("monthly active users are customers", () => {
    expect(parsePlanSignals("218 million monthly active users globally in March 2016.").customers).toBe(218_000_000);
  });
});

describe("a launch company's evidence is an order book and a flight record", () => {
  /**
   * The non-SaaS readers had only ever met fixtures this repository wrote for
   * itself. Rocket Lab's S-1 is the first real filing to state them, and it
   * broke both on the first run.
   */
  test("a date before the word backlog is not the backlog", () => {
    // "As of 30 June 2021, backlog totaled $141.4 million" read 2021 as the
    // amount: the US spelling "totaled" was missing from the connector, so the
    // name-first pattern failed and the figure-first one grabbed the year out
    // of the date in front of it. A wrong number, not a missing one.
    expect(parsePlanSignals("As of 30 June 2021, backlog totaled $141.4 million.").contractedRevenueUsd).toBe(141_400_000);
  });

  test("the backlog phrasings that already worked are unchanged", () => {
    expect(parsePlanSignals("Sales backlog of $1.8B under signed multi-year agreements.").contractedRevenueUsd).toBe(1_800_000_000);
    expect(parsePlanSignals("Contracted revenue of $210M under signed offtake agreements.").contractedRevenueUsd).toBe(210_000_000);
    expect(parsePlanSignals("Backlog of $62M across signed contracts with two federal agencies.").contractedRevenueUsd).toBe(62_000_000);
  });

  test("missions flown are technical proof", () => {
    // Stated as a count of flights, never as a test result — which is all the
    // reader knew how to recognise.
    const s = parsePlanSignals("Electron has delivered 105 satellites to orbit across 18 successful missions through July 2021.");
    expect(s.technicalProof.length).toBeGreaterThan(0);
  });
});

describe("the hardest sentence in a clinical filing", () => {
  // The reader knew every phrasing AROUND a result — trial phase, peer review,
  // sensitivity and specificity — and not the result itself. Same for a plant
  // that is already running under the words filings actually use.
  test("a met primary endpoint is technical proof", () => {
    expect(parsePlanSignals("The trial met its primary endpoint with statistical significance.").technicalProof.length).toBeGreaterThan(0);
  });
  test("a system in commercial operation is a running plant", () => {
    expect(parsePlanSignals("The system has been in commercial operation for 14 months.").technicalProof.length).toBeGreaterThan(0);
  });
  test("neither fires on an intention", () => {
    expect(parsePlanSignals("We expect the trial to meet its primary endpoint next year.").technicalProof.length).toBe(0);
    expect(parsePlanSignals("We plan to bring the system into commercial operation next year.").technicalProof.length).toBe(0);
  });
});

describe("a milestone is something reached, not something intended", () => {
  /**
   * The comment above the regulatory list always promised that "FDA approval
   * expected in 2027 is a plan, not a milestone". It was not true: the negation
   * layer catches "no FDA approval" and knows nothing about a future tense, so
   * an applicant who had obtained nothing could be credited with a clearance, a
   * PPA, a defence contracting status or a banking licence — every entry in the
   * list inherited the hole.
   *
   * The rule now runs inside the milestone's own clause: an explicit
   * achievement word wins outright, otherwise an intention marker in that
   * clause disqualifies it.
   */
  const reached = (t: string) => parsePlanSignals(t).regulatoryMilestones.length > 0;

  for (const text of [
    "FDA 510(k) clearance granted and CE marked.",
    "ISO 27001 certified and SOC 2 Type II audited.",
    "ITAR registered.",
    "A 15-year power purchase agreement is signed with the regional utility.",
    "Phase 2 complete, IND cleared for the follow-on indication.",
    "Received emergency use authorization from the FDA.",
    "FedRAMP authorized.",
  ]) {
    test(`reached: ${text}`, () => { expect(reached(text)).toBe(true); });
  }

  for (const text of [
    "FDA approval expected in 2027.",
    "We plan to pursue ISO 27001 certification next year.",
    "The team plans to pursue ITAR registration and expects a first field trial next year.",
    "The team expects to submit for FDA clearance next year.",
    "Targeting CE mark in 2027.",
    "We expect emergency use authorization in 2027.",
    "Pursuing FedRAMP authorization.",
  ]) {
    test(`intended, not counted: ${text}`, () => { expect(reached(text)).toBe(false); });
  }

  test("an intention in the NEXT clause does not cancel a real milestone", () => {
    // Clause-bounding is the whole reason this rule can be strict without
    // suppressing achievements that happen to sit next to plans.
    expect(reached("FDA clearance granted; we expect launch in 2027.")).toBe(true);
  });
});

describe("capacity already in the ground, and the unit trap under it", () => {
  /**
   * For a solar, storage or grid company the installed base is the business —
   * it is what the contracted revenue is earned on — and there was no field for
   * it, so Sunrun's S-1 read as a customer count and nothing else.
   *
   * The reason this took two attempts: a naive unit list reads "16 GWh of
   * installed capacity" as 16,000 MW. GWh is energy, GW is power, and
   * Northvolt's own fixture in this corpus states its factory in GWh — the
   * obvious pattern would have introduced a thousand-fold error while closing a
   * miss. Energy units are rejected rather than converted, because converting
   * them needs a duration the plan rarely states.
   */
  const mw = (t: string) => parsePlanSignals(t).capacityDeployedMw;

  test("power is read", () => {
    expect(mw("We have deployed an aggregate of 430 megawatts as of March 31, 2015.")).toBe(430);
    expect(mw("430 MW deployed.")).toBe(430);
    expect(mw("1,200 MW operational across 14 sites.")).toBe(1_200);
  });
  test("gigawatts are normalised to megawatts", () => {
    expect(mw("3 GW of capacity installed.")).toBe(3_000);
  });
  test("energy is NOT power", () => {
    expect(mw("The plant has 16 GWh of installed capacity.")).toBeNull();
    expect(mw("16 GWh installed.")).toBeNull();
    expect(mw("Deployed 500 MWh of storage.")).toBeNull();
  });
  test("a plan to build is not an installed base", () => {
    expect(mw("We plan to have 430 megawatts deployed by 2027.")).toBeNull();
    expect(mw("We will deploy 430 MW by 2027.")).toBeNull();
  });
  test("it backs no factor, like reservations", () => {
    // Whether delivered infrastructure should move a score the way revenue does
    // is a rubric decision needing calibration. Until then it is shown, not scored.
    expect(parsePlanSignals("430 MW deployed.").fieldsFound).toBe(0);
  });
});

describe("a defence contracting status is an award, not a definition", () => {
  /**
   * The last of the non-SaaS milestone entries to meet a real filing.
   * AeroVironment's 10-K broke it in both directions at once: the sentence
   * EXPLAINING what an IDIQ contract is ("we do not include unfunded ceiling
   * amounts for sole-source or multi-awardee IDIQ contracts in unfunded
   * backlog") was credited as a defence contracting status, because a bare
   * "IDIQ" matched any mention of the words — while the natural passive "we
   * were awarded a defense contract" missed a pattern fixed to the word order
   * "defense contract awarded".
   */
  const held = (t: string) => parsePlanSignals(t).regulatoryMilestones.includes("Defence contracting status");

  for (const text of [
    "ITAR registered.",
    "We were awarded a defense contract worth $62M.",
    "Awarded an OTA contract by the Defense Innovation Unit.",
    "We hold an IDIQ position on the Army's small UAS programme.",
    "IDIQ award received in 2025.",
    "$8M non-dilutive from an OTA award.",
  ]) {
    test(`status held: ${text.slice(0, 46)}`, () => { expect(held(text)).toBe(true); });
  }

  for (const text of [
    "Contractors are subject to extensive legal and regulatory requirements, including International Traffic in Arms Regulations (ITAR).",
    "We do not include unfunded ceiling amounts for sole-source or multi-awardee Indefinite Delivery, Indefinite Quantity (IDIQ) contracts in unfunded backlog.",
    "Sole-source and multi-awardee IDIQ contracts are excluded from unfunded backlog.",
    "Failure to comply with ITAR could result in penalties.",
    "We plan to pursue an IDIQ vehicle next year.",
  ]) {
    test(`not a status: ${text.slice(0, 46)}`, () => { expect(held(text)).toBe(false); });
  }
});

describe("the document's headline number is the harness's number", () => {
  /**
   * The rubric doc opens with "QVenture separates a strong deal from a weak one
   * ... by a mean of N points". That figure went stale by 0.4 when today's
   * reader fixes changed what the engine can see — tracked carefully for two
   * corpora and missed on the one number the document leads with.
   *
   * A number maintained by hand drifts the moment the thing it describes moves.
   * This reads the claim out of the document and checks it against a fresh run,
   * so the drift fails here instead of being published.
   */
  const docPath = path.resolve(__dirname, "../../docs/benchmarks/qventure-rubric.md");

  test("the published mean gap matches a fresh hard-cases run", () => {
    const doc = fs.readFileSync(docPath, "utf8");
    const claimed = doc.match(/by a mean of \*\*([\d.]+) points\*\*/);
    expect(claimed, "headline claim not found in the rubric doc").not.toBeNull();

    const gaps = PAIRS.map((p) => {
      const strong = analyze(p.strong).composite;
      const weak = analyze(p.weak).composite;
      return Math.round((strong - weak) * 10) / 10;
    });
    const mean = Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10;
    expect(Number(claimed![1])).toBe(mean);
  });

  test("the guard table carries the same figure as the claim", () => {
    const doc = fs.readFileSync(docPath, "utf8");
    const claimed = doc.match(/by a mean of \*\*([\d.]+) points\*\*/)?.[1];
    const table = doc.match(/Mean gap across the six models \| ≥ 10 pts \| ([\d.]+) \|/)?.[1];
    expect(table, "guard-table row not found").toBeDefined();
    expect(table).toBe(claimed);
  });
});

describe("a milestone's words also describe a business", () => {
  /**
   * Sunrun's S-1 explains its product with the same words a milestone uses:
   * "homeowners who buy energy from us under leases or power purchase
   * agreements are covered by production guaranties". No agreement is being
   * announced there — the sentence describes what the company sells.
   *
   * It missed only because the plural "agreements" broke a word boundary. Luck,
   * not a rule: the singular form of the same descriptive sentence would have
   * been credited. The entry now requires the agreement to be stated as
   * concluded, which is the thing that makes it a milestone.
   *
   * Nubank's F-1 supplied the licence half: "we may apply for a banking licence
   * in the future" was read as a licence held, because the intention list knew
   * "applying for" but not the modal.
   */
  const held = (t: string, label: string) => parsePlanSignals(t).regulatoryMilestones.includes(label);

  test("a signed agreement counts", () => {
    expect(held("A 15-year power purchase agreement is signed with the regional utility.", "Grid/PPA agreement")).toBe(true);
    expect(held("Grid interconnection agreement is executed.", "Grid/PPA agreement")).toBe(true);
    expect(held("PPA executed for 120 MW.", "Grid/PPA agreement")).toBe(true);
  });
  test("describing the product does not", () => {
    expect(held("Homeowners who buy energy from us under leases or power purchase agreements are covered by production guaranties.", "Grid/PPA agreement")).toBe(false);
    expect(held("We have a power purchase agreement with the utility covering our systems.", "Grid/PPA agreement")).toBe(false);
    expect(held("Regulations relate to electricity pricing, net metering and the interconnection of solar energy systems to the electrical grid.", "Grid/PPA agreement")).toBe(false);
  });
  test("a licence held counts, a licence contemplated does not", () => {
    expect(held("We hold a payment institution licence.", "Financial licence held")).toBe(true);
    expect(held("An e-money licence is held in two jurisdictions.", "Financial licence held")).toBe(true);
    expect(held("We may apply for a banking licence in the future.", "Financial licence held")).toBe(false);
    expect(held("None of our subsidiaries is licensed to operate as a bank.", "Financial licence held")).toBe(false);
  });
});

describe("what a clinical filing calls a cleared application", () => {
  /**
   * Moderna's S-1 uses "the program has an open IND" for an application that
   * cleared and is live — a real milestone the pattern missed, while correctly
   * ignoring the two neighbouring phrasings in the same document that are NOT a
   * cleared IND: "IND-enabling GLP toxicology studies" (pre-IND work) and "data
   * to be included in the IND filing" (not yet submitted).
   *
   * The same filing's breakthrough-designation language stayed out on its own,
   * including the sentence most likely to fool a keyword reader: "designation as
   * a breakthrough therapy is at the discretion of the FDA".
   */
  const held = (t: string, label = "IND cleared") => parsePlanSignals(t).regulatoryMilestones.includes(label);

  test("an open or active IND is a cleared IND", () => {
    expect(held("The program has an open IND.")).toBe(true);
    expect(held("An active IND is in place for the lead programme.")).toBe(true);
    expect(held("Phase 2 complete, IND cleared for the follow-on indication.")).toBe(true);
  });
  test("pre-IND work and an unfiled application are not", () => {
    expect(held("IND-enabling GLP toxicology studies are underway.")).toBe(false);
    expect(held("CMC activities including data to be included in the IND filing.")).toBe(false);
    expect(held("We intend to open an IND once formulation work completes.")).toBe(false);
    expect(held("No IND has been filed.")).toBe(false);
  });
  test("a designation discussed is not a designation granted", () => {
    const label = "FDA breakthrough designation";
    expect(held("We may seek a breakthrough therapy designation for one or more of our investigational medicines.", label)).toBe(false);
    expect(held("Designation as a breakthrough therapy is at the discretion of the FDA.", label)).toBe(false);
    expect(held("Granted breakthrough therapy designation.", label)).toBe(true);
  });
});

describe("an aviation authorisation, and the regulator that merely regulates", () => {
  /**
   * Rocket Lab's S-1: "we implemented corrective actions and received
   * authorization from the FAA to resume launches" — a real authorisation the
   * pattern missed, because it expected the authority's name to come first.
   *
   * AeroVironment's 10-K supplies the other side twice: "the Federal Aviation
   * Administration (FAA), which regulates airspace for all air vehicles" and
   * "the FAA issued a clarification of its existing policies" are regulatory
   * context, not a certificate held, and both correctly stay out.
   */
  const held = (t: string) => parsePlanSignals(t).regulatoryMilestones.includes("Aviation authority certification");

  test("an authorisation received counts, in either word order", () => {
    expect(held("We implemented corrective actions and received authorization from the FAA to resume launches.")).toBe(true);
    expect(held("EASA type certificate granted.")).toBe(true);
    expect(held("FAA certification obtained for the Mk2 vehicle.")).toBe(true);
  });
  test("a regulator doing regulator things does not", () => {
    expect(held("Government authorities, including the Federal Aviation Administration (FAA), regulate airspace.")).toBe(false);
    expect(held("The FAA issued a clarification of its existing policies.")).toBe(false);
    expect(held("We expect to receive authorization from the FAA next year.")).toBe(false);
  });
  test("a compensation-section peer review is not a peer-reviewed result", () => {
    // Sunrun's S-1 uses "peer reviews" for employee performance criteria.
    expect(parsePlanSignals("Individual objectives such as peer reviews or other subjective criteria.").technicalProof).toEqual([]);
    expect(parsePlanSignals("Results were published in a peer-reviewed journal.").technicalProof.length).toBeGreaterThan(0);
  });
});

describe("one filing uses the same words for a holding and a definition", () => {
  /**
   * iRhythm's 10-K says "CE mark" three ways: one holding — "the Zio monitor
   * System and ZEUS are currently marked in the EU under OUR CE mark issued by
   * BSI in December 2023" — and two definitions: "the means for achieving the
   * requirements for the CE mark vary according to the nature of the device"
   * and "each certified device is marked with the CE mark which shows that the
   * device has a certificate of conformance".
   *
   * The bare noun credited all three. The second definition even carries an
   * achievement word ("certified"), so the intention filter could not help —
   * the mark has to be attached to this company or to an act of issuing it.
   *
   * The 510(k) entry needed no change: the same filing's "a 510(k) submission
   * must demonstrate...", "managed within the 510(k) framework" and "devices
   * for which we are SEEKING marketing authorization require 510(k) clearance"
   * all stay out already.
   */
  const held = (t: string, label: string) => parsePlanSignals(t).regulatoryMilestones.includes(label);

  test("a mark held counts", () => {
    expect(held("The Zio monitor System and ZEUS are currently marked in the EU under our CE mark issued by BSI in December 2023.", "CE mark")).toBe(true);
    expect(held("FDA 510(k) clearance granted and CE marked.", "CE mark")).toBe(true);
  });
  test("a definition of the mark does not", () => {
    expect(held("The means for achieving the requirements for the CE mark vary according to the nature of the device.", "CE mark")).toBe(false);
    expect(held("Each certified device is marked with the CE mark which shows that the device has a certificate of conformance under the EU MDR.", "CE mark")).toBe(false);
  });
  test("and neither does a description of the 510(k) process", () => {
    const l = "FDA clearance/approval";
    expect(held("A 510(k) submission must demonstrate that the device is substantially equivalent to a device legally in commercial distribution.", l)).toBe(false);
    expect(held("To date, our product changes have been managed within the 510(k) framework.", l)).toBe(false);
    expect(held("Devices for which we are seeking marketing authorization require 510(k) clearance from FDA in order to be marketed in the United States.", l)).toBe(false);
    expect(held("FDA 510(k) clearance granted.", l)).toBe(true);
  });
});

describe("a benchmark is something run, not a word in a valuation note", () => {
  /**
   * The bare noun credited three real filings for saying nothing technical at
   * all: Nubank's "risk-free and benchmark interest rates", AeroVironment's
   * "corroborated with benchmarks of similar transactions" in a valuation note,
   * and Rocket Lab's "our state of the art 97,000 square foot Long Beach
   * facility" — a building.
   *
   * "State of the art" as a bare adjective is dropped outright. Anyone can
   * write it about anything, and it was carrying no evidence even when it did
   * describe technology. What remains is a benchmark actually run, or an
   * outperformance stated against something nameable.
   */
  const claimed = (t: string) => parsePlanSignals(t).technicalProof.includes("Benchmark result claimed");

  test("a benchmark run counts", () => {
    expect(claimed("Benchmarked against the incumbent, our model outperforms it by 18%.")).toBe(true);
    expect(claimed("Benchmark results show a 3x speedup over the baseline.")).toBe(true);
    expect(claimed("Our system outperforms the state-of-the-art baseline on MLPerf.")).toBe(true);
  });
  test("a financial or architectural use of the word does not", () => {
    expect(claimed("Assumptions include risk-free and benchmark interest rates, credit spreads and other inputs.")).toBe(false);
    expect(claimed("Valuation studies corroborated with benchmarks of similar transactions in the industry.")).toBe(false);
    expect(claimed("We moved production operations to our state of the art 97,000 square foot Long Beach facility in March 2020.")).toBe(false);
    expect(claimed("Progress towards a state of the art propulsion development and testing facility near Auckland.")).toBe(false);
  });
});

describe("the intention filter belongs to both lists, not one", () => {
  /**
   * It was written for the regulatory milestones and never asked by the
   * technical-validation list, so "we expect clinical validation to follow next
   * year" counted as clinical validation data. The negation layer was already
   * handling a different sentence correctly — Moderna's "targets and pathways
   * NOT clinically validated by one or more approved drugs" — which is why the
   * gap was invisible until a real filing supplied the intention form.
   */
  const proved = (t: string, label: string) => parsePlanSignals(t).technicalProof.includes(label);

  test("evidence stated as achieved counts", () => {
    expect(proved("Clinical validation reported 93% sensitivity and 89% specificity in a 1,400-patient study.", "Clinical validation data")).toBe(true);
    expect(proved("Results were published in a peer-reviewed journal.", "Peer-reviewed result")).toBe(true);
    expect(proved("The trial met its primary endpoint with statistical significance.", "Primary endpoint met")).toBe(true);
  });
  test("the same evidence intended does not", () => {
    expect(proved("We expect clinical validation to follow next year.", "Clinical validation data")).toBe(false);
    expect(proved("We plan to publish in a peer-reviewed journal next year.", "Peer-reviewed result")).toBe(false);
    expect(proved("We expect the trial to meet its primary endpoint next year.", "Primary endpoint met")).toBe(false);
  });
  test("and a denial still does not", () => {
    expect(proved("The biology risk represents targets and pathways not clinically validated by approved drugs.", "Clinical validation data")).toBe(false);
  });
});

describe("a clinical phase is a programme's state, not a word in a contract", () => {
  /**
   * The bare phase token fired on every context the words appear in. Moderna's
   * S-1 supplied three at once that are NOT a programme in that phase:
   *
   *   - the definition of the process: "clinical trials generally are conducted
   *     in three sequential phases, known as Phase 1, Phase 2 and Phase 3";
   *   - a risk sentence listing all of them: "Phase 1, Phase 2, Phase 3, and
   *     other types of clinical trials may not be completed successfully";
   *   - a cost-sharing clause from the AstraZeneca collaboration: "we and
   *     AstraZeneca will equally share the costs of Phase 2 clinical
   *     development activities".
   *
   * The negation layer already caught "there has never been a Phase 3 trial",
   * and the intention filter already caught "we plan to launch a Phase 2 trial".
   * Neither could help with a definition or a contract clause — those state no
   * intention and deny nothing.
   */
  const inPhase = (t: string, label: string) => parsePlanSignals(t).regulatoryMilestones.includes(label);

  test("a programme in or through a phase counts", () => {
    expect(inPhase("Two clinical stage programs are in ongoing Phase 1 trials.", "Phase 1 clinical")).toBe(true);
    expect(inPhase("Phase 2 complete, IND cleared for the follow-on indication.", "Phase 2 clinical")).toBe(true);
    expect(inPhase("Phase 2 readout met its primary endpoint; results are peer-reviewed and published.", "Phase 2 clinical")).toBe(true);
    expect(inPhase("The lead programme entered Phase 3 in March.", "Phase 3 clinical")).toBe(true);
    expect(inPhase("We initiated a Phase 2 trial for the lead candidate.", "Phase 2 clinical")).toBe(true);
  });

  test("a definition, a risk list and a contract clause do not", () => {
    expect(inPhase("Clinical trials generally are conducted in three sequential phases, known as Phase 1, Phase 2 and Phase 3, and may overlap.", "Phase 3 clinical")).toBe(false);
    expect(inPhase("Phase 1, Phase 2, Phase 3, and other types of clinical trials may not be completed successfully within any specified period.", "Phase 3 clinical")).toBe(false);
    expect(inPhase("We and AstraZeneca will equally share the costs of Phase 2 clinical development activities in excess of such dollar threshold.", "Phase 2 clinical")).toBe(false);
  });

  test("the older guards still hold on their own sentences", () => {
    expect(inPhase("To date, there has never been a Phase 3 trial in which mRNA is the primary active ingredient.", "Phase 3 clinical")).toBe(false);
    expect(inPhase("Pending successful results from the Phase 1 trial, we plan to launch a Phase 2 trial.", "Phase 2 clinical")).toBe(false);
    expect(inPhase("We may never obtain EMA or other foreign regulatory body approval for any of our investigational medicines.", "EMA/MHRA approval")).toBe(false);
  });
});

describe("the same filter belongs to the numbers, not only the labels", () => {
  /**
   * The verb rule was derived on the two recognition LISTS. The numeric readers
   * have the same exposure and had never been asked: a grant applied for is not
   * a grant awarded, and a deployment target is not a deployment.
   *
   *   "We plan to apply for a $2M SBIR grant next year"  → $2M non-dilutive
   *   "We aim to reach 11 deployments by year end"       → 11 deployments
   *   "We hope to secure $4M in non-dilutive funding"    → $4M non-dilutive
   *
   * Money and counts are worse than labels here: a label adds a badge, a figure
   * moves the score.
   */
  const sig = (t: string) => parsePlanSignals(t) as unknown as Record<string, number | null>;

  test("an intention states no figure", () => {
    expect(sig("We plan to apply for a $2M SBIR grant next year.").nonDilutiveUsd).toBeNull();
    expect(sig("We hope to secure $4M in non-dilutive funding.").nonDilutiveUsd).toBeNull();
    expect(sig("We aim to reach 11 deployments by year end.").pilots).toBeNull();
    expect(sig("We expect to sign $60M of backlog in 2027.").contractedRevenueUsd).toBeNull();
  });

  test("the achieved forms are unchanged", () => {
    expect(sig("$8M non-dilutive from an OTA award.").nonDilutiveUsd).toBe(8_000_000);
    expect(sig("$12M non-dilutive from a national research programme.").nonDilutiveUsd).toBe(12_000_000);
    expect(sig("Backlog of $62M across signed contracts with two federal agencies.").contractedRevenueUsd).toBe(62_000_000);
    expect(sig("11 deployments live at customer sites.").pilots).toBe(11);
    expect(sig("Approximately 14,000 reservations for fuel-cell trucks.").reservations).toBe(14_000);
  });
});

describe("a metric expected at scale is not a metric earned", () => {
  /**
   * The last group of readers that had never been asked the question. Two of
   * the six were surviving on sentence shape rather than on a check — "gross
   * margin should reach 80%" and "retention is expected to reach 130%" missed
   * only because the words sat between the name and the figure. Luck, and the
   * same luck the PPA and peer-review entries were living on this morning.
   */
  const sig = (t: string) => parsePlanSignals(t) as unknown as Record<string, number | null>;

  test("an intended metric states no figure", () => {
    expect(sig("We expect 80% gross margin at scale.").grossMarginPct).toBeNull();
    expect(sig("Gross margin should reach 80% once volumes grow.").grossMarginPct).toBeNull();
    expect(sig("We target 3% monthly churn.").churnPct).toBeNull();
    expect(sig("Net revenue retention is expected to reach 130% next year.").retentionPct).toBeNull();
    expect(sig("We aim for 12,000 customers by 2027.").customers).toBeNull();
    expect(sig("We expect GMV of $400M in 2027.").gmvUsd).toBeNull();
  });

  test("the disclosed forms are untouched", () => {
    expect(sig("Gross margin 77%.").grossMarginPct).toBe(77);
    expect(sig("3% annual churn.").churnPct).toBe(3);
    expect(sig("Net revenue retention 146%.").retentionPct).toBe(146);
    expect(sig("12,000 customers.").customers).toBe(12_000);
    expect(sig("GMV of $180M annualized.").gmvUsd).toBe(180_000_000);
    expect(sig("Revenue of $198.1M in 2018, up 97% year over year.").revenueUsd).toBe(198_100_000);
  });

  test("'target' as a noun does not suppress a real figure", () => {
    // The verb had to be added for "we target 3% churn"; "our target market"
    // must not take the customer count down with it.
    expect(sig("Our target market includes 12,000 clinics; we serve 1,200 customers.").customers).toBe(1_200);
  });
});

describe("a model reading a deck goes around the parser, and its guards", () => {
  /**
   * The deck extractor asks a model for `financials` — arrUsd, grossMarginPct,
   * churnPct, customers, growthPct, bottomUpTamUsd — and merges them straight
   * into the engine's structured input. That path skips every guard the
   * deterministic reader applies, because the guards live in the parser it went
   * around. A model told to report "only what the deck states" will read "we
   * target $10M ARR next year" and report 10000000.
   *
   * The file already had the right instinct in one place: where the parser
   * recognised a RANGE, its conservative reading overrides the model's pick.
   * This extends the same rule to intentions — where the deck states a metric
   * as a plan and the parser therefore has nothing, the model's figure is
   * dropped rather than trusted.
   */
  test("the helper recognises a metric stated as an intention", () => {
    expect(metricStatedAsIntention("We target $10M ARR next year.", /\b(?:arr|mrr|revenues?)\b/i)).toBe(true);
    expect(metricStatedAsIntention("We expect 80% gross margin at scale.", /\bgross\s*margins?\b/i)).toBe(true);
    expect(metricStatedAsIntention("We aim for 12,000 customers by 2027.", /\b(?:customers|users|subscribers)\b/i)).toBe(true);
  });

  test("and leaves a metric stated as fact alone", () => {
    expect(metricStatedAsIntention("ARR of $10M today.", /\b(?:arr|mrr|revenues?)\b/i)).toBe(false);
    expect(metricStatedAsIntention("Gross margin 77%.", /\bgross\s*margins?\b/i)).toBe(false);
    expect(metricStatedAsIntention("12,000 customers.", /\b(?:customers|users|subscribers)\b/i)).toBe(false);
  });

  test("a fact beside a forecast is still a fact", () => {
    // "Revenue of $198.1M in 2018; we expect $300M in 2019" states revenue as
    // fact in its own clause. The veto would not fire here anyway — it only
    // applies where the parser found nothing — but the helper must not call
    // this an intention.
    expect(metricStatedAsIntention("Revenue of $198.1M in 2018; we expect $300M in 2019.", /\b(?:arr|mrr|revenues?)\b/i)).toBe(false);
    expect(parsePlanSignals("Revenue of $198.1M in 2018; we expect $300M in 2019.").revenueUsd).toBe(198_100_000);
  });

  test("the parser itself reports nothing for the sentence the model would answer", () => {
    expect(parsePlanSignals("We target $10M ARR next year.").revenueUsd).toBeNull();
  });
});
