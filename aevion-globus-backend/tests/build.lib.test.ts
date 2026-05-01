/**
 * Unit tests for pure helper functions in src/lib/build/index.ts.
 * No DB, no network, no mocks needed — these are all synchronous or
 * trivially deterministic.
 */
import { describe, test, expect } from "vitest";
import {
  computeRecruiterTier,
  nextRecruiterTier,
  applyBpsDiscount,
  currentMonthKey,
  isUnlimited,
  safeParseJson,
  vString,
  vNumber,
  vEnum,
  RECRUITER_TIERS,
} from "../src/lib/build";

// ── computeRecruiterTier ─────────────────────────────────────────────

describe("computeRecruiterTier", () => {
  test("0 hires → DEFAULT", () => {
    const t = computeRecruiterTier(0);
    expect(t.key).toBe("DEFAULT");
    expect(t.hireFeeBps).toBe(1200);
    expect(t.cashbackBps).toBe(200);
  });

  test("2 hires → still DEFAULT (Bronze needs 3)", () => {
    expect(computeRecruiterTier(2).key).toBe("DEFAULT");
  });

  test("3 hires → BRONZE", () => {
    const t = computeRecruiterTier(3);
    expect(t.key).toBe("BRONZE");
    expect(t.hireFeeBps).toBe(1000);
    expect(t.cashbackBps).toBe(250);
    expect(t.subDiscountBps).toBe(500);
  });

  test("9 hires → BRONZE (Silver needs 10)", () => {
    expect(computeRecruiterTier(9).key).toBe("BRONZE");
  });

  test("10 hires → SILVER", () => {
    const t = computeRecruiterTier(10);
    expect(t.key).toBe("SILVER");
    expect(t.hireFeeBps).toBe(800);
    expect(t.cashbackBps).toBe(300);
    expect(t.boostSlotsBonus).toBe(3);
  });

  test("24 hires → SILVER (Gold needs 25)", () => {
    expect(computeRecruiterTier(24).key).toBe("SILVER");
  });

  test("25 hires → GOLD", () => {
    const t = computeRecruiterTier(25);
    expect(t.key).toBe("GOLD");
    expect(t.hireFeeBps).toBe(600);
    expect(t.cashbackBps).toBe(400);
  });

  test("49 hires → GOLD (Platinum needs 50)", () => {
    expect(computeRecruiterTier(49).key).toBe("GOLD");
  });

  test("50 hires → PLATINUM", () => {
    const t = computeRecruiterTier(50);
    expect(t.key).toBe("PLATINUM");
    expect(t.hireFeeBps).toBe(400);
    expect(t.cashbackBps).toBe(500);
    expect(t.subDiscountBps).toBe(2500);
  });

  test("1000 hires → PLATINUM (cap at top)", () => {
    expect(computeRecruiterTier(1000).key).toBe("PLATINUM");
  });

  test("negative hires → DEFAULT (safe floor to 0)", () => {
    expect(computeRecruiterTier(-5).key).toBe("DEFAULT");
  });

  test("fractional hires are floored", () => {
    // 2.9 → 2 → DEFAULT
    expect(computeRecruiterTier(2.9).key).toBe("DEFAULT");
    // 3.0 → 3 → BRONZE
    expect(computeRecruiterTier(3.0).key).toBe("BRONZE");
  });

  test("RECRUITER_TIERS ordered by minHires ascending", () => {
    for (let i = 1; i < RECRUITER_TIERS.length; i++) {
      expect(RECRUITER_TIERS[i].minHires).toBeGreaterThan(RECRUITER_TIERS[i - 1].minHires);
    }
  });

  test("cashback monotonically increases with tier", () => {
    for (let i = 1; i < RECRUITER_TIERS.length; i++) {
      expect(RECRUITER_TIERS[i].cashbackBps).toBeGreaterThan(RECRUITER_TIERS[i - 1].cashbackBps);
    }
  });

  test("hireFee monotonically decreases with tier", () => {
    for (let i = 1; i < RECRUITER_TIERS.length; i++) {
      expect(RECRUITER_TIERS[i].hireFeeBps).toBeLessThan(RECRUITER_TIERS[i - 1].hireFeeBps);
    }
  });
});

