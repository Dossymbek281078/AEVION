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
    "nonDilutiveUsd", "pilots", "reservations", "churnPct",
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
