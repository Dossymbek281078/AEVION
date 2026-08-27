import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * A failed write must not be reported as a saved file.
 *
 * The agent step runner used to wrap every file write as
 * `try { await dbUpsertFile(f); } catch { memFiles.set(f.id, f); }` and then
 * return `{ ok: true, savedAs }`. dbUpsertFile handles "no database configured"
 * itself, so that catch only ever fired on a real database failure — and the
 * panel then named a path for content that lived in one process's memory and
 * was gone after a restart. The fallback also keyed memFiles by `f.id`, which
 * dbUpsertFile's own comment calls out as the way to leave a stale duplicate
 * that later reads return instead of the new content.
 *
 * Seven call sites did this. The behaviour is hard to reach from a test — it
 * needs a database that is configured and failing — so what is guarded here is
 * the shape, which is what would come back if someone "made the write safe"
 * again.
 */

const SOURCE = path.join(__dirname, "..", "src", "routes", "devhub.ts");

describe("devhub file writes", () => {
  const source = readFileSync(SOURCE, "utf8");

  it("never swallows a failed dbUpsertFile into the in-memory map", () => {
    // Comments may name the pattern; code may not use it.
    const lines = source
      .split(/\r?\n/)
      .filter((l) => /catch\s*\{\s*memFiles\.set/.test(l) && !/^\s*(\*|\/\/)/.test(l));
    expect(
      lines,
      "let the write throw: executeWorkflowStep already turns that into { ok: false, error } for that step alone",
    ).toEqual([]);
  });

  it("still has the writes it is guarding, so a rename cannot silence this test", () => {
    expect(source).toContain("await dbUpsertFile(f);");
  });
});
