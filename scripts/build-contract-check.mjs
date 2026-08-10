#!/usr/bin/env node
/**
 * QBuild frontend <-> backend contract check.
 *
 * Refactors on the Express side kept renaming /api/build/* routes while the
 * frontend client kept calling the old ones. Nothing failed loudly: the calls
 * 404'd into an empty catch, so pages just rendered empty forever. This finds
 * that class of drift statically.
 *
 * It collects every /api/build/* request the frontend makes:
 *   - buildApi client methods in frontend/src/lib/build/api.ts
 *   - raw fetch(apiUrl("/api/build/...")) anywhere under frontend/src
 * and every route actually mounted under buildRouter, then reports calls with
 * no matching route.
 *
 * Exit code 1 when a call has no route, so it can gate a build.
 * Verified 2026-08-10: the route list this produces is identical (228/228) to
 * the one read off the live Express routers at runtime.
 *
 * Usage: node scripts/build-contract-check.mjs [--list-unused]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API = path.join(ROOT, "frontend/src/lib/build/api.ts");
const SRC = path.join(ROOT, "frontend/src");
const ROUTES_DIR = path.join(ROOT, "aevion-globus-backend/src/routes/build");
const BUILD_TS = path.join(ROOT, "aevion-globus-backend/src/routes/build.ts");

// ── backend: mount prefix per sub-router ──────────────────────────────────
const buildSrc = fs.readFileSync(BUILD_TS, "utf8");
const mounts = {};
for (const m of buildSrc.matchAll(/buildRouter\.use\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)/g)) {
  (mounts[m[2]] ??= []).push(m[1] === "/" ? "" : m[1]);
}
const importFile = {};
for (const m of buildSrc.matchAll(/import\s*\{([^}]+)\}\s*from\s*"\.\/build\/([\w-]+)"/g)) {
  for (const name of m[1].split(",").map((s) => s.trim()).filter(Boolean)) importFile[name] = m[2];
}

const backend = [];
for (const [routerVar, prefixes] of Object.entries(mounts)) {
  const file = importFile[routerVar];
  if (!file) continue;
  const p = path.join(ROUTES_DIR, `${file}.ts`);
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, "utf8");
  for (const m of src.matchAll(/\b\w*[Rr]outer\.(get|post|patch|put|delete)\(\s*"([^"]*)"/g)) {
    for (const prefix of prefixes) {
      backend.push({
        method: m[1].toUpperCase(),
        pattern: `/api/build${prefix}${m[2] === "/" ? "" : m[2]}`,
        file,
      });
    }
  }
}

// `${...}` in a template literal nests braces, so a regex cannot strip it.
function stripTemplates(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "$" && s[i + 1] === "{") {
      let depth = 1;
      i += 2;
      while (i < s.length && depth > 0) {
        if (s[i] === "{") depth++;
        else if (s[i] === "}") depth--;
        i++;
      }
      i--;
      out += ":x";
    } else out += s[i];
  }
  return out;
}

// A trailing `:x` glued to the path (no `/`) is an interpolated query string,
// not a path segment: `/stats/salary${qs}` targets `/stats/salary`.
const toPath = (raw) => stripTemplates(raw).split("?")[0].replace(/(?<!\/):x$/, "");

// ── frontend: client methods + raw fetches ────────────────────────────────
// A literal ends at its own delimiter only: `...${q ? "?" + q : ""}` is one
// template, and a class that stops at any quote silently truncates it — which
// is how these calls went unchecked in the first place.
const LITERAL = String.raw`"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|\`(?:[^\`\\]|\\.)*\``;
const unquote = (lit) => lit.slice(1, -1);

const calls = [];
const apiSrc = fs.readFileSync(API, "utf8");
for (const m of apiSrc.matchAll(
  new RegExp(String.raw`call<[\s\S]*?>\(\s*"(GET|POST|PATCH|PUT|DELETE)"\s*,\s*(${LITERAL})`, "g"),
)) {
  const p = toPath(unquote(m[2]));
  if (!p.startsWith("/api/build")) continue;
  calls.push({
    method: m[1],
    path: p,
    where: "frontend/src/lib/build/api.ts",
    line: apiSrc.slice(0, m.index).split("\n").length,
  });
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && p !== API) out.push(p);
  }
  return out;
}
// Outside api.ts there is no single calling convention: fetch(apiUrl("...")),
// fetch(`${getApiBase()}/api/build/...`) and bare endpoint="..." props all
// occur. So do not match on the caller — match on any string or template
// literal that contains an /api/build path, and infer the method from the
// nearest `method: "..."` after it (fetch defaults to GET when absent).
// Comments and JSX prose mention these URLs too (docs pages, changelog), and
// a path quoted in prose is not a call. Blank comments out first, then keep
// only literals that look like a URL rather than a sentence.
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (c, pre) => pre + " ".repeat(c.length - pre.length));

for (const file of walk(SRC)) {
  const src = stripComments(fs.readFileSync(file, "utf8"));
  for (const m of src.matchAll(new RegExp(LITERAL, "g"))) {
    const lit = unquote(m[0]);
    if (!lit.includes("/api/build")) continue;
    const raw = lit.slice(lit.indexOf("/api/build"));
    // Strip `${...}` before judging: an interpolation legitimately contains
    // spaces (`${q ? "?" + q : ""}`), a sentence about the URL does too, and
    // only the second should be discarded.
    const p = toPath(raw).replace(/[.,;:)]+$/, (t) => (/\.(xml|pdf|csv|js|json)$/.test(raw) ? t : ""));
    if (/[\s<>]/.test(p)) continue;
    if (!p.startsWith("/api/build")) continue;
    // The method may sit in a fetch options object, or be passed in as a prop
    // from elsewhere. Guessing GET when it is absent invents drift that is not
    // there, so an undetermined method matches the path under any verb.
    const method = src.slice(m.index, m.index + 300).match(/method:\s*"(GET|POST|PATCH|PUT|DELETE)"/);
    const before = src.slice(Math.max(0, m.index - 40), m.index);
    const isFetch = /fetch\(\s*$|fetch\(\s*apiUrl\(\s*$/.test(before);
    // next.config rewrites only /api-backend/* to the backend, so a bare
    // relative /api/build URL hits the Next app itself and 404s into whatever
    // error handling the caller has. The path is right; the origin is not.
    // Only bare literals qualify — `${getApiBase()}/api/build/...` supplies an
    // origin, and there the path does not start at index 0.
    const wrongOrigin = /fetch\(\s*$/.test(before) && lit.indexOf("/api/build") === 0;
    calls.push({
      method: method ? method[1] : isFetch ? "GET" : "ANY",
      path: p,
      wrongOrigin,
      where: path.relative(ROOT, file).replace(/\\/g, "/"),
      line: src.slice(0, m.index).split("\n").length,
    });
  }
}

// ── match ─────────────────────────────────────────────────────────────────
const compiled = backend.map((b) => ({
  ...b,
  re: new RegExp(
    `^${b.pattern
      .split("/")
      .map((seg) => (seg.startsWith(":") ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
      .join("/")}$`,
  ),
}));

const unmatched = [];
const used = new Set();
for (const c of calls) {
  // `/profiles/search` matches both `/profiles/:id` and `/profiles/search`.
  // Express resolves that with an explicit next("route") in the param handler,
  // so credit the literal route — otherwise it looks uncalled.
  const target = c.path.replace(/:x/g, "X");
  const hit = compiled
    .filter((b) => (c.method === "ANY" || b.method === c.method) && b.re.test(target))
    .sort((a, b) => (a.pattern.match(/:/g)?.length ?? 0) - (b.pattern.match(/:/g)?.length ?? 0))[0];
  if (hit) used.add(`${hit.method} ${hit.pattern}`);
  else unmatched.push(c);
}

const misaddressed = calls.filter((c) => c.wrongOrigin);

console.log(`frontend calls: ${calls.length} | backend routes: ${backend.length}`);
if (unmatched.length === 0) {
  console.log("OK — every /api/build call resolves to a mounted route.");
} else {
  console.log(`\nFRONTEND CALLS WITH NO BACKEND ROUTE (${unmatched.length}):`);
  for (const c of unmatched) console.log(`  ${c.where}:${c.line}  ${c.method} ${c.path}`);
}

if (misaddressed.length > 0) {
  console.log(`\nCALLS SENT TO THE WRONG ORIGIN (${misaddressed.length}):`);
  console.log("  A bare relative /api/build URL reaches the Next app, not the backend.");
  console.log("  Wrap it in apiUrl() or call it through buildApi.");
  for (const c of misaddressed) console.log(`  ${c.where}:${c.line}  ${c.method} ${c.path}`);
}

// Routes nothing calls are not a failure — admin tools, PDF/CSV links opened
// by the browser and public feeds all live here legitimately.
if (process.argv.includes("--list-unused")) {
  const seen = new Set();
  console.log(`\nBACKEND ROUTES NOT CALLED FROM frontend/src:`);
  for (const b of backend) {
    const k = `${b.method} ${b.pattern}`;
    if (used.has(k) || seen.has(k)) continue;
    seen.add(k);
    console.log(`  [${b.file}] ${k}`);
  }
}

process.exit(unmatched.length === 0 && misaddressed.length === 0 ? 0 : 1);
