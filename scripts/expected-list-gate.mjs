#!/usr/bin/env node
// expected-list-gate: generic invariant gate "actual set must match expected
// list". The pattern behind three local audits that each caught real drift
// (scheduled tasks, git branches, module mounts): a module declares its
// invariant as a plain text list, CI compares it against reality and fails
// loudly instead of drifting silently.
//
// Usage:
//   node scripts/expected-list-gate.mjs --expected <file> --actual <file|-> [options]
//     --expected <file>   one item per line, '#' comments and blanks ignored
//     --actual <file|->   same format; '-' reads stdin (pipe a live probe in)
//     --name <label>      label for report lines (default: gate)
//     --allow-extra       UNEXPECTED items warn instead of failing
//     --allow-missing     MISSING items warn instead of failing
//
// Exit codes: 0 = clean (or only warnings), 1 = drift, 2 = usage error.
//
// Example (module mounts): a module lists its routes in
// modules/foo/expected-routes.txt; CI probes the live server and pipes the
// answering routes in:
//   node scripts/probe-routes.mjs | node scripts/expected-list-gate.mjs \
//     --expected modules/foo/expected-routes.txt --actual - --name foo-mounts
'use strict';
import fs from 'node:fs';

function parseArgs(argv) {
  const a = { name: 'gate', allowExtra: false, allowMissing: false };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--expected') a.expected = argv[++i];
    else if (k === '--actual') a.actual = argv[++i];
    else if (k === '--name') a.name = argv[++i];
    else if (k === '--allow-extra') a.allowExtra = true;
    else if (k === '--allow-missing') a.allowMissing = true;
    else { console.error(`unknown arg: ${k}`); process.exit(2); }
  }
  if (!a.expected || !a.actual) {
    console.error('usage: expected-list-gate.mjs --expected <file> --actual <file|-> [--name x] [--allow-extra] [--allow-missing]');
    process.exit(2);
  }
  return a;
}

function readList(pathOrDash) {
  const raw = pathOrDash === '-'
    ? fs.readFileSync(0, 'utf8')
    : fs.readFileSync(pathOrDash, 'utf8');
  return new Set(
    raw.split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#')),
  );
}

const args = parseArgs(process.argv);
const expected = readList(args.expected);
const actual = readList(args.actual);

const missing = [...expected].filter((x) => !actual.has(x));
const extra = [...actual].filter((x) => !expected.has(x));

let failed = false;
for (const m of missing) {
  const tag = args.allowMissing ? 'WARN missing' : 'FAIL missing';
  console.log(`[${args.name}] ${tag}: ${m}`);
  if (!args.allowMissing) failed = true;
}
for (const e of extra) {
  const tag = args.allowExtra ? 'WARN unexpected' : 'FAIL unexpected';
  console.log(`[${args.name}] ${tag}: ${e}`);
  if (!args.allowExtra) failed = true;
}
console.log(`[${args.name}] expected=${expected.size} actual=${actual.size} missing=${missing.length} unexpected=${extra.length} -> ${failed ? 'DRIFT' : 'OK'}`);
process.exit(failed ? 1 : 0);
