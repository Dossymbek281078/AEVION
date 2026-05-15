#!/usr/bin/env node
/**
 * Import & filter Lichess puzzle DB into AEVION CyberChess puzzles.json.
 *
 * STREAMING + INCREMENTAL: scans the (huge) Lichess CSV line-by-line via
 * node:readline, so it can handle the full ~4M-row dataset without loading
 * everything into memory. By default it MERGES new puzzles into the existing
 * puzzles.json (dedup by FEN and Lichess PuzzleId) instead of replacing it,
 * so an existing curated set is preserved and only grows.
 *
 * USAGE:
 *   1. Download CSV from https://database.lichess.org/#puzzles (~300 MB zstd).
 *      Decompress to plain CSV (`zstd -d lichess_db_puzzle.csv.zst` →
 *      produces `lichess_db_puzzle.csv`, ~900 MB).
 *      On Windows without zstd CLI: 7-Zip 22.01+ extracts .zst archives.
 *   2. From repo root:
 *        node frontend/scripts/import-lichess-puzzles.mjs \
 *             --in ./lichess_db_puzzle.csv \
 *             --out ./frontend/public/puzzles.json \
 *             --limit 5000 \
 *             --min-rating 800 --max-rating 2200
 *
 *      Flags:
 *        --in <path>           Input CSV path (required, must exist).
 *        --out <path>          Output JSON path (default: frontend/public/puzzles.json).
 *        --limit <N>           How many NEW puzzles to add (default 5000).
 *        --min-rating <N>      Min Lichess rating (default 800).
 *        --max-rating <N>      Max Lichess rating (default 2200).
 *        --min-plays <N>       Min NbPlays (signal of stability, default 100).
 *        --min-popularity <N>  Min Popularity (default 80, range 0..100).
 *        --themes <csv>        Only keep puzzles tagged with at least one of these
 *                              Lichess themes (default: educational tactics —
 *                              mate,fork,pin,skewer,discoveredAttack,sacrifice,
 *                              attraction,deflection,decoy,attack).
 *                              Pass "any" to disable the theme filter.
 *        --replace             Overwrite puzzles.json instead of merging.
 *        --dry-run             Scan & report only; don't write the JSON.
 *
 * Lichess CSV columns:
 *   PuzzleId, FEN, Moves, Rating, RatingDeviation, Popularity, NbPlays,
 *   Themes, GameUrl, OpeningTags
 *
 * Output format (per puzzle):
 *   { fen, sol: string[], name, r, theme, phase, side, goal, mateIn? }
 *   - fen is the position AFTER the opponent's setup move (i.e. the student's turn)
 *   - sol[] is the student's solution in UCI (then opp reply, then student, ...)
 *   - name "L<PuzzleId>" preserves the Lichess id for dedup on subsequent runs.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { Chess } from "chess.js";

const args = parseArgs(process.argv.slice(2));
const IN = args.in;
const OUT = args.out || "./frontend/public/puzzles.json";
const LIMIT = +(args.limit || 5000);
const MIN_RATING = +(args["min-rating"] || 800);
const MAX_RATING = +(args["max-rating"] || 2200);
const MIN_PLAYS = +(args["min-plays"] || 100);
const MIN_POP = +(args["min-popularity"] || 80);
const REPLACE = !!args.replace;
const DRY = !!args["dry-run"];
const DEFAULT_THEMES =
  "mate,fork,pin,skewer,discoveredAttack,sacrifice,attraction,deflection,decoy,attack";
const themeArg = (args.themes || DEFAULT_THEMES).trim();
const THEME_FILTER =
  themeArg.toLowerCase() === "any"
    ? null
    : new Set(themeArg.split(",").map((s) => s.trim()).filter(Boolean));

if (!IN) {
  console.error(`Usage: --in <lichess_db_puzzle.csv> required.`);
  console.error(
    `Download from https://database.lichess.org/#puzzles, decompress, then re-run.`,
  );
  process.exit(1);
}
if (!fs.existsSync(IN)) {
  console.error(`Input CSV not found: ${IN}`);
  console.error(
    `Download from https://database.lichess.org/#puzzles and decompress` +
      ` (zstd -d lichess_db_puzzle.csv.zst).`,
  );
  process.exit(1);
}

// ---------- Load existing puzzles.json so we can dedup & append ----------
let existing = [];
const existingFens = new Set();
const existingIds = new Set(); // "L<PuzzleId>" names
if (!REPLACE && fs.existsSync(OUT)) {
  try {
    existing = JSON.parse(fs.readFileSync(OUT, "utf8"));
    if (!Array.isArray(existing)) {
      console.warn(`Existing ${OUT} is not an array, treating as empty.`);
      existing = [];
    }
    for (const p of existing) {
      if (p && typeof p.fen === "string") existingFens.add(p.fen);
      if (p && typeof p.name === "string" && /^L\w+$/.test(p.name)) {
        existingIds.add(p.name);
      }
    }
    console.log(
      `Loaded existing ${OUT}: ${existing.length} puzzles ` +
        `(${existingFens.size} unique FENs, ${existingIds.size} lichess ids).`,
    );
  } catch (e) {
    console.warn(`Could not parse existing ${OUT}: ${e?.message || e}. ` +
      `Starting fresh; pass --replace to silence this.`);
    existing = [];
  }
}

// ---------- Stratified buckets to keep difficulty diverse ----------
const buckets = {
  "<900":  { cap: Math.max(1, Math.floor(LIMIT * 0.10)), items: [] },
  "900":   { cap: Math.max(1, Math.floor(LIMIT * 0.18)), items: [] },
  "1200":  { cap: Math.max(1, Math.floor(LIMIT * 0.22)), items: [] },
  "1500":  { cap: Math.max(1, Math.floor(LIMIT * 0.22)), items: [] },
  "1800":  { cap: Math.max(1, Math.floor(LIMIT * 0.18)), items: [] },
  "2100+": { cap: Math.max(1, Math.floor(LIMIT * 0.10)), items: [] },
};
const bucketOf = (r) =>
  r < 900  ? "<900"
  : r < 1200 ? "900"
  : r < 1500 ? "1200"
  : r < 1800 ? "1500"
  : r < 2100 ? "1800"
  : "2100+";
const allBucketsFull = () =>
  Object.values(buckets).every((b) => b.items.length >= b.cap);

// ---------- Stream CSV line-by-line ----------
console.log(`Streaming ${IN} (rating ${MIN_RATING}-${MAX_RATING}, ` +
  `themes=${THEME_FILTER ? [...THEME_FILTER].join("|") : "any"}, ` +
  `target=${LIMIT} new puzzles)`);

const rl = readline.createInterface({
  input: fs.createReadStream(IN, { encoding: "utf8" }),
  crlfDelay: Infinity,
});

let scanned = 0;
let skipped = 0;
let kept = 0;
let headerSeen = false;

rl.on("line", (line) => {
  if (!line) return;
  if (!headerSeen) {
    headerSeen = true;
    console.log(`  header: ${line}`);
    return;
  }
  // Early-exit once all buckets are full.
  if (allBucketsFull()) {
    rl.close();
    return;
  }
  scanned++;
  if (scanned % 100000 === 0) {
    console.log(`  scanned ${scanned}, kept ${kept}…`);
  }
  const cells = splitCsv(line);
  if (cells.length < 8) { skipped++; return; }
  const [id, fen, moves, ratingStr, , popStr, playsStr, themesStr] = cells;

  const rating = +ratingStr;
  if (!rating || rating < MIN_RATING || rating > MAX_RATING) { skipped++; return; }
  const plays = +playsStr;
  const pop = +popStr;
  if (plays < MIN_PLAYS || pop < MIN_POP) { skipped++; return; }

  const lichessName = `L${id}`;
  if (existingIds.has(lichessName)) { skipped++; return; }

  const themes = themesStr.split(" ").filter(Boolean);
  if (THEME_FILTER && !themes.some((t) => THEME_FILTER.has(t))) {
    skipped++; return;
  }

  const b = buckets[bucketOf(rating)];
  if (b.items.length >= b.cap) { skipped++; return; }

  // Apply the opponent's setup move so the stored FEN is "student to move".
  const mv = moves.split(" ");
  if (mv.length < 2) { skipped++; return; }
  let ch;
  try { ch = new Chess(fen); } catch { skipped++; return; }
  const setup = mv[0];
  try {
    const r = ch.move({
      from: setup.slice(0, 2),
      to: setup.slice(2, 4),
      promotion: setup[4],
    });
    if (!r) throw 0;
  } catch { skipped++; return; }
  const puzzleFen = ch.fen();
  if (existingFens.has(puzzleFen)) { skipped++; return; }

  const sol = mv.slice(1);
  if (!sol.length) { skipped++; return; }

  const mateMatch = themes.find((t) => /^mateIn\d+$/.test(t));
  const goal = mateMatch ? "Mate" : "Best move";
  const mateIn = mateMatch ? +mateMatch.replace("mateIn", "") : undefined;
  const phase = themes.includes("endgame")
    ? "Endgame"
    : themes.includes("opening")
      ? "Opening"
      : "Middlegame";
  const side = puzzleFen.split(" ")[1] === "w" ? "w" : "b";
  const primaryTheme =
    themes.find(
      (t) =>
        !/^mateIn\d+$/.test(t) &&
        t !== "opening" &&
        t !== "middlegame" &&
        t !== "endgame",
    ) || themes[0] || "tactic";

  b.items.push({
    fen: puzzleFen,
    sol,
    name: lichessName,
    r: rating,
    theme: primaryTheme,
    phase,
    side,
    goal,
    ...(mateIn !== undefined ? { mateIn } : {}),
  });
  existingFens.add(puzzleFen);
  existingIds.add(lichessName);
  kept++;
});

rl.on("close", () => {
  const added = Object.values(buckets).flatMap((b) => b.items);

  console.log(`\nBuckets (new puzzles only):`);
  for (const [k, b] of Object.entries(buckets)) {
    console.log(
      `  ${k.padEnd(6)} → ${String(b.items.length).padStart(5)} / cap ${b.cap}`,
    );
  }
  console.log(
    `\nScanned ${scanned} rows, added ${added.length} new puzzles ` +
      `(${skipped} skipped).`,
  );

  const finalArr = REPLACE ? added : existing.concat(added);
  console.log(
    `Final dataset: ${finalArr.length} puzzles ` +
      `(was ${existing.length}, +${added.length}).`,
  );

  if (DRY) {
    console.log(`--dry-run: not writing ${OUT}.`);
    return;
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(finalArr));
  const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(2);
  console.log(`Wrote ${OUT} (${mb} MB)`);
});

// ---------- helpers ----------
function parseArgs(arr) {
  const o = {};
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = arr[i + 1];
    if (next === undefined || next.startsWith("--")) {
      o[key] = true; // boolean flag
    } else {
      o[key] = next;
      i++;
    }
  }
  return o;
}

function splitCsv(line) {
  // Lichess DB doesn't quote any field; a naïve comma split is safe & fast.
  return line.split(",");
}