// ── nextRecruiterTier ────────────────────────────────────────────────

describe("nextRecruiterTier", () => {
  test("DEFAULT → BRONZE", () => {
    const next = nextRecruiterTier(RECRUITER_TIERS[0]);
    expect(next?.key).toBe("BRONZE");
  });

  test("BRONZE → SILVER", () => {
    const bronze = RECRUITER_TIERS.find((t) => t.key === "BRONZE")!;
    expect(nextRecruiterTier(bronze)?.key).toBe("SILVER");
  });

  test("PLATINUM → null (top of ladder)", () => {
    const plat = RECRUITER_TIERS.find((t) => t.key === "PLATINUM")!;
    expect(nextRecruiterTier(plat)).toBeNull();
  });

  test("each tier except PLATINUM has a next", () => {
    RECRUITER_TIERS.forEach((t) => {
      if (t.key === "PLATINUM") {
        expect(nextRecruiterTier(t)).toBeNull();
      } else {
        expect(nextRecruiterTier(t)).not.toBeNull();
      }
    });
  });
});

// ── applyBpsDiscount ─────────────────────────────────────────────────

describe("applyBpsDiscount", () => {
  test("0 bps → no discount (returns same amount)", () => {
    expect(applyBpsDiscount(1000, 0)).toBe(1000);
  });

  test("500 bps → 5% off 1000 = 950", () => {
    expect(applyBpsDiscount(1000, 500)).toBe(950);
  });

  test("1000 bps → 10% off 990 = 891", () => {
    expect(applyBpsDiscount(990, 1000)).toBe(891);
  });

  test("2500 bps → 25% off 10000 = 7500", () => {
    expect(applyBpsDiscount(10000, 2500)).toBe(7500);
  });

  test("10000 bps → 100% off → 0", () => {
    expect(applyBpsDiscount(500, 10000)).toBe(0);
  });

  test("amount = 0 → 0", () => {
    expect(applyBpsDiscount(0, 500)).toBe(0);
  });

  test("negative amount → 0", () => {
    expect(applyBpsDiscount(-100, 500)).toBe(0);
  });

  test("result is always a whole number (round)", () => {
    // 333 × 0.9 = 299.7 → rounds to 300
    expect(applyBpsDiscount(333, 1000)).toBe(300);
  });

  test("BRONZE sub-discount (500 bps) on 990 = 941 (rounds correctly)", () => {
    // 990 × (1 - 500/10000) = 990 × 0.95 = 940.5 → 941 rounding
    expect(applyBpsDiscount(990, 500)).toBe(941);
  });
});

// ── currentMonthKey ──────────────────────────────────────────────────

describe("currentMonthKey", () => {
  test("returns YYYY-MM format", () => {
    const key = currentMonthKey();
    expect(key).toMatch(/^\d{4}-\d{2}$/);
  });

  test("explicit date is used", () => {
    expect(currentMonthKey(new Date("2026-05-15"))).toBe("2026-05");
    expect(currentMonthKey(new Date("2024-01-01"))).toBe("2024-01");
    expect(currentMonthKey(new Date("2024-12-31"))).toBe("2024-12");
  });

  test("month is zero-padded", () => {
    expect(currentMonthKey(new Date("2026-01-01"))).toBe("2026-01");
    expect(currentMonthKey(new Date("2026-09-15"))).toBe("2026-09");
  });
});

// ── isUnlimited ──────────────────────────────────────────────────────

describe("isUnlimited", () => {
  test("-1 is unlimited", () => expect(isUnlimited(-1)).toBe(true));
  test("0 is not unlimited", () => expect(isUnlimited(0)).toBe(false));
  test("positive number is not unlimited", () => expect(isUnlimited(5)).toBe(false));
  test("large number is not unlimited", () => expect(isUnlimited(999999)).toBe(false));
});

// ── safeParseJson ────────────────────────────────────────────────────

