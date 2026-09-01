import { describe, it, expect } from "vitest";
import { shouldCache } from "../src/routes/i18n";

/**
 * A translation cache must never pin a non-translation.
 *
 * Measured on production 28.07.2026: 39 module captions on the home page came
 * back unchanged for every German visitor — "core • live — Реестр + Postgres"
 * answered with itself — while the same text sent as a fresh string translated
 * correctly ("core • live — Katalog…"). The engine was fine; the cache was
 * serving an identity answer stored during an earlier bad moment, and an
 * in-memory cache keeps that for the life of the deploy.
 *
 * The route falls back to the source when the engine returns nothing, so the
 * failure and the legitimate "brand name, unchanged" case look identical by the
 * time they reach the cache. Neither is worth keeping: asking again is cheap,
 * and a wrong entry is permanent.
 */
describe("what the translation cache is allowed to remember", () => {
  it("keeps a real translation", () => {
    expect(shouldCache("Сохранить изменения", "Änderungen speichern")).toBe(true);
  });

  it("refuses a result the engine never produced", () => {
    // translateBatch returns a short array / undefined slot when a provider
    // partially fails; the route substitutes the source text.
    expect(shouldCache("Сохранить изменения", undefined)).toBe(false);
    expect(shouldCache("Сохранить изменения", "")).toBe(false);
  });

  it("refuses an echo of the source, whatever its cause", () => {
    expect(shouldCache("core • live — Реестр + Postgres", "core • live — Реестр + Postgres")).toBe(false);
    expect(shouldCache("AEVION", "AEVION")).toBe(false);
  });

  it("does not confuse a translation that merely looks similar", () => {
    // Brand-heavy strings often change very little; as long as something did
    // change, it is a translation and worth caching.
    expect(shouldCache("QSign — Подпись", "QSign — Signatur")).toBe(true);
  });
});
