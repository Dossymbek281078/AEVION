// Expand public/openings.json from the CC0 lichess-org/chess-openings dataset.
//
// Input:  scratchpad eco_{a..e}.tsv (eco \t name \t pgn-in-SAN)
// Output: public/openings.json  ({eco, name, moves: UCI-string, desc})
//
// The existing 163 curated entries (with human `desc` blurbs) WIN over the
// dataset on identical move sequences, so their descriptions survive. All new
// lines come in with desc:"". Keyed/deduped by the UCI move string.
//
// Run:  node scripts/expand-openings.mjs <scratchpadDir>

import { Chess } from "chess.js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicJson = join(__dirname, "..", "public", "openings.json");
const scratch = process.argv[2];
if (!scratch) {
  console.error("usage: node expand-openings.mjs <scratchpadDir>");
  process.exit(1);
}

// SAN movetext (with move numbers) → space-separated UCI, or null on failure.
function pgnToUci(pgn) {
  try {
    const g = new Chess();
    g.loadPgn(pgn);
    const hist = g.history({ verbose: true });
    if (!hist.length) return null;
    return hist.map((m) => m.from + m.to + (m.promotion || "")).join(" ");
  } catch {
    return null;
  }
}

const rows = [];
let parsed = 0,
  failed = 0;
for (const f of ["a", "b", "c", "d", "e"]) {
  const p = join(scratch, `eco_${f}.tsv`);
  if (!existsSync(p)) {
    console.warn(`missing ${p} — skipping`);
    continue;
  }
  const lines = readFileSync(p, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith("eco\t")) continue;
    const [eco, name, pgn] = line.split("\t");
    if (!eco || !name || !pgn) continue;
    const uci = pgnToUci(pgn);
    if (!uci) {
      failed++;
      continue;
    }
    rows.push({ eco, name, moves: uci, desc: "" });
    parsed++;
  }
}
console.log(`dataset: parsed ${parsed}, failed ${failed}`);

// Merge: dataset first, curated overrides (keeps desc).
const byMoves = new Map();
for (const r of rows) byMoves.set(r.moves, r);

let curatedKept = 0;
if (existsSync(publicJson)) {
  const curated = JSON.parse(readFileSync(publicJson, "utf-8"));
  for (const c of curated) {
    if (!c || !c.moves) continue;
    byMoves.set(c.moves, { eco: c.eco, name: c.name, moves: c.moves, desc: c.desc || "" });
    curatedKept++;
  }
}
console.log(`curated overlaid: ${curatedKept}`);

const merged = [...byMoves.values()].sort((a, b) => a.eco.localeCompare(b.eco) || a.name.localeCompare(b.name));
// Compact JSON to keep the client download small (lazy-loaded in idle).
writeFileSync(publicJson, JSON.stringify(merged));
const bytes = readFileSync(publicJson).length;
console.log(`wrote ${merged.length} openings → ${(bytes / 1024).toFixed(0)} KB`);
