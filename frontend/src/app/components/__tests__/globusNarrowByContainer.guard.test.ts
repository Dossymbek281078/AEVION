/**
 * Глобус переходит в компактный режим панелей по ширине своего контейнера, а не только окна.
 *
 * ПОВОД (20.10.2026, главная на проде 1463×724, globus-kadr.mjs): глобус в липкой колонке
 * 418 px, по окну «широкий» — поверх холста рисовались легенда, топ стран, экосистема и слои,
 * сам глобус почти не был виден.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { узкийКонтейнер, УЗКИЙ_КОНТЕЙНЕР_PX } from "../Globus3D";

describe("Globus3D: узкий контейнер", () => {
  it("418 px — узко; 900 px — нет; 0 (не размечен) — не узко", () => {
    expect(узкийКонтейнер(418)).toBe(true);
    expect(узкийКонтейнер(900)).toBe(false);
    expect(узкийКонтейнер(0)).toBe(false);
    expect(УЗКИЙ_КОНТЕЙНЕР_PX).toBeGreaterThan(418);
  });

  it("эффект режима слушает и окно, и контейнер (ResizeObserver)", () => {
    const src = readFileSync(join(__dirname, "..", "Globus3D.tsx"), "utf8");
    const i = src.indexOf('window.matchMedia("(max-width: 600px)")');
    const блок = src.slice(i, src.indexOf("}, []);", i));
    expect(блок).toContain("mq.matches || узкийКонтейнер(");
    expect(блок).toContain("new ResizeObserver(apply)");
    expect(блок).toContain("ro?.disconnect()");
  });
});
