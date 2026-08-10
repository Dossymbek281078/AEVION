#!/usr/bin/env node
/**
 * AEVION frontend <-> backend API contract check.
 *
 * Refactors on the Express side kept renaming routes while the frontend kept
 * calling the old ones. Nothing failed loudly: the calls 404'd into an empty
 * catch, so pages just rendered empty forever. This finds that class of drift
 * statically, plus a second one — a bare relative /api/<module>/... URL, which
 * resolves against the Next app instead of the backend because next.config
 * rewrites only /api-backend/*.
 *
 * It collects every /api/<module>/* request the frontend makes:
 *   - client methods in frontend/src/lib/<module>/api.ts, when that file exists
 *   - any literal in a request position anywhere under frontend/src
 * and every route mounted under the module's router, then reports calls with no
 * matching route and calls sent to the wrong origin. Exit code 1 on either, so
 * it can gate a build.
 *
 * An earlier version of this script was validated against the live Express
 * routers read at runtime and matched 228/228 — but that was before discovery
 * learned to follow index.ts, and 228 turned out to be an undercount: build
 * really serves 271, the difference being /api/build/jobs and /api/build/social,
 * which are mounted from qjobs.ts and qsocial.ts. Treat the runtime comparison
 * as confirming the route-parsing regexes, not the module's total.
 *
 * Usage: node scripts/build-contract-check.mjs [--module=<name>] [--list-unused]
 *        --module defaults to `build`. Other modules were never swept — expect
 *        real findings the first time (qpaynet and qcoreai both have them).
 *
 * Route discovery reads index.ts: every app.use whose prefix is the module's or
 * sits under it, resolved to a file through its import (named or default), then
 * that file's own sub-router mounts. Four things had to be right before the
 * counts could be trusted, each found by a wrong number rather than by reading:
 * default imports (nine cyberchess routers use them), single-quoted route
 * declarations, sibling prefixes like /api/cyberchess-daily, and a segment
 * boundary after the prefix — without it MODULE=aev scored every
 * /api/aevion-hub call as its own, 81 calls against 6 routes.
 *
 * Measured after all four, 2026-08-10: cyberchess 38 phantom findings -> 4,
 * qsign 21 -> 4, qright 20 -> 7, veilnetx 19 -> 4, aev 75 -> 0.
 *
 * Not everything under /api is Express, and missing that produced the worst
 * false alarm of the day: payments reported 17, and an earlier revision of this
 * comment called them real on the strength of "payments.ts does not serve
 * them". It does not — Next does, from frontend/src/app/api/payments/v1/**.
 * Those handlers are read now, a relative URL to one is the correct call rather
 * than a misaddressed one, and payments reports 0. Checking that Express lacks
 * a route is not the same as checking that nothing serves it.
 *
 * Mounts come from two places, both read: app.use in index.ts (middleware may
 * sit between the prefix and the router) and the { path, router } table in
 * routes/moduleManifest.ts, which is the only mount qreal, qskyway, qventure
 * and qevents have.
 *
 * "index.ts mounts nothing under /api/<x>" is usually the right answer rather
 * than a failure: checkout and events live under /api/pricing/..., and
 * provisioning exports no router at all — it is a service imported by
 * pricing.ts. The one real gap is entitlements, mounted at bare "/api", which
 * this module-per-prefix model cannot express.
 *
 * Still not modelled: a route registered anywhere other than a `<name>Router.`
 * or `router.` call with a literal path, and a mount whose prefix is built from
 * a variable.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODULE = (process.argv.find((a) => a.startsWith("--module=")) ?? "--module=build").slice(9);
if (!/^[a-z0-9-]+$/.test(MODULE)) {
  console.error(`Bad --module: ${MODULE}`);
  process.exit(2);
}
const PREFIX = `/api/${MODULE}`;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "frontend/src");
// Only `build` and `bank` have a dedicated api.ts; every other module fetches
// inline from its pages, and the generic scan below covers those.
const API = path.join(ROOT, `frontend/src/lib/${MODULE}/api.ts`);
const HAS_API = fs.existsSync(API);
const ROUTES_ROOT = path.join(ROOT, "aevion-globus-backend/src/routes");
const INDEX_TS = path.join(ROOT, "aevion-globus-backend/src/index.ts");

// Not everything under /api is Express. Next serves its own handlers from
// frontend/src/app/api/**/route.ts — /api/payments/v1/* is entirely Next, and
// for those a bare relative URL is the correct call, not a misaddressed one.
const NEXT_API = path.join(SRC, "app/api");
const nextRoutes = [];
(function walkNext(dir, urlPath) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      // [id] -> :param, [[...rest]] / [...rest] -> match anything below.
      const seg = /^\[\[?\.\.\./.test(e.name) ? "*" : e.name.replace(/^\[(.+)\]$/, ":$1");
      walkNext(path.join(dir, e.name), `${urlPath}/${seg}`);
    } else if (e.name === "route.ts" || e.name === "route.tsx") {
      nextRoutes.push(urlPath);
    }
  }
})(NEXT_API, "/api");

const servedByNext = (p) =>
  nextRoutes.some((r) => {
    const src = r
      .split("/")
      .map((seg) => (seg === "*" ? ".*" : seg.startsWith(":") ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
      .join("/");
    return new RegExp(`^${src}$`).test(p);
  });

// ── backend: every router index.ts mounts under this module's prefix ───────
// A module is not one file. cyberchess is mounted from six, and /api/qsign/v2
// lives in qsignV2.ts — index.ts is the only place that knows. Guessing the
// file from the prefix leaves half the routes undiscovered and makes their
// callers look routeless.
const indexSrc = fs.readFileSync(INDEX_TS, "utf8");

const importedFrom = {};
// Named: import { qjobsRouter } from "./routes/qjobs"
for (const m of indexSrc.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']\.\/routes\/([\w.-]+)["']/g)) {
  for (const n of m[1].split(",").map((x) => x.trim()).filter(Boolean)) importedFrom[n] = m[2];
}
// Default: import cyberchessDailyRouter from "./routes/cyberchessDaily" — nine
// cyberchess routers use this form, and reading only the named form left them
// undiscovered, which is what made every call to them look routeless.
for (const m of indexSrc.matchAll(/import\s+(\w+)\s+from\s*["']\.\/routes\/([\w.-]+)["']/g)) {
  importedFrom[m[1]] = m[2];
}

// Not every mount is an app.use in index.ts: routes/moduleManifest.ts holds a
// table of { path, router } entries that index.ts loops over. qreal, qskyway,
// qventure, qevents and data-quality are mounted only from there.
const MANIFEST = path.join(ROUTES_ROOT, "moduleManifest.ts");
let manifestMounts = [];
if (fs.existsSync(MANIFEST)) {
  const manifestSrc = fs.readFileSync(MANIFEST, "utf8");
  const manifestImports = {};
  for (const m of manifestSrc.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']\.\/([\w.-]+)["']/g)) {
    for (const n of m[1].split(",").map((x) => x.trim()).filter(Boolean)) manifestImports[n] = m[2];
  }
  for (const m of manifestSrc.matchAll(/path:\s*["']([^"']+)["']\s*,\s*router:\s*(\w+)/g)) {
    const file = manifestImports[m[2]];
    if (file) manifestMounts.push({ mountPrefix: m[1], routerVar: m[2], file });
  }
}

// Every prefix each router file is mounted under, module filter aside. A file
// with more than one is aliased: qjobs answers at /api/build/jobs and at
// /api/qjobs, and calls to one prefix say nothing about the other, so routes
// under the unused prefix must not be reported as though nobody calls them.
const prefixesPerFile = {};
for (const m of indexSrc.matchAll(/app\.use\(\s*["']([^"']+)["']\s*,([^;]*)\)/g)) {
  for (const token of m[2].match(/[A-Za-z_$][\w$]*/g) ?? []) {
    const f = importedFrom[token];
    if (f) (prefixesPerFile[f] ??= new Set()).add(m[1]);
  }
}
for (const { mountPrefix, file } of manifestMounts) {
  (prefixesPerFile[file] ??= new Set()).add(mountPrefix);
}

