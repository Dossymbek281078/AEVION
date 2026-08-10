#!/usr/bin/env node
/**
 * Run the API contract check over every backend route module and tabulate.
 *
 * `build-contract-check.mjs --module=<name>` answers for one module. This runs
 * it for all of them so a session can see where the drift actually is before
 * picking work. Read-only; it only shells out to the checker.
 *
 * Two things about the output are deliberate:
 *
 * - A module with 0 collected calls is dropped rather than reported clean. The
 *   checker derives both the URL prefix and the file from one name, so a module
 *   whose prefix differs from its file name finds nothing — that is "could not
 *   measure", not "nothing wrong", and printing it as a clean row would lie.
 * - The `no-route` column is only as good as route discovery. It has been wrong
 *   before in both directions; see the header of build-contract-check.mjs for
 *   the seven faults that had to be fixed. `wrong-origin` does not depend on
 *   discovery at all and is the more trustworthy column.
 *
 * Usage: node scripts/api-contract-sweep.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = path.join(ROOT, "scripts/build-contract-check.mjs");

const modules = fs
  .readdirSync(path.join(ROOT, "aevion-globus-backend/src/routes"))
  .filter((f) => f.endsWith(".ts") && !f.includes(".types"))
  .map((f) => f.replace(/\.ts$/, ""))
  // The checker rejects camelCase names — those files are mounted under a
  // lowercase prefix belonging to another module and get measured with it.
  .filter((m) => /^[a-z0-9-]+$/.test(m));

const rows = [];
const unmeasured = [];

for (const m of modules) {
  let out = "";
  try {
    out = execFileSync(process.execPath, [CHECK, `--module=${m}`], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      // Swallow the child's stderr: "mounts nothing under /api/x" is expected
      // for the unmeasurable ones and is reported once at the end instead.
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    // Exit 1 is a finding, exit 2 is "cannot measure" — both land here.
    out = (e.stdout ?? "") + (e.stderr ?? "");
  }

  // Verdict line: "OK /api/x — 12 calls / 34 routes, no drift" or
  // "FAIL /api/x — 2 with no route (12 calls / 34 routes)".
  const head = out.match(/(\d+) calls \/ (\d+) routes/);
  if (!head) {
    unmeasured.push(m);
    continue;
  }
  const calls = Number(head[1]);
  const routes = Number(head[2]);
  if (calls === 0) {
    unmeasured.push(m);
    continue;
  }
  rows.push({
    m,
    calls,
    routes,
    noRoute: Number(out.match(/WITH NO BACKEND ROUTE \((\d+)\)/)?.[1] ?? 0),
    wrongOrigin: Number(out.match(/WRONG ORIGIN \((\d+)\)/)?.[1] ?? 0),
  });
}

rows.sort((a, b) => b.wrongOrigin + b.noRoute - (a.wrongOrigin + a.noRoute) || a.m.localeCompare(b.m));

const pad = (s, n) => String(s).padEnd(n);
const num = (s, n) => String(s).padStart(n);
console.log(`${pad("module", 18)}${num("calls", 6)}${num("routes", 7)}${num("no-route", 10)}${num("wrong-origin", 14)}`);
for (const r of rows) {
  console.log(pad(r.m, 18) + num(r.calls, 6) + num(r.routes, 7) + num(r.noRoute, 10) + num(r.wrongOrigin, 14));
}

const dirty = rows.filter((r) => r.noRoute + r.wrongOrigin > 0);
console.log(`\nmeasured: ${rows.length} | with findings: ${dirty.length}`);
console.log(
  `not measurable (${unmeasured.length}): no calls found under /api/<name>, usually because the ` +
    `prefix differs from the file name — ${unmeasured.join(", ")}`,
);
