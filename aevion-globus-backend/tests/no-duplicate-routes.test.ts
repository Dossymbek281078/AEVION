/**
 * A route declared twice is the quietest defect this codebase produces.
 *
 * Express answers with the FIRST handler registered for a method+path, so a
 * second declaration never runs — no error, no warning, no log line. The file
 * still reads as if the newer handler is the live one, which is exactly how it
 * fools a reviewer.
 *
 * Found on 2026-08-12 in DevHub: `POST /projects/:id/github/sync` was declared
 * twice, and the second copy — never executed since the day it was written —
 * was the one the UI had been coded against. A button labelled "Sync branches"
 * therefore hit the OTHER handler, which overwrites every file in the project
 * from the repository. Nobody noticed, because nothing failed.
 *
 * The DevHub guard in devhub-github-connection-truth.test.ts walks the real
 * `devhubRouter.stack` and is the stronger instrument, but it only covers one
 * router. Importing all 123 route modules here would drag in database pools,
 * timers and provider clients, so this one reads the sources instead.
 *
 * That trade is only acceptable because the scanner was checked against the
 * real historical case rather than trusted: run over devhub.ts as it stood at
 * 6bf1fcbb4~1 it reports exactly `POST /projects/:id/github/sync ×2`, which is
 * what the runtime guard found. Static checks in this repo have a habit of
 * disagreeing with runs, so a new one has to earn its place.
 */

import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROUTES_DIR = path.join(__dirname, "..", "src", "routes");

/**
 * Only receivers that look like an Express router or app count. Without this,
 * `headers.get("last-modified")` and `someMap.get("qright")` are reported as
 * duplicate GET routes — the first version of this scan produced two such
 * false positives out of five hits.
 */
const ROUTER_RECEIVER = /Router$|^router$|^app$/;
const REGISTRATION = /\b([A-Za-z_$][\w$]*)\.(get|post|put|patch|delete|all)\(\s*"([^"]+)"/g;

/**
 * Duplicates that exist today and are NOT this branch's to fix. Each needs a
 * reason and an owner, so the list cannot quietly become a place where new
 * duplicates are parked.
 *
 * Removing an entry once it is fixed is welcome and will not fail this test —
 * the guard only objects to duplicates nobody has accounted for.
 */
const KNOWN: Array<{ key: string; why: string }> = [
  {
    key: "qcoreai.ts :: qcoreaiRouter GET /search",
    why:
      "The live handler returns { items }; the dead V31 copy returns { results }, " +
      "which is the shape /qcoreai/search and the command palette read — so QCoreAI " +
      "search answers 'nothing found' for every query. Zone qcoreai is claimed by " +
      "worktree aevion-backend-modules; see memory bug_qcoreai_search_always_empty_duplicate_route.",
  },
  {
    key: "qcoreai.ts :: qcoreaiRouter POST /runs/:id/branch",
    why: "Same file, same owner — not yet checked whether the two copies differ in behaviour.",
  },
  {
    key: "qcoreai.ts :: qcoreaiRouter GET /runs/:id/branches",
    why: "Same file, same owner — not yet checked whether the two copies differ in behaviour.",
  },
];

function findDuplicates(): string[] {
  const found: string[] = [];
  for (const file of fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith(".ts"))) {
    const src = fs.readFileSync(path.join(ROUTES_DIR, file), "utf8");
    const counts = new Map<string, number>();
    let m: RegExpExecArray | null;
    REGISTRATION.lastIndex = 0;
    while ((m = REGISTRATION.exec(src))) {
      if (!ROUTER_RECEIVER.test(m[1])) continue;
      const key = `${file} :: ${m[1]} ${m[2].toUpperCase()} ${m[3]}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const [key, n] of counts) if (n > 1) found.push(key);
  }
  return found.sort();
}

describe("no route is declared twice in the same file", () => {
  test("every new duplicate is reported", () => {
    const known = new Set(KNOWN.map((k) => k.key));
    const unaccounted = findDuplicates().filter((k) => !known.has(k));
    expect(unaccounted).toEqual([]);
  });

  test("the scanner still reads the routes it claims to cover", () => {
    // A guard that silently stops finding files passes forever. This pins the
    // instrument itself: it must be looking at a real, populated directory.
    const files = fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain("devhub.ts");
  });

  test("the scanner finds a duplicate when one is present", () => {
    // Proves the regex + receiver filter actually detect the pattern, rather
    // than the suite passing because nothing is ever matched.
    const sample = `
      const fooRouter = Router();
      fooRouter.get("/a", h);
      fooRouter.post("/b", h);
      fooRouter.get("/a", h);
      const headers = new Map();
      headers.get("last-modified");
    `;
    const counts = new Map<string, number>();
    let m: RegExpExecArray | null;
    REGISTRATION.lastIndex = 0;
    while ((m = REGISTRATION.exec(sample))) {
      if (!ROUTER_RECEIVER.test(m[1])) continue;
      const key = `${m[2].toUpperCase()} ${m[3]}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect([...counts].filter(([, n]) => n > 1).map(([k]) => k)).toEqual(["GET /a"]);
    // …and the Map.get call is not mistaken for a route.
    expect(counts.has('GET last-modified')).toBe(false);
  });
});