const entryPoints = [];
for (const { mountPrefix, file } of manifestMounts) {
  const mine =
    mountPrefix === PREFIX ||
    mountPrefix.startsWith(`${PREFIX}/`) ||
    mountPrefix.startsWith(`${PREFIX}-`);
  if (!mine) continue;
  const filePath = path.join(ROUTES_ROOT, `${file}.ts`);
  if (fs.existsSync(filePath)) entryPoints.push({ mountPrefix, file, filePath });
}

// Middleware can sit between the prefix and the router —
// app.use("/api/qcoreai", requireModule("qcoreai"), qcoreaiRouter) — so read the
// whole argument list and keep whichever token names an imported router.
for (const m of indexSrc.matchAll(/app\.use\(\s*["']([^"']+)["']\s*,([^;]*)\)/g)) {
  const mountPrefix = m[1];
  const mine =
    mountPrefix === PREFIX ||
    mountPrefix.startsWith(`${PREFIX}/`) ||
    mountPrefix.startsWith(`${PREFIX}-`);
  if (!mine) continue;
  for (const token of m[2].match(/[A-Za-z_$][\w$]*/g) ?? []) {
    const file = importedFrom[token];
    if (!file) continue;
    const filePath = path.join(ROUTES_ROOT, `${file}.ts`);
    if (!fs.existsSync(filePath)) continue;
    if (entryPoints.some((e) => e.mountPrefix === mountPrefix && e.file === file)) continue;
    entryPoints.push({ mountPrefix, file, filePath });
  }
}

