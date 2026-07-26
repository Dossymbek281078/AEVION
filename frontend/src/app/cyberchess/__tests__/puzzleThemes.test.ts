import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { themeLabel, THEME_RU_KEYS } from "../puzzleThemes";

describe("themeLabel", () => {
  it("translates the raw Lichess ids that used to leak into the UI", () => {
    expect(themeLabel("kingsideAttack")).toBe("Атака на королевском фланге");
    expect(themeLabel("advancedPawn")).toBe("Продвинутая пешка");
    expect(themeLabel("crushing")).toBe("Разгром");
    expect(themeLabel("hangingPiece")).toBe("Висящая фигура");
  });

  it("passes Russian themes through — the corpus already has them", () => {
    expect(themeLabel("Вилка")).toBe("Вилка");
    expect(themeLabel("Мат в 2")).toBe("Мат в 2");
  });

  it("passes an unknown id through rather than swallowing it", () => {
    expect(themeLabel("someBrandNewTheme")).toBe("someBrandNewTheme");
  });

  it("handles empty input", () => {
    expect(themeLabel("")).toBe("");
    expect(themeLabel(undefined)).toBe("");
    expect(themeLabel(null)).toBe("");
  });

  it("never returns a camelCase or ascii-only label for a mapped id", () => {
    for (const key of THEME_RU_KEYS) {
      const label = themeLabel(key);
      expect(label).not.toBe(key);
      expect(/[А-Яа-я]/.test(label)).toBe(true);
    }
  });

  /* The point of the map: no theme in the shipped corpus should reach the player
     as a raw identifier. Reads the real data file, so a corpus refresh that adds
     new Lichess themes fails here instead of surfacing them in the UI. */
  it("covers every latin-script theme AND phase present in public/puzzles.json", () => {
    const puzzles = JSON.parse(readFileSync("public/puzzles.json", "utf8")) as Array<{ theme?: string; phase?: string }>;
    const themes = new Set<string>();
    // Both fields render through themeLabel — the puzzle header maps over
    // [phase, theme] — so a raw phase leaks to the player just like a raw theme.
    for (const p of puzzles) {
      if (p.theme) themes.add(p.theme);
      if (p.phase) themes.add(p.phase);
    }

    const untranslated = [...themes].filter((t) => {
      const label = themeLabel(t);
      // A label is fine if it carries Cyrillic; a bare latin label is a leak.
      return !/[А-Яа-я]/.test(label);
    });

    expect(untranslated).toEqual([]);
  });
});
