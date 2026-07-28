import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * The comparison table is the one artefact on this platform written ABOUT
 * someone else, and the only one a reader can check against a primary source in
 * ten seconds. One wrong price on a competitor's row discredits every number we
 * measured ourselves.
 *
 * So the rule is mechanical: a claim about a competitor carries a URL, or it
 * carries an explicit "unverified" mark that the page shows the reader. There is
 * no third option, and this test is what stops one appearing under deadline.
 *
 * Read as text rather than imported: the data lives in the frontend package and
 * the test runs in the backend, which is where CI executes.
 */
const DATA = path.join(__dirname, "../../frontend/src/data/competitiveLandscape.ts");

describe("the competitive table cannot make an unsourced claim", () => {
  const src = fs.readFileSync(DATA, "utf8");

  test("the file is where this test thinks it is", () => {
    // A guard that silently reads an empty file passes forever.
    expect(src.length).toBeGreaterThan(2000);
    expect(src).toContain("export const LANDSCAPES");
  });

  test("every competitor cell has a source or an unverified mark", () => {
    // Told apart STRUCTURALLY, not by guessing from content. Our own cells sit
    // under `ours:` and may be qualitative with no number to source; a
    // competitor cell sits under `theirs:` and has no such excuse. The first
    // version of this test guessed by looking for `measured:` and flagged two
    // of our own qualitative claims — a guard misreading which side a claim is
    // on would eventually be silenced by whoever it inconvenienced.
    const blocks = [...src.matchAll(/theirs:\s*\{([\s\S]*?)\n      \},/g)].map((m) => m[1]);
    expect(blocks.length, "no `theirs` blocks found — the file shape changed").toBeGreaterThan(5);

    const cells = blocks.flatMap((b) => [...b.matchAll(/\{[^{}]*value:[^{}]*\}/g)].map((m) => m[0]));
    expect(cells.length).toBeGreaterThan(20);

    const naked = cells.filter((c) => !c.includes("source:") && !c.includes("unverified"));
    expect(naked, `competitor cells with neither a source nor an unverified mark:\n${naked.join("\n")}`).toEqual([]);
  });

  test("every source is a real URL, not a description", () => {
    const sources = [...src.matchAll(/source:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(sources.length).toBeGreaterThan(10);
    for (const s of sources) expect(s).toMatch(/^https:\/\//);
  });

  test("the table admits rows where a competitor is better", () => {
    // The property that makes the rest credible. A landscape where we win every
    // row is a landscape nobody outside the building believes.
    const theirs = (src.match(/verdict:\s*"theirs"/g) ?? []).length;
    expect(theirs).toBeGreaterThan(0);
  });

  test("modules without research are listed, not compared", () => {
    expect(src).toContain("export const PENDING");
    const pending = (src.match(/\{\s*module:\s*"/g) ?? []).length;
    expect(pending).toBeGreaterThan(4);
  });

  test("the researched date is present on every landscape", () => {
    const landscapes = (src.match(/moduleId:\s*"/g) ?? []).length;
    const dates = (src.match(/researchedAt:\s*"\d{4}-\d{2}-\d{2}"/g) ?? []).length;
    expect(dates).toBe(landscapes);
  });

  test("counts shown to the reader are derived, not typed in", () => {
    // The alternative is a headline number that drifts from the table under it,
    // which is how this document's own assertion count went stale for hours.
    expect(src).toContain("LANDSCAPES.reduce");
    expect(src).not.toMatch(/rows:\s*\d+,\s*\n\s*rowsWhereTheyWin/);
  });
});
