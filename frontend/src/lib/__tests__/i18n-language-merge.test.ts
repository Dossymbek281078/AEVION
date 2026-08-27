import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { splitTranslations, SOURCE } from "../../../scripts/splitI18n.mjs";
import { translations, LANGS } from "../i18n-data";

/**
 * Nothing written into the dictionary may disappear on the way to the page.
 *
 * It did: the block that added base translations for the eight thinner
 * languages used `Object.assign(translations, { de: {...} })`, which replaces
 * the whole German object rather than merging into it. The 52 keys written
 * further up the file were dropped before anyone could read them — measured
 * 28.07.2026 as 40 keys per language, 320 finished translations that reached
 * no visitor. `translations.de["home.badge"]` was undefined at runtime while
 * "Produkt MVP · bereit für Demo" sat in the source.
 *
 * The check is against the file itself, so it keeps holding as the dictionary
 * grows: every key in a language's first literal must still be readable at
 * runtime, whatever later blocks do.
 */

const blocks = splitTranslations(readFileSync(SOURCE, "utf8"));

function parse(body: string): Record<string, string> {
  return new Function(`return ${body}`)() as Record<string, string>;
}

describe("assembling the dictionary", () => {
  it("keeps every key of every language's first literal", () => {
    for (const lang of LANGS) {
      const written = parse(blocks[lang]);
      const runtime = translations[lang] as Record<string, string>;
      const missing = Object.keys(written).filter((k) => runtime[k] === undefined);
      expect(missing, `${lang}: keys written in the file but absent at runtime`).toEqual([]);
    }
  });

  it("restores the German home page strings that used to vanish", () => {
    // The concrete loss that started this: named, so a future refactor that
    // reintroduces wholesale assignment fails here with something readable.
    const de = translations.de as Record<string, string>;
    expect(de["home.badge"]).toBe("Produkt MVP · bereit für Demo");
    expect(de["home.cta.auth"]).toBeDefined();
  });

  it("leaves the later, more specific translations in charge", () => {
    // Merging must not resurrect an older wording over a newer one: where both
    // the early literal and a later block define a key, the later wins.
    const de = translations.de as Record<string, string>;
    expect(de["nav.demo"], "the later block's wording stands").toBe("Ökosystem-Demo");
  });

  it("does not shrink the languages that were already complete", () => {
    for (const lang of ["ru", "en", "kk"] as const) {
      expect(Object.keys(translations[lang] as Record<string, string>).length).toBeGreaterThan(7000);
    }
  });
});
