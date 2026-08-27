import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { translations } from "../i18n-all";
import { LANGS, LANG_KEY_COUNT } from "../i18n-data";

/**
 * The split exists to keep ten dictionaries off every page. This guards the
 * property that makes it worth anything: no client module may compile in more
 * than English.
 *
 * Measured 10.08.2026 with scripts/page-weight.mjs, the combined dictionary was
 * 1.3 MB of the 2.5 MB a page had to load before it could answer a tap — the
 * largest single item on every page of the platform. One stray static import of
 * `i18n-all` or of a second language file from a "use client" module puts all
 * of it back, and nothing else would notice: the build stays green, the page
 * just gets heavy again.
 */

const SRC = path.join(__dirname, "..", "..");
const LANG_DIR = path.join(__dirname, "..", "i18n-lang");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(ts|tsx)$/.test(e.name) && !p.includes("__tests__")) out.push(p);
  }
  return out;
}

const files = sourceFiles(SRC).map((f) => ({ path: f, text: readFileSync(f, "utf8") }));
const isClient = (text: string) => /^\s*["']use client["']/.test(text);

describe("one language per page", () => {
  it("has a module for every language, and no extras", () => {
    const found = readdirSync(LANG_DIR)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => f.replace(/\.ts$/, ""))
      .sort();
    expect(found).toEqual([...LANGS].sort());
  });

  it("compiles only English into client code", () => {
    // A dynamic `import(\`./i18n-lang/${lang}\`)` is how the rest arrive; only a
    // static import puts a dictionary in the page's own bundle.
    const offenders: string[] = [];
    for (const { path: p, text } of files) {
      // i18n-all is the one module allowed to hold them all; the test below
      // keeps it away from client code, which is what makes that safe.
      if (p.endsWith(`lib${path.sep}i18n-all.ts`)) continue;
      for (const m of text.matchAll(/^\s*import\s+[^;]*?from\s+["'][^"']*i18n-lang\/([a-z]{2})["']/gm)) {
        if (m[1] !== "en") offenders.push(`${path.relative(SRC, p)} imports ${m[1]}`);
      }
    }
    expect(offenders, "static imports of a non-English dictionary").toEqual([]);
  });

  it("keeps the every-language aggregate out of client modules", () => {
    const offenders = files
      .filter(({ text }) => isClient(text) && /from\s+["'][^"']*i18n-all["']/.test(text))
      .map(({ path: p }) => path.relative(SRC, p));
    expect(offenders, '"use client" modules importing i18n-all').toEqual([]);
  });

  it("keeps the dictionary out of i18n-data, where it used to live", () => {
    // Everything client-side imports i18n-data, which is why the strings left
    // it. Someone adding "just a few keys" back — the file was their home for a
    // year — would put the whole weight back on every page, and only the size
    // budget would notice, one spec away from here.
    const dataFile = readFileSync(path.join(__dirname, "..", "i18n-data.ts"), "utf8");
    expect(
      /export\s+const\s+translations/.test(dataFile),
      "translations belong in src/lib/i18n-lang/<lang>.ts — one file per language",
    ).toBe(false);
    // 200 lines of metadata is roomy; 20 000 means the strings came back.
    expect(dataFile.split("\n").length, "i18n-data.ts should stay metadata-sized").toBeLessThan(300);
  });

  it("keeps LANG_KEY_COUNT equal to what the dictionaries hold", () => {
    // The switcher draws its coverage label from this map instead of counting
    // live keys, which is the whole reason a percentage no longer costs eleven
    // dictionaries. Stale numbers would make the UI lie without failing a build.
    for (const lang of LANGS) {
      expect(LANG_KEY_COUNT[lang], `${lang} — regenerate with scripts/splitI18n.mjs`)
        .toBe(Object.keys(translations[lang]).length);
    }
  });
});
