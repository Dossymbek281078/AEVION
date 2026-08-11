#!/usr/bin/env node
/**
 * Does every endpoint in the published OpenAPI spec actually exist?
 *
 * Same family as the three /api/build checks, one layer further out. Those ask
 * whether the frontend and the backend agree. This asks whether the document we
 * hand to outside developers agrees with either of them. A path documented and
 * never implemented is worse than an internal mismatch: it 404s for someone who
 * has no way to see the code and no reason to doubt the spec.
 *
 * The endpoint that prompted it: POST /api/auth/sign-out-everywhere. The DB
 * column exists (ensureUsersTable migrates "tokenVersion"), the JWT payload
 * type declares `tv?`, the spec describes the semantics in two sentences, and
 * the bank's DeviceManagement button calls it. No route implements it, nothing
 * signs `tv`, nothing verifies it. Four layers of a security feature shipped
 * around an empty middle.
 *
 * Route discovery is not reimplemented here — it shells out to
 * build-contract-check.mjs --list-routes per module, so both tools always see
 * the same routes and only one of them can be wrong about what exists.
 *
 * Two deliberate silences, both because a checker that invents findings is
 * worse than no checker:
 *   - Modules the route discovery cannot resolve (prefix differs from file
 *     name, or the file is a service rather than a router — checkout, events,
 *     provisioning, entitlements, aevion-hub) are counted and named, never
 *     reported as missing. Their routes exist; we just cannot see them.
 *   - Paths served by Next route handlers under frontend/src/app/api are
 *     implemented, not missing. /api/payments/v1/* is entirely Next.
 *
 * Report-only by design — not wired into CI. Every finding is a decision about
 * what the product promises (build the endpoint, or stop documenting it), and
 * that is the founder's call, not a build failure.
 *
 * Usage: node scripts/openapi-drift-check.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = path.join(ROOT, "scripts/build-contract-check.mjs");
const SPEC = path.join(ROOT, "aevion-globus-backend/src/lib/openapiSpec.ts");
const NEXT_API = path.join(ROOT, "frontend/src/app/api");

// ── what the spec promises ────────────────────────────────────────────────
// Path keys with the verbs declared directly inside them. Reading the file as
// text rather than importing it: openapiSpec.ts is TypeScript with imports and
// helper calls, and a spec that fails to load must not silently report zero.
const specSrc = fs.readFileSync(SPEC, "utf8");
const documented = [];
for (const m of specSrc.matchAll(/"(\/api\/[^"]*)"\s*:\s*\{/g)) {
  // Walk to the matching brace so a nested object cannot cut the body short.
  let depth = 0;
  let i = specSrc.indexOf("{", m.index + m[1].length);
  const start = i;
  for (; i < specSrc.length; i++) {
    if (specSrc[i] === "{") depth++;
    else if (specSrc[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  const body = specSrc.slice(start + 1, i);
  // Verbs at the top level of this path item only — a "get" inside a nested
  // response example is not a declared operation.
  let flat = body;
  for (let pass = 0; pass < 8; pass++) flat = flat.replace(/\{[^{}]*\}/g, "");
  for (const v of flat.matchAll(/\b(get|post|put|patch|delete)\s*:/g)) {
    documented.push({
      method: v[1].toUpperCase(),
      // OpenAPI writes {id}; Express writes :id.
      path: m[1].replace(/\{([^}]+)\}/g, ":$1"),
      line: specSrc.slice(0, m.index).split("\n").length,
    });
  }
}

// ── what the backend implements ───────────────────────────────────────────
const modules = fs
  .readdirSync(path.join(ROOT, "aevion-globus-backend/src/routes"))
  .filter((f) => f.endsWith(".ts") && !f.includes(".types"))
  .map((f) => f.replace(/\.ts$/, ""))
  .filter((m) => /^[a-z0-9-]+$/.test(m));

const implemented = [];
const resolved = new Set();
for (const m of modules) {
  let out = "";
  try {
    out = execFileSync(process.execPath, [CHECK, `--module=${m}`, "--list-routes"], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    continue; // exit 2: index.ts mounts nothing under this prefix
  }
  const lines = out.split("\n").filter((l) => l.startsWith("ROUTE "));
  if (!lines.length) continue;
  resolved.add(m);
  for (const l of lines) {
    const [, method, pattern] = l.split(" ");
    implemented.push({ method, pattern });
  }
}

// Next serves its own handlers; a path under frontend/src/app/api is not missing.
(function walkNext(dir, urlPath) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      const seg = /^\[\[?\.\.\./.test(e.name) ? "*" : e.name.replace(/^\[(.+)\]$/, ":$1");
      walkNext(path.join(dir, e.name), `${urlPath}/${seg}`);
    } else if (e.name === "route.ts" || e.name === "route.tsx") {
      for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
        implemented.push({ method, pattern: urlPath });
      }
    }
  }
})(NEXT_API, "/api");

const serves = (doc) =>
  implemented.some((r) => {
    if (r.method !== doc.method) return false;
    const a = doc.path.split("/");
    const b = r.pattern.split("/");
    // A catch-all Next segment swallows everything below it.
    const star = b.indexOf("*");
    if (star !== -1) return a.slice(0, star).join("/") === b.slice(0, star).join("/");
    return a.length === b.length && a.every((s, i) => s.startsWith(":") || b[i].startsWith(":") || s === b[i]);
  });

const missing = [];
const unmeasurable = new Set();
for (const doc of documented) {
  if (serves(doc)) continue;
  const mod = doc.path.split("/")[2];
  // The prefix could not be resolved, so "not found" here means "not looked
  // at". Naming it is honest; reporting it as missing would not be.
  if (!resolved.has(mod)) {
    unmeasurable.add(mod);
    continue;
  }
  missing.push(doc);
}

console.log(
  missing.length === 0
    ? `OK openapi — all ${documented.length} documented operations are implemented`
    : `${missing.length} of ${documented.length} documented operations have no implementation`,
);
for (const d of missing) {
  console.log(`  openapiSpec.ts:${d.line}  ${d.method} ${d.path}`);
}
if (unmeasurable.size) {
  console.log(
    `\nnot checked — route discovery cannot resolve these prefixes, so their ` +
      `documented paths were skipped rather than called missing: ${[...unmeasurable].sort().join(", ")}`,
  );
}
// Report-only: the verdict is information for a human, not a build gate.
process.exit(0);
