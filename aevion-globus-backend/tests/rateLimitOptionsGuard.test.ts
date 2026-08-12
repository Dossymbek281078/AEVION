import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Guard: a call site must not pass options lib/rateLimit does not implement.
//
// Why this exists. Two `rateLimit` live side by side in this backend: the
// express-rate-limit package (39 call sites — qpaynet, build/*, qgood, ztide,
// qmaskcard, apiKeys, revenue, veilnetxLedger, qchaingov, search, deepsan, aev,
// smeta-trainer) and the local helper in src/lib/rateLimit.ts (77 call sites).
// Same imported name, different option vocabulary: the package takes `limit`
// and `keyGenerator`, the helper takes `max` and `keyFn`.
//
// Copying a block from a package call site into a helper call site therefore
// type-errors on nothing visible and silently drops the option — the limit still
// answers, it just counts the wrong thing or falls back to the default 60/min.
// That is not hypothetical: `keyFn` sat in the options type for months marked
// "ignored compat field" while multichat's three limiters passed one and got
// per-address counting instead of the per-account counting they were written for
// (fixed 2026-08-12). A per-account limit that silently counts per address is
// invisible until someone measures it.
//
// The allowed set is READ FROM THE INTERFACE, not hardcoded, so adding a real
// option to RateLimitOptions does not redden this guard.

const SRC = path.resolve(__dirname, "../src");
const LIB_REL = "lib/rateLimit.ts";

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

/** Option names RateLimitOptions actually declares. */
function declaredOptions(): Set<string> {
  const src = fs.readFileSync(path.join(SRC, LIB_REL), "utf8");
  const start = src.indexOf("export interface RateLimitOptions");
  expect(start, "RateLimitOptions interface not found — did it get renamed?").toBeGreaterThan(-1);
  const body = src.slice(start, src.indexOf("\n}", start));
  const names = new Set<string>();
  for (const m of body.matchAll(/^\s{2}(\w+)\??\s*:/gm)) names.add(m[1]);
  return names;
}

/** Files that import the LOCAL helper — never the package. */
function filesUsingLocalHelper(): string[] {
  return walk(SRC).filter((f) => {
    if (path.relative(SRC, f).replace(/\\/g, "/") === LIB_REL) return false;
    const src = fs.readFileSync(f, "utf8");
    return /from\s+"(?:\.\.\/)+lib\/rateLimit"|from\s+"\.\/rateLimit"/.test(src);
  });
}

/**
 * Top-level `name:` keys of an options object.
 *
 * Skips string/template literals and comments. Without that, `keyPrefix:
 * "ventures:read"` reports "ventures" as an unknown option — the colon inside
 * the quotes reads exactly like a key. A guard that cries on correct code gets
 * switched off, so the scanner has to understand what it is looking at.
 */
function topLevelKeys(body: string): string[] {
  const keys: string[] = [];
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    const next = body[i + 1];
    if (ch === "/" && next === "/") { i = body.indexOf("\n", i); if (i < 0) break; continue; }
    if (ch === "/" && next === "*") { const e = body.indexOf("*/", i); i = e < 0 ? body.length : e + 1; continue; }
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < body.length && body[i] !== quote) i += body[i] === "\\" ? 2 : 1;
      continue;
    }
    if (ch === "{") { depth++; continue; }
    if (ch === "}") { depth--; continue; }
    if (depth === 1 && /[A-Za-z_$]/.test(ch)) {
      const m = /^([\w$]+)\s*:/.exec(body.slice(i));
      if (m) { keys.push(m[1]); i += m[0].length - 1; }
      else { const w = /^[\w$]+/.exec(body.slice(i))!; i += w[0].length - 1; }
    }
  }
  return keys;
}

/** The `{...}` argument of every rateLimit({...}) in one file, brace-balanced. */
function optionBlocks(src: string): Array<{ line: number; body: string }> {
  const out: Array<{ line: number; body: string }> = [];
  for (const m of src.matchAll(/rateLimit\(\{/g)) {
    const open = src.indexOf("{", m.index!);
    let depth = 0, end = open;
    for (let j = open; j < src.length; j++) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}") { depth--; if (depth === 0) { end = j; break; } }
    }
    out.push({ line: src.slice(0, m.index!).split("\n").length, body: src.slice(open, end + 1) });
  }
  return out;
}

// Scanned once at collection time: a filesystem walk inside it() has timed out
// here before.
const ALLOWED = declaredOptions();
const FILES = filesUsingLocalHelper();
const BLOCKS = FILES.flatMap((f) => {
  const src = fs.readFileSync(f, "utf8");
  const rel = path.relative(SRC, f).replace(/\\/g, "/");
  return optionBlocks(src).map((b) => ({ ...b, rel }));
});

describe("lib/rateLimit call sites — no option the helper ignores", () => {
  test("the scan found the call sites it is supposed to police", () => {
    // A guard that silently matches nothing is worse than no guard.
    expect(FILES.length).toBeGreaterThan(20);
    expect(BLOCKS.length).toBeGreaterThan(50);
    expect(ALLOWED.has("max")).toBe(true);
    expect(ALLOWED.has("keyFn")).toBe(true);
  });

  test("every option passed is one RateLimitOptions declares", () => {
    const offenders: string[] = [];
    for (const b of BLOCKS) {
      for (const key of topLevelKeys(b.body)) {
        if (!ALLOWED.has(key)) {
          offenders.push(
            `${b.rel}:${b.line} passes "${key}" — lib/rateLimit ignores it ` +
              `(express-rate-limit name? max/keyFn are the local ones)`,
          );
        }
      }
    }
    expect(offenders, `\n${offenders.join("\n")}\n`).toEqual([]);
  });

  test("message stays a string — the helper wraps it as { error: message }", () => {
    // An object message produces { error: { error: "..." } } on the wire, so a
    // client checking body.error === "rate_limit_exceeded" sees an object.
    const bad = BLOCKS.filter((b) => /(^|\n)\s{2}message\s*:\s*\{/.test(b.body)).map(
      (b) => `${b.rel}:${b.line}`,
    );
    expect(bad, `object message at: ${bad.join(", ")}`).toEqual([]);
  });
});
