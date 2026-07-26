import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  tFor,
  loadLocale,
  saveLocale,
  type CcLocale,
} from "../i18n";

/* A key present in Russian and missing in English does not fail — tFor falls back to
   Russian and the English speaker gets a Russian word with nothing to indicate it. So
   parity is asserted here rather than left to be noticed on screen. */

const SRC = readFileSync(join(__dirname, "..", "i18n.ts"), "utf8");

/** Keys per locale, read from the source so a missing entry cannot hide behind a fallback. */
function keysByLocale(): Record<string, string[]> {
  const lines = SRC.split("\n");
  const starts: Record<string, number> = {};
  lines.forEach((l, i) => {
    const m = /^ {2}(ru|en|kk): \{/.exec(l);
    if (m) starts[m[1]] = i;
  });
  const order = ["ru", "en", "kk"];
  const out: Record<string, string[]> = {};
  order.forEach((loc, idx) => {
    const from = starts[loc];
    const to = idx + 1 < order.length ? starts[order[idx + 1]] : lines.length;
    out[loc] = lines
      .slice(from, to)
      .map((l) => /^\s*"([^"]+)":/.exec(l)?.[1])
      .filter((k): k is string => !!k);
  });
  return out;
}

describe("the dictionary", () => {
  const byLocale = keysByLocale();

  it("has a block for every advertised locale", () => {
    for (const l of SUPPORTED_LOCALES) expect(byLocale[l.code]?.length ?? 0).toBeGreaterThan(0);
  });

  it("translates every Russian key into every other language", () => {
    const ru = new Set(byLocale.ru);
    for (const loc of ["en", "kk"]) {
      const have = new Set(byLocale[loc]);
      expect({ [loc]: [...ru].filter((k) => !have.has(k)) }).toEqual({ [loc]: [] });
    }
  });

  it("carries no key that Russian does not have", () => {
    const ru = new Set(byLocale.ru);
    for (const loc of ["en", "kk"]) {
      expect({ [loc]: byLocale[loc].filter((k) => !ru.has(k)) }).toEqual({ [loc]: [] });
    }
  });

  it("declares each key once per locale", () => {
    for (const loc of Object.keys(byLocale)) {
      expect(byLocale[loc].length).toBe(new Set(byLocale[loc]).size);
    }
  });

  /* Every t("literal") written anywhere in the module has to resolve, otherwise the raw
     key — "spectator.hub.title" — is what the player reads. */
  it("answers every key the components ask for", () => {
    const ru = new Set(byLocale.ru);
    const asked = new Map<string, string>();
    const dir = join(__dirname, "..");
    const walk = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) { if (e.name !== "__tests__") walk(p); continue; }
        if (!/\.tsx?$/.test(e.name)) continue;
        const s = readFileSync(p, "utf8");
        for (const m of s.matchAll(/\bt\(\s*["'`]([A-Za-z0-9_.-]+)["'`]\s*\)/g)) {
          if (!asked.has(m[1])) asked.set(m[1], e.name);
        }
      }
    };
    walk(dir);
    expect(asked.size).toBeGreaterThan(0);
    const orphans = [...asked].filter(([k]) => !ru.has(k)).map(([k, f]) => `${k} (${f})`);
    expect(orphans).toEqual([]);
  });
});

describe("tFor", () => {
  const anyKey = keysByLocale().ru[0];

  it("returns the phrase in the requested language", () => {
    expect(tFor("en", anyKey)).not.toBe(anyKey);
  });

  it("returns the key itself when nothing matches, rather than empty space", () => {
    expect(tFor("en", "no.such.key")).toBe("no.such.key");
  });

  it("falls back to Russian for an unknown locale", () => {
    expect(tFor("de" as CcLocale, anyKey)).toBe(tFor("ru", anyKey));
  });
});

describe("locale preference", () => {
  beforeEach(() => localStorage.clear());

  it("remembers what the player picked", () => {
    saveLocale("kk");
    expect(loadLocale()).toBe("kk");
  });

  it("ignores a stored value that is not a language we ship", () => {
    localStorage.setItem("aevion_locale", "fr");
    expect(loadLocale()).toBe(DEFAULT_LOCALE);
  });

  /* jsdom reports en-US. An English browser used to land the visitor in the English
     locale automatically — which translates the panels and leaves the board Russian.
     Auto-detect now only fires for a locale with no `note`, so the mixed screen is
     something a player can choose but never something they are handed. */
  it("does not hand an unfinished locale to a browser that merely reports it", () => {
    expect(navigator.language.slice(0, 2)).toBe("en");
    expect(loadLocale()).toBe(DEFAULT_LOCALE);
  });

  it("still honours the choice when the player makes it themselves", () => {
    saveLocale("en");
    expect(loadLocale()).toBe("en");
  });

  it("marks the incomplete languages so the menu can say so", () => {
    const ru = SUPPORTED_LOCALES.find((l) => l.code === "ru");
    expect(ru?.note).toBeUndefined();
    for (const l of SUPPORTED_LOCALES.filter((x) => x.code !== "ru")) {
      expect(l.note && l.note.length).toBeGreaterThan(0);
    }
  });
});
