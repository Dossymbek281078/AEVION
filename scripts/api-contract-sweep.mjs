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
 * - Three outcomes are kept apart, because collapsing them mislabels all three.
 *   A module with calls gets a row. A module whose routes were found but which
 *   nothing calls is listed under "no frontend callers" — DO NOT read that as
 *   dead code without checking. It was wrong for tiktok on first use: the
 *   /tiktok-publisher page calls every one of those routes through
 *   `const API = "/api-backend/api/tiktok"` plus `${API}/config`, and the
 *   collector does not see a call assembled that way. `/api-backend/api/...`
 *   is a convention used in awards and bank too, so the same blind spot can
 *   hide callers in any module. A module
 *   index.ts mounts nothing for is "could not resolve": its prefix differs from
 *   its file name, or the file is a service rather than a router. Printing
 *   either of the last two as a clean row would be exactly the kind of quiet
 *   lie this tool exists to catch.
 * - The `no-route` column is only as good as route discovery. It has been wrong
 *   before in both directions; see the header of build-contract-check.mjs for
 *   the seven faults that had to be fixed. `wrong-origin` does not depend on
 *   discovery at all and is the more trustworthy column.
 *
 * Scope: only frontend/src is scanned. In this checkout that is the only
 * frontend with code — frontend-payments, frontend-qcore and the rest are empty
 * directories — but if another one ever gains sources, "no callers" would start
 * meaning "no callers in frontend/src" without saying so.
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
const unresolved = [];
const noCallers = [];

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
    // Exit 2: index.ts mounts nothing under /api/<name>. Either the prefix
    // differs from the file name, or the file exports no router at all.
    unresolved.push(m);
    continue;
  }
  const calls = Number(head[1]);
  const routes = Number(head[2]);
  if (calls === 0) {
    // Routes were found, the frontend simply never calls them. Not the same
    // as "could not measure" — reporting them together mislabels both.
    noCallers.push({ m, routes });
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
if (noCallers.length) {
  console.log(
    `
no frontend callers (${noCallers.length}) — routes exist, nothing calls them: ` +
      noCallers.map((r) => `${r.m} (${r.routes})`).join(", "),
  );
}
if (unresolved.length) {
  console.log(
    `
could not resolve (${unresolved.length}) — index.ts mounts nothing under /api/<name>, ` +
      `so the prefix differs from the file name or the file is a service, not a router: ` +
      unresolved.join(", "),
  );
}
