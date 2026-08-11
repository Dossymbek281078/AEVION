#!/usr/bin/env node
/**
 * Response-shape check for /api/build — the third side of the same triangle.
 *
 * build-contract-check.mjs asks whether the route exists. api-body-check.mjs
 * asks whether the fields sent match the fields read. This asks whether the
 * response the client's type promises is the response the handler actually
 * returns. A field that is declared and never returned is `undefined` at
 * runtime, which in this codebase renders as an empty spot rather than an
 * error — the same silence as the other two.
 *
 * NOT GATED IN CI YET, on purpose: it reports 13 findings on the current tree,
 * and four were confirmed by hand before this was committed:
 *   DELETE /references/:id        declares { ok }         returns { deleted }
 *   DELETE /portfolio/photos/:id  declares { ok }         returns { deleted }
 *   POST   /push/subscribe        declares { subscribed } returns { id, refreshed }
 *   POST   /stories/:id/like      declares likes          returns likeCount only
 * Gate it once those are fixed; gating a red check nobody owns teaches people
 * to ignore red checks.
 *
 * Judged only where it can be: a handler that returns a bare row or variable
 * (`ok(res, result.rows[0])`) is skipped rather than guessed at, and only
 * top-level keys are compared — a nested shape mismatch is out of reach for a
 * static read of this kind.
 *
 * Usage: node scripts/api-response-check.mjs   (DBG=1 prints declared/returned)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API = path.join(ROOT, "frontend/src/lib/build/api.ts");
const ROUTES_DIR = path.join(ROOT, "aevion-globus-backend/src/routes/build");
const BUILD_TS = path.join(ROOT, "aevion-globus-backend/src/routes/build.ts");
const DEBUG = process.env.DBG === "1";

const buildSrc = fs.readFileSync(BUILD_TS, "utf8");
const mounts = {};
for (const m of buildSrc.matchAll(/buildRouter\.use\(\s*["']([^"']+)["']\s*,\s*(\w+)\s*\)/g)) {
  (mounts[m[2]] ??= []).push(m[1] === "/" ? "" : m[1]);
}
const importFile = {};
for (const m of buildSrc.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']\.\/build\/([\w-]+)["']/g)) {
  for (const n of m[1].split(",").map((x) => x.trim()).filter(Boolean)) importFile[n] = m[2];
}

const handlers = new Map();
for (const [routerVar, prefixes] of Object.entries(mounts)) {
  const file = importFile[routerVar];
  if (!file) continue;
  const p = path.join(ROUTES_DIR, `${file}.ts`);
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, "utf8");
  const calls = [...src.matchAll(/\b\w*[Rr]outer\.(get|post|patch|put|delete)\(\s*["']([^"']*)["']/g)];
  calls.forEach((m, i) => {
    const body = src.slice(m.index, calls[i + 1]?.index ?? src.length);
    for (const prefix of prefixes) {
      handlers.set(`${m[1].toUpperCase()} /api/build${prefix}${m[2] === "/" ? "" : m[2]}`, body);
    }
  });
}

/** Top-level keys of every `ok(res, { ... })` in a handler. */
function returnedKeys(handler) {
  const out = new Set();
  let any = false;
  for (const m of handler.matchAll(/\bok\(\s*res\s*,\s*\{/g)) {
    any = true;
    // Walk to the matching brace so nested objects do not truncate the scan.
    let i = handler.indexOf("{", m.index);
    let depth = 0;
    const start = i;
    for (; i < handler.length; i++) {
      if (handler[i] === "{") depth++;
      else if (handler[i] === "}") { depth--; if (depth === 0) break; }
    }
    const inner = handler.slice(start + 1, i);
    // Only top-level keys: strip nested braces/brackets first.
    let flat = inner;
    for (let pass = 0; pass < 6; pass++) flat = flat.replace(/\{[^{}]*\}|\[[^[\]]*\]|\([^()]*\)/g, "");
    for (const k of flat.split(",")) {
      const name = k.split(":")[0].trim().replace(/^\.\.\./, "");
      if (/^[a-zA-Z_]\w*$/.test(name)) out.add(name);
    }
  }
  // Two shapes put the answer out of static reach: returning a bare row or
  // variable (`ok(res, result.rows[0])`), and spreading one into the object
  // (`ok(res, { ...r.rows[0], plaintext })`) — the spread can carry any column,
  // so a key that looks absent may well be there. Skip rather than guess; six
  // of the first thirteen findings turned out to be exactly this.
  const bare = /\bok\(\s*res\s*,\s*[a-zA-Z_]/.test(handler);
  const spread = /\bok\(\s*res\s*,\s*\{[\s\S]*?\.\.\./.test(handler);
  return { keys: out, judgeable: any && !bare && !spread };
}

/** Top-level keys of the declared `call<{ ... }>` generic. */
function declaredKeys(generic) {
  let flat = generic;
  for (let pass = 0; pass < 8; pass++) flat = flat.replace(/\{[^{}]*\}|\[[^[\]]*\]|\([^()]*\)|<[^<>]*>/g, "");
  const out = new Set();
  for (const part of flat.split(";")) {
    const name = part.split(":")[0].trim().replace(/\?$/, "");
    if (/^[a-zA-Z_]\w*$/.test(name)) out.add(name);
  }
  return out;
}

const apiSrc = fs.readFileSync(API, "utf8");
const LITERAL = String.raw`"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|\`(?:[^\`\\]|\\.)*\``;
const re = new RegExp(
  String.raw`call<\s*\{([\s\S]*?)\}\s*>\(\s*"(GET|POST|PATCH|PUT|DELETE)"\s*,\s*(${LITERAL})`,
  "g",
);

const findings = [];
for (const m of apiSrc.matchAll(re)) {
  const declared = declaredKeys(m[1]);
  const method = m[2];
  // `${qs ? "?" + qs : ""}` collapses to a `:x` glued onto the last segment —
  // that is an interpolated query string, not a path segment, and leaving it on
  // made /profiles/search match /profiles/:id.
  const callPath = m[3]
    .slice(1, -1)
    .replace(/\$\{[^}]*\}/g, ":x")
    .split("?")[0]
    .replace(/(?<!\/):x$/, "");
  const line = apiSrc.slice(0, m.index).split("\n").length;
  if (declared.size === 0) continue;

  const cands = [...handlers.entries()]
    .filter(([k]) => {
      const [hm, hp] = k.split(" ");
      if (hm !== method) return false;
      const a = callPath.split("/");
      const b = hp.split("/");
      return a.length === b.length && a.every((s, i) => s.startsWith(":") || b[i].startsWith(":") || s === b[i]);
    })
    .map((e) => {
      const a = callPath.split("/");
      const b = e[0].split(" ")[1].split("/");
      return { e, literal: a.filter((s, i) => !s.startsWith(":") && s === b[i]).length };
    })
    .sort((x, y) => y.literal - x.literal)
    .map((x) => x.e);
  if (!cands.length) continue;

  const [chosen, handler] = cands[0];
  const { keys: returned, judgeable } = returnedKeys(handler);
  if (!judgeable) continue;

  const absent = [...declared].filter((k) => !returned.has(k));
  if (absent.length) {
    if (DEBUG) console.error(`DBG ${method} ${callPath} -> ${chosen} | declared=${[...declared]} | returned=${[...returned]}`);
    findings.push({ line, method, path: callPath, keys: absent });
  }
}

console.log(findings.length === 0
  ? "OK /api/build responses — every declared key is returned"
  : `FAIL /api/build responses — ${findings.length} call(s) declare a key the handler never returns`);
for (const f of findings) console.log(`  frontend/src/lib/build/api.ts:${f.line}  ${f.method} ${f.path}  ->  ${f.keys.join(", ")}`);
process.exit(findings.length === 0 ? 0 : 1);
