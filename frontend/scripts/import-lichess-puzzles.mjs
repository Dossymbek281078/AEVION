#!/usr/bin/env node
/**
 * Import & filter Lichess puzzle DB into AEVION CyberChess puzzles.json.
 *
 * USAGE:
 *   1. Download CSV from https://database.lichess.org/#puzzles (~300 MB zstd).
 *      Decompress to plain CSV (`zstd -d lichess_db_puzzle.csv.zst`).
 *   2. From repo root:  node frontend/scripts/import-lichess-puzzles.mjs \
 *                            --in ./lichess_db_puzzle.csv \
 *                            --out ./frontend/public/puzzles.json \
 *                            --limit 20000 \
 *                            --min-rating 600 --max-rating 2600
 *
 * Lichess CSV columns:
 *   PuzzleId, FEN, Moves, Rating, RatingDeviation, Popularity, NbPlays,
 *   Themes, GameUrl, OpeningTags
 *
 * Output format (per puzzle):
 *   { fen, sol: string[], name, r, theme, phase, side, goal, mateIn? }
 *   - fen is the position AFTER the opponent's setup move (i.e. the student's turn)
 *   - sol[] is the student's solution in UCI (then opp reply, then student, ...)
 */
import fs from "node:fs";
import path from "node:path";
import { Chess } from "chess.js";

const args = parseArgs(process.argv.slice(2));
const IN = args.in || "./lichess_db_puzzle.csv";
const OUT = args.out || "./frontend/public/puzzles.json";
const LIMIT = +(args.limit || 20000);
const MIN_RATING = +(args["min-rating"] || 600);
const MAX_RATING = +(args["max-rating"] || 2600);
const MIN_PLAYS = +(args["min-plays"] || 100);
const MIN_POP = +(args["min-popularity"] || 80);

if (!fs.existsSync(IN)) {
  console.error(`❌ Input CSV not found: ${IN}`);
  console.error(`   Download from https://database.lichess.org/#puzzles and decompress.`);
  process.exit(1);
}

console.log(`📥 Reading ${IN}`);
const raw = fs.readFileSync(IN, "utf8");
const lines = raw.split(/\r?\n/);
const header = lines[0];
console.log(`   header: ${header}`);

// Stratified bucket to keep difficulty diverse.
const buckets = {
  "<900":  { cap: Math.floor(LIMIT * 0.10), items: [] },
  "900":   { cap: Math.floor(LIMIT * 0.15), items: [] },
  "1200":  { cap: Math.floor(LIMIT * 0.20), items: [] },
  "1500":  { cap: Math.floor(LIMIT * 0.20), items: [] },
  "1800":  { cap: Math.floor(LIMIT * 0.15), items: [] },
  "2100":  { cap: Math.floor(LIMIT * 0.12), items: [] },
  "2400+": { cap: Math.floor(LIMIT * 0.08), items: [] },
};
const bucketOf = (r) =>
  r < 900 ? "<900" : r < 1200 ? "900" : r < 1500 ? "1200"
  : r < 1800 ? "1500" : r < 2100 ? "1800" : r < 2400 ? "2100" : "2400+";

let seen = 0, skipped = 0, kept = 0;
for (let li = 1; li < lines.length; li++) {
  const line = lines[li];
  if (!line) continue;
  seen++;
  const cells = splitCsv(line);
  if (cells.length < 8) { skipped++; continue; }
  const [id, fen, moves, ratingStr, , popStr, playsStr, themesStr] = cells;
  const rating = +ratingStr;
  const pop = +popStr;
  const plays = +playsStr;
  if (!rating || rating < MIN_RATING || rating > MAX_RATING) { skipped++; continue; }
  if (plays < MIN_PLAYS || pop < MIN_POP) { skipped++; continue; }
  const b = buckets[bucketOf(rating)];
  if (b.items.length >= b.cap) { skipped++; continue; }

  // Apply the opponent's setup move so `fen` becomes the student's turn.
  const mv = moves.split(" ");
  if (mv.length < 2) { skipped++; continue; }
  let ch;
  try { ch = new Chess(fen); } catch { skipped++; continue; }
  const setup = mv[0];
  try {
    const r = ch.move({ from: setup.slice(0, 2), to: setup.slice(2, 4), promotion: setup[4] });
    if (!r) throw 0;
  } catch { skipped++; continue; }
  const puzzleFen = ch.fen();
  const sol = mv.slice(1);
  if (!sol.length) { skipped++; continue; }

  const themes = themesStr.split(" ").filter(Boolean);
  const mateMatch = themes.find(t => /^mateIn\d+$/.test(t));
  const goal = mateMatch ? "Mate" : "Best move";
  const mateIn = mateMatch ? +mateMatch.replace("mateIn", "") : undefined;
  const phase = themes.includes("endgame") ? "Endgame"
    : themes.includes("opening") ? "Opening" : "Middlegame";
  const side = puzzleFen.split(" ")[1] === "w" ? "w" : "b";
  const primaryTheme = themes.find(t => !/^mateIn\d+$/.test(t) && t !== "opening" && t !== "middlegame" && t !== "endgame") || themes[0] || "tactic";

  b.items.push({
    fen: puzzleFen,
    sol,
    name: `L${id}`,
    r: rating,
    theme: primaryTheme,
    phase,
    side,
    goal,
    ...(mateIn !== undefined ? { mateIn } : {}),
  });
  kept++;
  if (kept % 2000 === 0) console.log(`   … kept ${kept} so far (scanned ${seen})`);
}

const all = Object.values(buckets).flatMap(b => b.items);
console.log(`\n📊 Buckets:`);
for (const [k, b] of Object.entries(buckets)) console.log(`   ${k.padEnd(6)} → ${String(b.items.length).padStart(5)} (cap ${b.cap})`);
console.log(`\n✅ Kept ${all.length} puzzles from ${seen} rows (${skipped} skipped).`);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(all));
const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(2);
console.log(`💾 Wrote ${OUT} (${mb} MB)\n`);

function parseArgs(arr) {
  const o = {};
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i];
    if (a.startsWith("--")) { o[a.slice(2)] = arr[i + 1]; i++; }
  }
  return o;
}
function splitCsv(line) {
  // Lichess DB doesn't quote, simple split is safe. Keep only 10 cells max.
  return line.split(",");
}
