import { describe, test, expect } from "vitest";
import { measuredObstaclePct } from "./heightQuality";

describe("measuredObstaclePct", () => {
  test("Астана: здания есть, обмера нет — это ноль, а не «нет данных»", () => {
    expect(measuredObstaclePct(37, 0)).toBe(0);
  });

  test("город с обмером даёт долю, а не флаг", () => {
    expect(measuredObstaclePct(40, 30)).toBe(75);
    expect(measuredObstaclePct(3, 1)).toBe(33);
  });

  test("под коридором нет зданий — спрашивать не о чем", () => {
    expect(measuredObstaclePct(0, 0)).toBeNull();
    expect(measuredObstaclePct(null, null)).toBeNull();
    expect(measuredObstaclePct(undefined, 5)).toBeNull();
  });

  test("отсутствующий счётчик обмеренных читается как ноль, а не как «всё обмерено»", () => {
    expect(measuredObstaclePct(10, undefined)).toBe(0);
    expect(measuredObstaclePct(10, null)).toBe(0);
  });
});
