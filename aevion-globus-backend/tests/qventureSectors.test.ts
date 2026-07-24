import { describe, test, expect } from "vitest";
import { SECTORS, resolveSector, listSectors, type MoatArchetype } from "../src/lib/qventure/sectors";

// The 18-sector knowledge base is hand-entered: TAM, CAGR, four 0–1 intensities,
// gross margin, a moat archetype and cited sources per row. A typo in any number
// silently skews every deal scored in that sector (five of eight factors are
// sector constants), with no error. These invariants turn a fat-fingered 0.85 or
// a dropped source into a failing test instead of a wrong score in production.

const MOATS: MoatArchetype[] = [
  "network-effects", "data-scale", "regulatory-license", "switching-costs",
  "brand", "ip-patents", "economies-of-scale", "none",
];
const FRACTION_FIELDS = [
  "regulatoryIntensity", "capitalIntensity", "grossMargin", "competitiveIntensity",
] as const;

const entries = Object.entries(SECTORS);

describe("sector knowledge base — structural invariants", () => {
  test("there are 18 sectors and 'other' (the resolve fallback) exists", () => {
    expect(entries.length).toBe(18);
    expect(SECTORS.other).toBeDefined();
  });

  test("each record's id matches its map key", () => {
    for (const [key, s] of entries) expect(s.id).toBe(key);
  });

  test.each(entries)("%s: label and narrative fields are non-empty", (_key, s) => {
    expect(s.label.trim().length).toBeGreaterThan(0);
    expect(s.scienceFrontier.trim().length).toBeGreaterThan(0);
    expect(s.structuralRisk.trim().length).toBeGreaterThan(0);
  });

  test.each(entries)("%s: TAM is a positive, plausible number", (_key, s) => {
    expect(s.tamUsdBn).toBeGreaterThan(0);
    expect(s.tamUsdBn).toBeLessThan(100_000); // < $100T sanity ceiling
  });

  test.each(entries)("%s: CAGR is a fraction in a sane range", (_key, s) => {
    // A fraction, not a percentage (0.18, not 18). A row entered as 18 would
    // read as 1800%/yr and blow up timing/science scoring — catch it here.
    expect(s.cagr).toBeGreaterThan(0);
    expect(s.cagr).toBeLessThanOrEqual(1);
  });

  test.each(entries)("%s: 0–1 intensity/margin fields stay in [0,1]", (_key, s) => {
    for (const f of FRACTION_FIELDS) {
      expect(s[f], `${_key}.${f}`).toBeGreaterThanOrEqual(0);
      expect(s[f], `${_key}.${f}`).toBeLessThanOrEqual(1);
    }
    expect(s.grossMargin).toBeGreaterThan(0); // a 0% gross-margin sector is a typo
  });

  test.each(entries)("%s: primaryMoat is a known archetype", (_key, s) => {
    expect(MOATS).toContain(s.primaryMoat);
  });

  test.each(entries)("%s: has at least one citation, each with a real URL", (_key, s) => {
    expect(Array.isArray(s.sources)).toBe(true);
    expect(s.sources.length).toBeGreaterThan(0);
    for (const src of s.sources) {
      expect(src.publisher.trim().length).toBeGreaterThan(0);
      expect(src.claim.trim().length).toBeGreaterThan(0);
      expect(src.year).toBeGreaterThanOrEqual(2020);
      expect(src.year).toBeLessThanOrEqual(2030);
      expect(src.url).toMatch(/^https?:\/\//);
    }
  });
});

describe("resolveSector", () => {
  test("an exact id resolves to that sector", () => {
    expect(resolveSector("fintech").id).toBe("fintech");
    expect(resolveSector("healthtech").id).toBe("healthtech");
  });
  test("case and separators are normalised", () => {
    expect(resolveSector("  Fintech ").id).toBe("fintech");
    expect(resolveSector("AI Infra").id).toBe(resolveSector("ai_infra").id);
  });
  test("an unknown sector falls back to 'other', never throws", () => {
    expect(resolveSector("underwater-basket-weaving").id).toBe("other");
    expect(resolveSector(undefined).id).toBe("other");
    expect(resolveSector("").id).toBe("other");
  });
  test("listSectors mirrors the map and is non-empty", () => {
    const ids = listSectors().map((x) => x.id).sort();
    expect(ids).toEqual(Object.keys(SECTORS).sort());
  });
});
