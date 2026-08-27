import { describe, it, expect } from "vitest";
import { readdirSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * `frontend/frontend/` is a dead copy, and writing into it by accident is easy.
 *
 * Nothing builds, publishes or imports it — a search across frontend/src on
 * 10.08.2026 returns zero references — but the path `frontend/src/...` typed
 * from inside `frontend/` lands there. The edit then goes nowhere while looking
 * done: on 28.07 a file was read from it twice and nearly put wrong figures in
 * a report, and before that an entire build once went in.
 *
 * A dead directory has no reason to change, so any change is the mistake. This
 * counts its files and fails when the number moves, with the sentence someone
 * in that situation needs.
 */

const DEAD = path.join(__dirname, "..", "..", "..", "frontend");

/** Counted 10.08.2026, after the README gained its warning header. */
/**
 * Снимок приведён к 53 при переносе этого сторожа (27.08.2026).
 *
 * Число 55 пришло из ветки, откуда сторож перенесён, и её мёртвая копия была на
 * два файла больше. Здесь их 53 — столько же, сколько в выкаченном коммите
 * прода, то есть снимок совпадает с настоящим состоянием, а не подогнан.
 *
 * Расхождение было 54: с переносом приехал артефакт прогона Playwright
 * (`frontend/frontend/test-results/.last-run.json`). Он снят с отслеживания —
 * артефакты прогонов в истории не хранятся, ради этого в том же долге лежит
 * отдельный коммит.
 */
const EXPECTED_FILES = 53;

function countFiles(dir: string): number {
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      n += countFiles(path.join(dir, e.name));
    } else n++;
  }
  return n;
}

describe("the dead frontend/frontend copy", () => {
  it("stays exactly as dead as it was, or is gone entirely", () => {
    // Deleting it is the right end state and the founder's call; a missing
    // directory is a pass, not a failure.
    if (!existsSync(DEAD)) return;

    expect(
      countFiles(DEAD),
      "frontend/frontend changed. Nothing there is built or imported — the live " +
        "app is frontend/src. If you meant to edit the app, your path was one " +
        "level too deep. If the directory was deleted on purpose, delete this test.",
    ).toBe(EXPECTED_FILES);
  });
});
