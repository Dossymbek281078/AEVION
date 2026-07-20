import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Guard against the "star-slash inside a JSDoc body" footgun.
//
// A block comment ends at the FIRST comment terminator (star-slash). If a
// JSDoc continuation line contains a star-slash in the middle (e.g. an env-var
// pattern written as GUMROAD_APP_<star-slash>GUMROAD_PRODUCT), the comment
// closes early and the rest of the line is parsed as code — which broke `main`
// once with a cryptic cascade of TS1005 errors. tsc does eventually catch it,
// but the message is opaque and it only fails once the trailing text happens to
// be invalid syntax. This test flags the pattern directly, with a clear
// message. Line comments are used here on purpose so the file never contains a
// literal terminator mid-line.

const SRC_DIR = join(__dirname, "..", "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

// A JSDoc/body line (starts with optional whitespace then `*`) that contains a
// comment terminator followed by more non-whitespace content on the same line.
const OFFENDER = /^\s*\*.*\*\/\s*\S/;

describe("JSDoc comment terminators", () => {
  it("no '*/' buried inside a JSDoc comment body across src/**/*.ts", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC_DIR)) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (OFFENDER.test(line)) {
          offenders.push(`${file.replace(SRC_DIR, "src")}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(
      offenders,
      offenders.length
        ? `A '*/' appears inside a JSDoc comment body — it closes the comment early ` +
            `and the rest of the line becomes code. Rewrite the token (e.g. add spaces: ` +
            `'FOO_* / BAR_*'). Offending lines:\n${offenders.join("\n")}`
        : "",
    ).toEqual([]);
  });
});
