import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * A spec that is not listed in the gate does not run, and says nothing about it.
 *
 * `.github/workflows/devhub-e2e.yml` names its specs one by one. Three were
 * added on 10.08.2026 alone, and each time the list had to be remembered
 * separately — miss it and the spec passes locally, is never run on a pull
 * request, and the guard it was written to be quietly does not exist.
 *
 * So the convention is enforced instead of trusted: a spec whose name starts
 * with one of the prefixes below belongs to this gate, and must either be in
 * the workflow or be excluded here with a reason someone can argue with.
 */

// "studio-" joined on 2026-08-12: the Studio usage panel renders DevHub's
// credit meter, so a spec for it that nobody runs is the same drift this guard
// exists to catch — just under a different name.
const GATE_PREFIXES = ["devhub-", "i18n-", "translation-", "language-", "page-weight", "globe-lazy", "studio-"];

/** Left out on purpose. Each entry is a claim that has to stay true. */
const EXCLUDED: Record<string, string> = {
  "devhub-founder-flow.spec.ts":
    "fires a real AI generation against production — belongs to the nightly, not to a per-PR gate",
};

const E2E_DIR = path.join(__dirname, "..", "..", "..", "e2e");
const WORKFLOW = path.join(__dirname, "..", "..", "..", "..", ".github", "workflows", "devhub-e2e.yml");

describe("the DevHub gate runs every spec that belongs to it", () => {
  const workflow = readFileSync(WORKFLOW, "utf8");
  const specs = readdirSync(E2E_DIR).filter((f) => f.endsWith(".spec.ts"));
  const ours = specs.filter((f) => GATE_PREFIXES.some((p) => f.startsWith(p)));

  it("finds the specs at all — a moved directory must not read as 'nothing to check'", () => {
    expect(ours.length).toBeGreaterThan(10);
  });

  it("lists each of them, or says why not", () => {
    const missing = ours.filter((f) => !workflow.includes(f) && !EXCLUDED[f]);
    expect(
      missing,
      "add these to .github/workflows/devhub-e2e.yml, or to EXCLUDED here with a reason",
    ).toEqual([]);
  });

  it("keeps the exclusions honest — a deleted spec must not leave a stale excuse", () => {
    const stale = Object.keys(EXCLUDED).filter((f) => !specs.includes(f));
    expect(stale, "these specs no longer exist; drop them from EXCLUDED").toEqual([]);
  });

  it("does not list a spec that is also excluded", () => {
    const both = Object.keys(EXCLUDED).filter((f) => workflow.includes(f));
    expect(both, "excluded in the test but listed in the workflow — one of the two is wrong").toEqual([]);
  });
});