describe("safeParseJson", () => {
  test("parses valid JSON array", () => {
    expect(safeParseJson('["a","b"]', [])).toEqual(["a", "b"]);
  });

  test("parses valid JSON object", () => {
    expect(safeParseJson('{"x":1}', {})).toEqual({ x: 1 });
  });

  test("returns fallback for invalid JSON", () => {
    expect(safeParseJson("not-json", ["default"])).toEqual(["default"]);
  });

  test("returns fallback for null input", () => {
    expect(safeParseJson(null, [])).toEqual([]);
  });

  test("returns fallback for undefined input", () => {
    expect(safeParseJson(undefined, [])).toEqual([]);
  });

  test("returns fallback for empty string", () => {
    expect(safeParseJson("", "fallback")).toBe("fallback");
  });

  test("non-string input returns fallback (only strings are parsed)", () => {
    // safeParseJson checks typeof === "string" first; non-strings get the fallback.
    expect(safeParseJson(["already", "parsed"], ["fallback"])).toEqual(["fallback"]);
    expect(safeParseJson(42, 0)).toBe(0);
    expect(safeParseJson({}, null)).toBeNull();
  });
});

// ── vString ──────────────────────────────────────────────────────────

describe("vString", () => {
  test("accepts valid string", () => {
    const r = vString("hello", "field", { min: 1, max: 100 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("hello");
  });

  test("trims whitespace", () => {
    const r = vString("  hi  ", "f", { min: 1, max: 10 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("hi");
  });

  test("rejects string shorter than min", () => {
    const r = vString("a", "f", { min: 3, max: 10 });
    expect(r.ok).toBe(false);
  });

  test("rejects string longer than max", () => {
    const r = vString("toolongstring", "f", { min: 1, max: 5 });
    expect(r.ok).toBe(false);
  });

  test("rejects empty string when not allowEmpty", () => {
    const r = vString("", "f", { min: 1, max: 10 });
    expect(r.ok).toBe(false);
  });

  test("accepts empty string when allowEmpty=true", () => {
    const r = vString("", "f", { max: 100, allowEmpty: true });
    expect(r.ok).toBe(true);
  });

  test("rejects non-string value", () => {
    const r = vString(42, "f", { min: 1, max: 100 });
    expect(r.ok).toBe(false);
  });

  test("rejects null value", () => {
    const r = vString(null, "f", { min: 1, max: 100 });
    expect(r.ok).toBe(false);
  });
});

// ── vNumber ──────────────────────────────────────────────────────────

describe("vNumber", () => {
  test("accepts number in range", () => {
    const r = vNumber(5, "f", { min: 0, max: 10 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(5);
  });

  test("accepts numeric string", () => {
    const r = vNumber("7.5", "f", { min: 0, max: 10 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(7.5);
  });

  test("rejects value below min", () => {
    expect(vNumber(-1, "f", { min: 0, max: 10 }).ok).toBe(false);
  });

  test("rejects value above max", () => {
    expect(vNumber(11, "f", { min: 0, max: 10 }).ok).toBe(false);
  });

  test("rejects non-numeric string", () => {
    expect(vNumber("abc", "f", { min: 0, max: 100 }).ok).toBe(false);
  });

  test("rejects null", () => {
    expect(vNumber(null, "f", { min: 0, max: 10 }).ok).toBe(false);
  });

  test("accepts boundary values (min and max inclusive)", () => {
    expect(vNumber(0, "f", { min: 0, max: 10 }).ok).toBe(true);
    expect(vNumber(10, "f", { min: 0, max: 10 }).ok).toBe(true);
  });
});

// ── vEnum ────────────────────────────────────────────────────────────

describe("vEnum", () => {
  const ROLES = ["CLIENT", "WORKER", "ADMIN"] as const;

  test("accepts valid enum value", () => {
    const r = vEnum("CLIENT", "role", ROLES);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("CLIENT");
  });

  test("rejects invalid value", () => {
    expect(vEnum("SUPERADMIN", "role", ROLES).ok).toBe(false);
  });

  test("is case-sensitive", () => {
    expect(vEnum("client", "role", ROLES).ok).toBe(false);
  });

  test("rejects empty string", () => {
    expect(vEnum("", "role", ROLES).ok).toBe(false);
  });

  test("rejects null", () => {
    expect(vEnum(null, "role", ROLES).ok).toBe(false);
  });

  test("all valid enum values accepted", () => {
    ROLES.forEach((v) => expect(vEnum(v, "role", ROLES).ok).toBe(true));
  });
});