if (entryPoints.length === 0) {
  console.error(`index.ts mounts nothing under ${PREFIX} — is "${MODULE}" the right module?`);
  process.exit(2);
}

const backend = [];

// `router.post("/x", someLimiter)` attaches middleware to a path — it is not an
// endpoint, and counting it would both inflate the route list and let a path
// look "served" when only a rate limiter sits there. Require an inline handler.
const collect = (src, mountPrefix, subPrefix, file) => {
  for (const m of src.matchAll(/\b\w*[Rr]outer\.(get|post|patch|put|delete)\(\s*["']([^"']*)["']/g)) {
    // A handler can sit behind middleware — router.post("/x", limiter, async
    // (req, res) => ...) — so look ahead for one instead of demanding it be the
    // next argument. No handler in sight means the line only attaches
    // middleware to that path.
    if (!/async\s*\(|\(\s*_?req\b/.test(src.slice(m.index, m.index + 220))) continue;
    const subPath = `${subPrefix}${m[2] === "/" ? "" : m[2]}`;
    backend.push({
      method: m[1].toUpperCase(),
      pattern: `${mountPrefix}${subPath}`,
      // Kept so the unused list can tell an alias from a dead route: qjobs and
      // qsocial are mounted both at /api/build/jobs and at /api/qjobs, and the
      // frontend uses the second — the first is the same handler under another
      // name, not something nobody calls.
      handler: `${m[1].toUpperCase()} ${file}${subPath}`,
      file,
    });
  }
};

for (const { mountPrefix, file, filePath } of entryPoints) {
  const src = fs.readFileSync(filePath, "utf8");
  collect(src, mountPrefix, "", file);

  // A router big enough to split declares sub-routers in routes/<file>/*.ts and
  // mounts them under a further prefix of its own.
  const subDir = path.join(ROUTES_ROOT, file);
  if (!fs.existsSync(subDir)) continue;

  const mounts = {};
  for (const m of src.matchAll(/\w+Router\.use\(\s*["']([^"']+)["']\s*,\s*(\w+)\s*\)/g)) {
    (mounts[m[2]] ??= []).push(m[1] === "/" ? "" : m[1]);
  }
  const importFile = {};
  const importRe = new RegExp(String.raw`import\s*\{([^}]+)\}\s*from\s*["']\./${file}/([\w-]+)["']`, "g");
  for (const m of src.matchAll(importRe)) {
    for (const n of m[1].split(",").map((x) => x.trim()).filter(Boolean)) importFile[n] = m[2];
  }
  for (const [routerVar, prefixes] of Object.entries(mounts)) {
    const subFile = importFile[routerVar];
    if (!subFile) continue;
    const subPath = path.join(subDir, `${subFile}.ts`);
    if (!fs.existsSync(subPath)) continue;
    const subSrc = fs.readFileSync(subPath, "utf8");
    for (const sub of prefixes) collect(subSrc, mountPrefix, sub, subFile);
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
const apiSrc = HAS_API ? fs.readFileSync(API, "utf8") : "";
for (const m of apiSrc.matchAll(
  new RegExp(String.raw`call<[\s\S]*?>\(\s*"(GET|POST|PATCH|PUT|DELETE)"\s*,\s*(${LITERAL})`, "g"),
)) {
  const p = toPath(unquote(m[2]));
  if (!p.startsWith(PREFIX)) continue;
  calls.push({
    method: m[1],
    path: p,
    where: path.relative(ROOT, API).replace(/\\/g, "/"),
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
// fetch(`${getApiBase()}/api/<module>/...`) and bare endpoint="..." props all
// occur. So do not match on the caller — match on any string or template
// literal that contains the module path, and infer the method from the
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
    // Substring is not enough: with MODULE=aev, "/api/aevion-hub/..." contains
    // "/api/aev" and would be scored against the wrong module. Require a real
    // segment boundary after the prefix.
    const at = lit.indexOf(PREFIX);
    if (at < 0) continue;
    const after = lit[at + PREFIX.length];
    if (after !== undefined && !"/-?\"'`".includes(after)) continue;
    // A template can wrap a nested literal: `${apiUrl("/api/qjobs/jobs")}${qs}`.
    // Slicing from the prefix to the end of the outer template drags `")}` into
    // the path. Stop at the first character a URL cannot contain.
    const raw = lit.slice(at);
    // Strip `${...}` before judging: an interpolation legitimately contains
    // spaces (`${q ? "?" + q : ""}`), a sentence about the URL does too, and
    // only the second should be discarded.
    // A template can wrap a nested literal: `${apiUrl("/api/qjobs/jobs")}${qs}`.
    // Taking everything to the end of the outer template drags `")}` into the
    // path. Truncate at the first character a URL cannot contain — but only
    // AFTER interpolations are replaced, since `${id}` itself contains `}`.
    const p = toPath(raw)
      // Whitespace is deliberately NOT a cut point: it is what marks prose, and
      // the sentence check below relies on it surviving.
      .split(/["'`)}<>]/)[0]
      .replace(/[.,;:]+$/, (t) => (/\.(xml|pdf|csv|js|json)$/.test(raw) ? t : ""));
    if (/[\s<>]/.test(p)) continue;
    if (!p.startsWith(PREFIX)) continue;
    // A module specifier is not a URL: `import { store } from
    // "../../api/payments/v1/_lib"` contains the prefix and means nothing here.
    if (/\bfrom\s*$|\brequire\(\s*$|\bimport\(\s*$/.test(src.slice(Math.max(0, m.index - 20), m.index))) continue;
    // The method may sit in a fetch options object, or be passed in as a prop
    // from elsewhere. Guessing GET when it is absent invents drift that is not
    // there, so an undetermined method matches the path under any verb.
    // Docs tables write the verb before the path — { method: "GET", path: "..." }
    // — while a fetch options object writes it after. Looking only forward took
    // the *next* row's verb and invented drift on entire documentation pages, so
    // check a short window behind first.
    // The forward window must not cross into the next statement: a GET call
    // followed a line later by a PATCH call was being reported as PATCH.
    const ahead = src.slice(m.index, m.index + 300).split(/;|fetch\(/)[0];
    const method =
      src.slice(Math.max(0, m.index - 60), m.index).match(/method:\s*["'](GET|POST|PATCH|PUT|DELETE)["'][^"']*$/) ??
      ahead.match(/method:\s*["'](GET|POST|PATCH|PUT|DELETE)["']/);
    const before = src.slice(Math.max(0, m.index - 40), m.index);
    const isFetch = /fetch\(\s*$|fetch\(\s*apiUrl\(\s*$/.test(before);
    // next.config rewrites only /api-backend/* to the backend, so a bare
    // relative module URL hits the Next app itself and 404s into whatever
    // error handling the caller has. The path is right; the origin is not.
    //
    // A literal only carries an origin if something supplies one: apiUrl(...)
    // around it, or a `${getApiBase()}` prefix inside it — and a prefix means
    // the path does not start at index 0. Everything else is bare, whether it
    // goes straight into fetch() or reaches it through a prop or a variable.
    // Flag only positions where the string really is a request target: a fetch
    // argument, a browser-followed href/src, or an endpoint prop passed down to
    // one. A docs component rendering `path="/api/..."` as text, or a
    // helper like sitemap's fetchIds() that prepends the base itself, is not.
    const isTarget = /(?:fetch\(|href=\{?|src=\{?|endpoint=\{?)\s*$/.test(before);
    const wrappedInApiUrl = /apiUrl\(\s*$/.test(before);
    const wrongOrigin = isTarget && !wrappedInApiUrl && lit.indexOf(PREFIX) === 0;
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
// Both sides can carry an unknown segment: the route has :params, and the call
// may interpolate a variable — `/screener/${activeTest}` where activeTest is
// "phq9" | "gad7", both of which are real routes. Treating an unknown as literal
// text invents drift, so compare segment by segment and let an unknown match
// anything in that position.
const isUnknown = (seg) => seg.startsWith(":");

const pathsCompatible = (callPath, routePattern) => {
  const a = callPath.split("/");
  const b = routePattern.split("/");
  if (a.length !== b.length) return false;
  return a.every((seg, i) => isUnknown(seg) || isUnknown(b[i]) || seg === b[i]);
};

const compiled = backend.map((b) => ({ ...b, matches: (p) => pathsCompatible(p, b.pattern) }));

const unmatched = [];
const used = new Set();
const usedHandlers = new Set();
for (const c of calls) {
  // `/profiles/search` matches both `/profiles/:id` and `/profiles/search`.
  // Express resolves that with an explicit next("route") in the param handler,
  // so credit the literal route — otherwise it looks uncalled.
  const target = c.path;
  const hit = compiled
    .filter((b) => (c.method === "ANY" || b.method === c.method) && b.matches(target))
    .sort((a, b) => (a.pattern.match(/:/g)?.length ?? 0) - (b.pattern.match(/:/g)?.length ?? 0))[0];
  // Independent of Express: /api/metrics is served by BOTH a Next handler and
  // an Express route, and a relative call to it is correct either way.
  if (servedByNext(target)) c.next = true;

  if (hit) {
    used.add(`${hit.method} ${hit.pattern}`);
    usedHandlers.add(hit.handler);
  } else if (c.next) {
    // Already accounted for.
  } else if (
    // A base URL is not an endpoint: `servers: [{ url: ".../api/payments" }]`
    // in an OpenAPI doc, or `${origin}/api/payments/v1` built for display.
    // Recognise it as a strict prefix of routes that do exist.
    c.method === "ANY" &&
    [...backend.map((b) => b.pattern), ...nextRoutes].some((r) => r.startsWith(`${target}/`))
  ) {
    c.baseUrl = true;
  } else {
    unmatched.push(c);
  }
}

// A relative URL is the correct way to reach a Next handler — the rewrite is
// only needed for paths that must leave for the Express backend.
const misaddressed = calls.filter((c) => c.wrongOrigin && !c.next);

console.log(`frontend calls: ${calls.length} | backend routes: ${backend.length}`);
if (unmatched.length === 0) {
  console.log(`OK — every ${PREFIX} call resolves to a mounted route.`);
} else {
  console.log(`\nFRONTEND CALLS WITH NO BACKEND ROUTE (${unmatched.length}):`);
  for (const c of unmatched) console.log(`  ${c.where}:${c.line}  ${c.method} ${c.path}`);
}

if (misaddressed.length > 0) {
  console.log(`\nCALLS SENT TO THE WRONG ORIGIN (${misaddressed.length}):`);
  console.log(`  A bare relative ${PREFIX} URL reaches the Next app, not the backend.`);
  console.log("  Wrap it in apiUrl() or call it through buildApi.");
  for (const c of misaddressed) console.log(`  ${c.where}:${c.line}  ${c.method} ${c.path}`);
}

// Routes nothing calls are not a failure — admin tools, PDF/CSV links opened
// by the browser and public feeds all live here legitimately.
if (process.argv.includes("--list-unused")) {
  const seen = new Set();
  const dead = [];
  const aliases = [];
  for (const b of backend) {
    const k = `${b.method} ${b.pattern}`;
    if (used.has(k) || seen.has(k)) continue;
    seen.add(k);
    // The same handler reached under another prefix is an alias, not a route
    // nobody calls — /api/build/jobs/* duplicates /api/qjobs/*, and the pages
    // use the latter. Calls to that other prefix are outside this module's
    // scan, so judge by the mount table rather than by call counts.
    const aliased = usedHandlers.has(b.handler) || (prefixesPerFile[b.file]?.size ?? 0) > 1;
    (aliased ? aliases : dead).push(`  [${b.file}] ${k}`);
  }
  console.log(`\nBACKEND ROUTES NOT CALLED FROM frontend/src (${dead.length}):`);
  for (const line of dead) console.log(line);
  if (aliases.length > 0) {
    console.log(`\nSAME HANDLER, CALLED UNDER ANOTHER PREFIX (${aliases.length}) — not dead:`);
    for (const line of aliases) console.log(line);
  }
}

process.exit(unmatched.length === 0 && misaddressed.length === 0 ? 0 : 1);
