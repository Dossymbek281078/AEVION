import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import en from "../i18n-lang/en";
import ru from "../i18n-lang/ru";

/**
 * A one-word English button label inherits whatever sense another module chose.
 *
 * AutoTranslate seeds its instant map from en→ru pairs across the whole
 * dictionary and matches whole strings, with no idea where a string came from.
 * `build.teamRequestDetail.applyButton` renders "Apply" as "Откликнуться" — the
 * word for answering a job advert — so the DevHub template button offered a
 * Russian visitor "Откликнуться" on a project template. The source said
 * "Apply"; nothing in review would show it.
 *
 * Measured before writing this: 23 DevHub labels get replaced this way and all
 * the others are correct (Delete→Удалить, Save→Сохранить). So this guards the
 * one label that was wrong rather than banning the mechanism.
 */

const PAGE = path.join(__dirname, "..", "..", "app", "devhub", "[id]", "page.tsx");

describe("DevHub labels the dictionary could hijack", () => {
  it("the template button says what it applies", () => {
    const source = readFileSync(PAGE, "utf8");
    expect(
      source.includes('"Apply template"'),
      'keep it longer than the bare word: "Apply" alone is translated as "Откликнуться"',
    ).toBe(true);
    expect(source).not.toMatch(/: "Apply"\s*\}/);
  });

  it("names the pair that made this necessary, so the reason survives", () => {
    // If this key ever stops meaning "Apply", the guard above can be dropped.
    expect(en["build.teamRequestDetail.applyButton"]).toBe("Apply");
    expect(ru["build.teamRequestDetail.applyButton"]).toBe("Откликнуться");
  });
});
