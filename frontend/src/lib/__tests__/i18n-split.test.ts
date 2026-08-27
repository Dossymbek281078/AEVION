import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { splitTranslations, SOURCE } from "../../../scripts/splitI18n.mjs";
import { translations, LANGS } from "../i18n-data";

/**
 * Proof that splitting the dictionary per language loses nothing.
 *
 * The split exists to stop shipping all eleven dictionaries to every page (the
 * platform's biggest single payload). Rearranging 2.4 MB of translated strings
 * is exactly the kind of change that can quietly drop a key or mangle an escape
 * and still build, so this checks the pieces against the real dictionary — not
 * against a fixture written to agree with them.
 */

const source = readFileSync(SOURCE, "utf8");
const blocks = splitTranslations(source);

/**
 * What this test found on its first run, and why the split is not wired yet:
 * the literal blocks in the file are NOT the dictionary the app uses. Eight of
 * the eleven languages are filled in below the literal via Object.assign, so
 * `translations.ru` holds 7222 keys at runtime while its literal shows 3888.
 * Any split that reads the source text alone silently drops most of the
 * dictionary — including every key French has. The splitter therefore has to
 * be fed the runtime object, not the file, and that is the next step.
 *
 * It also found that those eight languages were being assigned over rather than
 * merged into, which silently dropped 320 finished translations; that is fixed,
 * and guarded by i18n-language-merge.test.ts.
 */

/** The generated modules are plain object literals; read them back as data. */
function parse(body: string): Record<string, string> {
  return new Function(`return ${body}`)() as Record<string, string>;
}

describe("splitting i18n-data by language", () => {
  it("finds every language the app offers, and no extras", () => {
    expect(Object.keys(blocks).sort()).toEqual([...LANGS].sort());
  });

  it("reproduces every literal entry exactly for the languages that are real", () => {
    // ru, en and kk are the three languages actually translated (7222, 7221 and
    // 7221 keys at runtime; the other eight hold 94 each). For them the literal
    // is what reaches the user, so the split must reproduce it character for
    // character.
    for (const lang of ["ru", "en", "kk"] as const) {
      const split = parse(blocks[lang]);
      const original = translations[lang] as Record<string, string>;
      for (const [key, value] of Object.entries(split)) {
        expect(original[key], `${lang}.${key} must exist in the real dictionary`).toBeDefined();
        if (value === original[key]) continue;

        // Tolerated only when the file defines that key twice — the section
        // below the literal redefines it and wins at runtime. Found this way:
        // kk."bank.history" is "Транзакциялар тарихы" in the literal and
        // "Транзакция тарихы" at runtime. Anything else is a split defect.
        const defined = source.split(`"${key}"`).length - 1;
        expect(defined, `${lang}.${key} differs but is defined once — the split changed it`)
          .toBeGreaterThan(1);
      }
    }
  });

  it("keeps the strings that break naive splitting", () => {
    // Braces, quotes and escapes inside translated text are what a regex-based
    // split gets wrong; the parser walks brace depth outside of strings.
    const ru = parse(blocks.ru);
    const awkward = ["{", "}", '"', "'", "\\"];
    const tricky = Object.entries(ru).filter(([, v]) => awkward.some((c) => v.includes(c))).slice(0, 20);
    expect(tricky.length, "the dictionary should contain such strings at all").toBeGreaterThan(0);
    for (const [key, value] of tricky) {
      expect(value, `ru.${key}`).toBe((translations.ru as Record<string, string>)[key]);
    }
  });

  it("records why the split cannot be wired from the source text alone", () => {
    // The gap this test found: eight languages are filled in via Object.assign
    // below the literal, so a source-text split silently drops most of the
    // dictionary. When someone teaches the splitter to consume the runtime
    // object instead, these numbers converge and this case fails — which is
    // exactly when the split becomes safe to wire.
    const literalRu = Object.keys(parse(blocks.ru)).length;
    const runtimeRu = Object.keys(translations.ru as Record<string, string>).length;
    expect(literalRu, "literal ru").toBeLessThan(runtimeRu);
    expect(Object.keys(parse(blocks.fr)).length, "literal fr is nearly empty").toBeLessThan(100);
  });
});
