import { describe, it, expect } from "vitest";
import { translations } from "../i18n-all";
import { LANGS } from "../i18n-data";

/**
 * Nothing written into the dictionary may disappear on the way to the page.
 *
 * It did: the block that added base translations for the eight thinner
 * languages used `Object.assign(translations, { de: {...} })`, which replaced
 * the whole German object rather than merging into it. The 52 keys written
 * further up the file were dropped before anyone could read them — measured
 * 28.07.2026 as 40 keys per language, 320 finished translations that reached
 * no visitor. `translations.de["home.badge"]` was undefined at runtime while
 * "Produkt MVP · bereit für Demo" sat in the source.
 *
 * That whole assembly step is gone since 10.08.2026: each language is its own
 * file, generated from the runtime dictionary, so there is no longer an order
 * of assignments to get wrong. These checks name the strings that were lost, so
 * anything that drops them again fails with something readable.
 */

describe("the dictionary as it reaches a page", () => {
  it("still holds the German home page strings that used to vanish", () => {
    const de = translations.de;
    expect(de["home.badge"]).toBe("Produkt MVP · bereit für Demo");
    expect(de["home.cta.auth"]).toBeDefined();
  });

  it("kept the later, more specific wording where a key was written twice", () => {
    // Where an early literal and a later block both defined a key, the later one
    // won at runtime — and the runtime value is what was written out.
    expect(translations.de["nav.demo"], "the later block's wording stands").toBe("Ökosystem-Demo");
  });

  it("did not shrink the languages that were already complete", () => {
    for (const lang of ["ru", "en", "kk"] as const) {
      expect(Object.keys(translations[lang]).length, lang).toBeGreaterThan(7000);
    }
  });

  it("offers a dictionary for every language the switcher lists", () => {
    for (const lang of LANGS) {
      expect(Object.keys(translations[lang]).length, lang).toBeGreaterThan(0);
    }
  });
});
