import { describe, it, expect } from "vitest";
import { diffLines } from "../lineDiff";

describe("diffLines — DevHub AI chat diffs", () => {
  it("reports an edit-in-place with correct counts and marked lines", () => {
    const before = "a\nb\nc\nd";
    const after = "a\nB\nc\nd";
    const d = diffLines(before, after);
    expect(d.added).toBe(1);
    expect(d.removed).toBe(1);
    expect(d.text).toContain("- b");
    expect(d.text).toContain("+ B");
  });

  it("treats a brand-new file as all additions", () => {
    const d = diffLines("", "one\ntwo");
    expect(d.added).toBe(2);
    expect(d.removed).toBe(0);
  });

  it("collapses long unchanged runs so huge files stay readable", () => {
    const common = Array.from({ length: 60 }, (_, i) => `line ${i}`).join("\n");
    const d = diffLines(common + "\nold", common + "\nnew");
    expect(d.text).toMatch(/… \d+ unchanged lines …/);
    expect(d.text).toContain("- old");
    expect(d.text).toContain("+ new");
  });

  it("falls back to stats-only above the size cap instead of freezing", () => {
    const big = Array.from({ length: 700 }, (_, i) => `l${i}`).join("\n");
    const d = diffLines(big, big + "\nextra");
    expect(d.text).toBeNull();
    expect(d.added).toBe(1);
  });
});
