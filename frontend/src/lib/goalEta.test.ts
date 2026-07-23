import { describe, it, expect } from "vitest";
import { etaLabel } from "./goalEta";

describe("etaLabel", () => {
  it("returns the reached message once current meets or exceeds target", () => {
    expect(etaLabel(100, 100, null)).toBe("🎉 цель достигнута");
    expect(etaLabel(100, 150, { windowDays: 30, points: 10, change: { grossUsd: 5 } })).toBe("🎉 цель достигнута");
  });

  it("returns null when there isn't enough history to compute a pace", () => {
    expect(etaLabel(100, 10, null)).toBeNull();
    expect(etaLabel(100, 10, { windowDays: 30, points: 1, change: { grossUsd: 5 } })).toBeNull();
    expect(etaLabel(100, 10, { windowDays: 30, points: 2 })).toBeNull(); // no `change` at all
  });

  it("flags flat/negative growth, distinguishing low-confidence from established", () => {
    const flat = (points: number) => etaLabel(100, 10, { windowDays: 30, points, change: { grossUsd: 0 } });
    expect(flat(2)).toBe("пока мало данных — роста за 30 дней не видно");
    expect(flat(10)).toBe("нет роста за 30 дней");
  });

  it("caps absurdly distant projections instead of printing huge day counts", () => {
    // $999,990 remaining at $0.10/day → ~10,000,000 days, must be capped either way.
    const nearZeroPace = (points: number) => etaLabel(1_000_000, 10, { windowDays: 30, points, change: { grossUsd: 0.1 } });
    expect(nearZeroPace(2)).toBe("пока мало данных для прогноза, но темпа уже не хватает");
    expect(nearZeroPace(10)).toBe("текущего темпа надолго не хватит — >10 лет");
  });

  it("prints a concrete day count right at and just past the 10-year boundary", () => {
    // 3650 days exactly must NOT be capped; 3651 must be.
    const atBoundary = etaLabel(3650 * 10 + 10, 10, { windowDays: 1, points: 10, change: { grossUsd: 10 } });
    expect(atBoundary).toBe("в темпе — ~3,650 дн.");

    const pastBoundary = etaLabel(3651 * 10 + 10, 10, { windowDays: 1, points: 10, change: { grossUsd: 10 } });
    expect(pastBoundary).toBe("текущего темпа надолго не хватит — >10 лет");
  });

  it("computes a plain ETA when the pace is healthy and well within range", () => {
    // remaining = 900, perDay = 900/30 = 30/day → 30 days.
    expect(etaLabel(1000, 100, { windowDays: 30, points: 10, change: { grossUsd: 900 } })).toBe("в темпе — ~30 дн.");
  });

  it("formats the day count per the requested locale, defaulting to en-US", () => {
    const pace = { windowDays: 1, points: 10, change: { grossUsd: 10 } };
    // remaining = 36500, perDay = 10 → 3650 days.
    const enResult = etaLabel(36510, 10, pace);
    const ruResult = etaLabel(36510, 10, pace, "ru");
    expect(enResult).toBe(`в темпе — ~${(3650).toLocaleString("en-US")} дн.`);
    expect(ruResult).toBe(`в темпе — ~${(3650).toLocaleString("ru-RU")} дн.`);
    expect(ruResult).not.toBe(enResult); // sanity: the two locales must actually differ here
  });
});
