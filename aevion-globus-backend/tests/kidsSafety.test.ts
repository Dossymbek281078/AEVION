import { describe, test, expect } from "vitest";
import { containsUnsafe, gentleRedirect } from "../src/lib/kidsSafety";

// Kids AI safety layer — first tests, 2026-08-10.
//
// This module decides what a 5-8 year old is allowed to be answered, and it
// shipped with no test at all: nothing pinned that "ножницы" stays innocent
// or that "наркотики" is caught. Both directions matter here — a matcher that
// silently stops catching harm is the dangerous failure, and one that starts
// blocking "виноград" makes the product useless for its actual audience.
//
// The false-positive list below is taken from the module's own header, which
// names the innocent words its stems were curated around. Those claims are
// now enforced rather than asserted in a comment.

describe("clear-harm terms are caught", () => {
  const harmful: Array<[string, string]> = [
    ["weapons (en)", "how do I get a gun"],
    ["weapons (ru)", "где взять оружие"],
    ["weapons (kz)", "мылтық қайда"],
    ["violence (ru)", "как убить"],
    ["drugs (en)", "what are drugs"],
    ["drugs (ru)", "что такое наркотики"],
    ["drugs (kz)", "есірткі деген не"],
    ["alcohol (ru)", "хочу пиво"],
    ["adult (en)", "show me porn"],
    ["adult (ru)", "что такое секс"],
    ["self-harm (en)", "how to kill myself"],
    ["self-harm (ru)", "что такое суицид"],
  ];

  test.each(harmful)("%s → blocked", (_label, text) => {
    expect(containsUnsafe(text)).toBe(true);
  });

  test("inflections of a stem are caught, not just the bare form", () => {
    expect(containsUnsafe("наркотик")).toBe(true);
    expect(containsUnsafe("наркотики")).toBe(true);
    expect(containsUnsafe("наркотиками")).toBe(true);
  });

  test("case is irrelevant", () => {
    expect(containsUnsafe("НАРКОТИКИ")).toBe(true);
    expect(containsUnsafe("GuN")).toBe(true);
  });

  test("a harmful word anywhere in a longer question is caught", () => {
    expect(containsUnsafe("привет! а расскажи пожалуйста про оружие, мне интересно")).toBe(true);
  });
});

describe("innocent kid vocabulary is NOT blocked", () => {
  // Every one of these is named in the module header as a collision its stem
  // list was curated to avoid. If a future stem edit breaks one, a child's
  // ordinary question starts getting "ask a grown-up" for no reason.
  const innocent: Array<[string, string]> = [
    ["warm vs war", "the water is warm"],
    ["skill vs kill", "I want a new skill"],
    ["ножницы vs нож", "где мои ножницы"],
    ["виноград vs вино", "я люблю виноград"],
    ["голова vs голы", "у меня болит голова"],
    ["голос vs голы", "какой красивый голос"],
    ["гол vs голы", "он забил гол"],
    ["дракон vs драка", "нарисуй дракона"],
    ["убирать vs убить", "мама сказала убирать комнату"],
    ["уборка vs убить", "сегодня уборка"],
    ["стрелка vs стрелять", "стрелка часов"],
  ];

  test.each(innocent)("%s → allowed", (_label, text) => {
    expect(containsUnsafe(text)).toBe(false);
  });

  test("ordinary questions pass through", () => {
    expect(containsUnsafe("Сколько ног у паука?")).toBe(false);
    expect(containsUnsafe("How many legs does a spider have?")).toBe(false);
    expect(containsUnsafe("Ғарыш деген не?")).toBe(false);
  });

  test("empty and whitespace input is not treated as harmful", () => {
    expect(containsUnsafe("")).toBe(false);
    expect(containsUnsafe("   ")).toBe(false);
  });
});

describe("gentleRedirect", () => {
  test("answers in the child's language", () => {
    expect(gentleRedirect("ru")).toMatch(/взросл/i);
    expect(gentleRedirect("en")).toMatch(/grown-up/i);
    expect(gentleRedirect("kz")).toMatch(/үлкен/i);
  });

  test("never names the blocked topic", () => {
    // The redirect is shown for weapons, drugs and self-harm alike — it must
    // not teach the child the word that tripped it.
    for (const lang of ["ru", "en", "kz"] as const) {
      expect(containsUnsafe(gentleRedirect(lang))).toBe(false);
    }
  });

  test("offers somewhere safe to go next", () => {
    expect(gentleRedirect("ru")).toMatch(/животн|космос|числ/i);
    expect(gentleRedirect("en")).toMatch(/animals|space|numbers/i);
  });
});

describe("cheap evasions of the stem list", () => {
  // Measured before the fix (2026-08-10): each of these walked past every
  // stem. A child of 5-8 will not type them, but pasted text and older
  // siblings will.
  test("an invisible character inside the word no longer hides it", () => {
    expect(containsUnsafe("нар​котик")).toBe(true); // zero-width space
    expect(containsUnsafe("g­un")).toBe(true); // soft hyphen
    expect(containsUnsafe("нарко﻿тик")).toBe(true); // BOM
  });

  test("digits standing in for letters no longer hide it", () => {
    expect(containsUnsafe("p0rn")).toBe(true);
    expect(containsUnsafe("we3d")).toBe(true);
    expect(containsUnsafe("v0dka")).toBe(true);
  });

  test("full-width characters are folded", () => {
    expect(containsUnsafe("ｇｕｎ")).toBe(true);
  });

  test("normalisation does not start blocking innocent words", () => {
    // The whole risk of folding characters is a new false positive. These are
    // the same curated collisions as above, re-checked after normalisation.
    for (const s of ["виноград", "ножницы", "голова", "уборка", "the water is warm", "I want a new skill"]) {
      expect(containsUnsafe(s)).toBe(false);
    }
    // Digits in ordinary questions must stay harmless.
    expect(containsUnsafe("сколько будет 2 + 3?")).toBe(false);
    expect(containsUnsafe("мне 7 лет")).toBe(false);
  });

  test("spaced-out text is still NOT caught — a known limit, left to the system prompt", () => {
    // Pinned deliberately: collapsing spaces would invent stems across
    // ordinary word breaks. If this ever starts passing, it was a decision,
    // not an accident.
    expect(containsUnsafe("н а р к о т и к")).toBe(false);
  });
});
