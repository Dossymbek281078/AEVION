#!/usr/bin/env node
/**
 * Request-body contract check for /api/build.
 *
 * build-contract-check.mjs answers "does this route exist". It cannot see the
 * other half of the same failure: right path, right verb, disagreeing field
 * names. That is not hypothetical — the 2026-08-10 sweep found the video-room
 * invite sending `{ userId }` where the handler reads `req.body?.guestId`, and
 * the safety briefing sending `{ checkedItemIds }` where it reads `items`. Both
 * answered 400 into an empty catch, so nothing on screen said anything.
 *
 * Compares the keys each buildApi call sends against the fields the matching
 * handler reads, and reports keys sent that nothing reads. Not the reverse: a
 * handler may read optional fields nobody sends yet.
 *
 * Bar it had to clear before being committed, since a checker that invents
 * findings is worse than none: zero findings on the clean tree, and
 * reintroducing either historical bug is caught by name. Both verified.
 *
 * Matching a call to its handler is the part that goes wrong. Params match
 * anything, so /applications/:id/snooze also fits /applications/bulk-message/
 * :vacancyId — and counting params does not break the tie, because both have
 * one. Candidates are ranked by how many positions agree literally, so the
 * route that spells the call's own words wins. Getting that wrong is what made
 * the first draft report three routes whose fields are read plainly.
 *
 * A key counts as read if the handler names it as `req.body.x`, `req.body?.x`,
 * destructures it out of req.body, or passes it to a validator as a quoted
 * name. A handler that never names any body field is skipped rather than
 * reported — it may be spreading the body wholesale.
 *
 * Usage: node scripts/api-body-check.mjs   (DBG=1 prints the chosen handler)
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

const readsKey = (h, key) =>
  new RegExp(String.raw`req\.body\??\.${key}\b`).test(h) ||
  new RegExp(String.raw`["']${key}["']`).test(h) ||
  new RegExp(String.raw`\{[^}]*\b${key}\b[^}]*\}\s*=\s*req\.body`, "s").test(h);

const namesAnyBodyField = (h) => /req\.body\??\.\w|\}\s*=\s*req\.body/.test(h);

const apiSrc = fs.readFileSync(API, "utf8");
const LITERAL = String.raw`"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|\`(?:[^\`\\]|\\.)*\``;
const re = new RegExp(
  String.raw`call<[\s\S]*?>\(\s*"(POST|PATCH|PUT)"\s*,\s*(${LITERAL})\s*,\s*\{([^}]*)\}`,
  "g",
);

const findings = [];
for (const m of apiSrc.matchAll(re)) {
  const method = m[1];
  const callPath = m[2].slice(1, -1).replace(/\$\{[^}]*\}/g, ":x").split("?")[0];
  const line = apiSrc.slice(0, m.index).split("\n").length;
  const keys = m[3].split(",").map((k) => k.split(":")[0].trim()).filter((k) => /^[a-zA-Z_]\w*$/.test(k));
  if (!keys.length) continue;

  const cands = [...handlers.entries()]
    .filter(([k]) => {
      const [hm, hp] = k.split(" ");
      if (hm !== method) return false;
      const a = callPath.split("/");
      const b = hp.split("/");
      return a.length === b.length && a.every((s, i) => s.startsWith(":") || b[i].startsWith(":") || s === b[i]);
    })
    // Counting params is not enough: /applications/bulk-message/:vacancyId and
    // /applications/:id/snooze both have one, so a tie let the call's literal
    // "snooze" bind to ":vacancyId". Rank by how many positions agree literally
    // — the route that actually spells the call's words wins.
    .map((e) => {
      const a = callPath.split("/");
      const b = e[0].split(" ")[1].split("/");
      const literal = a.filter((s, i) => !s.startsWith(":") && s === b[i]).length;
      return { e, literal };
    })
    .sort((x, y) => y.literal - x.literal)
    .map((x) => x.e);
  if (!cands.length) continue;
  const [chosenKey, handler] = cands[0];
  if (!namesAnyBodyField(handler)) continue;

  const unread = keys.filter((k) => !readsKey(handler, k));
  if (unread.length) {
    if (DEBUG) {
      console.error(`DBG call ${method} ${callPath} keys=${keys} -> chose ${chosenKey}`);
      console.error(`DBG candidates: ${cands.map((c) => c[0]).join(" | ")}`);
      console.error(`DBG handler head: ${JSON.stringify(handler.slice(0, 90))}`);
    }
    findings.push({ line, method, path: callPath, keys: unread });
  }
}

console.log(findings.length === 0
  ? "OK /api/build request bodies — every key sent is read by its handler"
  : `FAIL /api/build request bodies — ${findings.length} call(s) send a key nothing reads`);
for (const f of findings) console.log(`  frontend/src/lib/build/api.ts:${f.line}  ${f.method} ${f.path}  ->  ${f.keys.join(", ")}`);
process.exit(findings.length === 0 ? 0 : 1);
