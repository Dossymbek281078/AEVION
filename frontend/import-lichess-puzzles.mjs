#!/usr/bin/env node
/**
 * AEVION CyberChess — Lichess puzzle database importer
 *
 * Downloads, filters, and converts the Lichess CC0 puzzle database
 * into AEVION's internal Puzzle format.
 *
 * Source: https://database.lichess.org/#puzzles
 * License: CC0 (public domain, commercial use allowed)
 *
 * Usage (from frontend directory):
 *   node import-lichess-puzzles.mjs --input lichess_db_puzzle.csv --output public/puzzles.json
 *
 * Flags:
 *   --input <path>         Path to lichess_db_puzzle.csv (required)
 *   --output <path>        Output JSON path (default: public/puzzles.json)
 *   --count <N>            Max puzzles to keep (default: 5000)
 *   --min-rating <N>       Minimum puzzle rating (default: 400)
 *   --max-rating <N>       Maximum puzzle rating (default: 2800)
 *   --min-popularity <N>   Minimum popularity score -100..100 (default: 85)
 *   --min-plays <N>        Minimum times played (default: 500)
 *   --max-deviation <N>    Maximum Glicko rating deviation (default: 80)
 *   --themes <list>        Comma-separated themes to include (default: all)
 *   --mate-ratio <N>       Fraction of mate puzzles 0..1 (default: 0.3)
 *   --endgame-ratio <N>    Fraction of endgame puzzles 0..1 (default: 0.25)
 *   --backup               Backup old puzzles.json before overwriting
 *   --dry-run              Print stats but don't write file
 *   --verbose              Log progress per 10k rows
 *
 * Examples:
 *   # Default: 5000 high-quality puzzles balanced across themes
 *   node import-lichess-puzzles.mjs --input lichess_db_puzzle.csv
 *
 *   # Custom: 2000 puzzles, rating 1000-1800, only mates + forks
 *   node import-lichess-puzzles.mjs --input ... --count 2000 \
 *     --min-rating 1000 --max-rating 1800 --themes "mate,fork"
 *
 *   # Massive: 20,000 puzzles, any rating (for backend DB)
 *   node import-lichess-puzzles.mjs --input ... --count 20000 --min-rating 400 --max-rating 3000
 */

import { createReadStream, existsSync, writeFileSync, copyFileSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createInterface } from "node:readline";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// ─── CLI arg parsing ────────────────────────────────────────────────────────
function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const val = process.argv[idx + 1];
  return val && !val.startsWith("--") ? val : true;
}

const INPUT_PATH = arg("input");
const OUTPUT_PATH = arg("output", "public/puzzles.json");
const COUNT = parseInt(arg("count", "5000"));
const MIN_RATING = parseInt(arg("min-rating", "400"));
const MAX_RATING = parseInt(arg("max-rating", "2800"));
const MIN_POPULARITY = parseInt(arg("min-popularity", "85"));
const MIN_PLAYS = parseInt(arg("min-plays", "500"));
const MAX_DEVIATION = parseInt(arg("max-deviation", "80"));
const THEMES_FILTER = arg("themes") ? String(arg("themes")).split(",").map(s => s.trim()).filter(Boolean) : null;
const MATE_RATIO = parseFloat(arg("mate-ratio", "0.3"));
const ENDGAME_RATIO = parseFloat(arg("endgame-ratio", "0.25"));
const BACKUP = !!arg("backup", false);
const DRY_RUN = !!arg("dry-run", false);
const VERBOSE = !!arg("verbose", false);

if (!INPUT_PATH) {
  console.error("\n❌ --input <path-to-lichess_db_puzzle.csv> is required");
  console.error("   Download from: https://database.lichess.org/#puzzles");
  console.error("   File: lichess_db_puzzle.csv.zst (decompress with 7-Zip)\n");
  console.error("Run with --help for full flag list (see top of file)\n");
  process.exit(1);
}

if (!existsSync(INPUT_PATH)) {
  console.error(`\n❌ Input file not found: ${INPUT_PATH}\n`);
  process.exit(1);
}

// ─── Load chess.js for validation ───────────────────────────────────────────
let Chess;
async function loadChess() {
  try { const m = await import("chess.js"); return m.Chess; } catch {}
  try {
    const require = createRequire(resolve(process.cwd(), "package.json"));
    return require("chess.js").Chess;
  } catch {}
  const candidates = [
    resolve(process.cwd(), "node_modules/chess.js/dist/esm/chess.js"),
    resolve(process.cwd(), "../node_modules/chess.js/dist/esm/chess.js"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      try { const m = await import(pathToFileURL(p).href); return m.Chess; } catch {}
    }
  }
  return null;
}

Chess = await loadChess();
if (!Chess) {
  console.error("\n❌ chess.js not found. Run from frontend directory.\n");
  process.exit(2);
}

// ─── Theme mapping Lichess → AEVION ─────────────────────────────────────────
// Full list: https://github.com/lichess-org/lila/blob/master/translation/source/puzzleTheme.xml
const THEME_NAMES = {
  // Motifs
  fork: "Вилка",
  pin: "Связка",
  skewer: "Рентген",
  discoveredAttack: "Вскрытое нападение",
  doubleCheck: "Двойной шах",
  xRayAttack: "Рентген",
  sacrifice: "Жертва",
  deflection: "Отвлечение",
  attraction: "Завлечение",
  clearance: "Освобождение",
  interference: "Перекрытие",
  trappedPiece: "Ловля фигуры",
  zugzwang: "Цугцванг",
  hangingPiece: "Висящая фигура",
  capturingDefender: "Уничтожение защитника",
  intermezzo: "Промежуточный ход",
  // Tactics
  advancedPawn: "Продвинутая пешка",
  exposedKing: "Открытый король",
  kingsideAttack: "Атака на короля",
  queensideAttack: "Атака на ферзевом",
  attackingF2F7: "Атака на f2/f7",
  // Checkmate patterns
  mate: "Мат",
  mateIn1: "Мат в 1",
  mateIn2: "Мат в 2",
  mateIn3: "Мат в 3",
  mateIn4: "Мат в 4",
  mateIn5: "Мат в 5",
  smotheredMate: "Спёртый мат",
  backRankMate: "Мат по последней горизонтали",
  anastasiaMate: "Мат Анастасии",
  arabianMate: "Арабский мат",
  bodenMate: "Мат Боудена",
  doubleBishopMate: "Мат двумя слонами",
  dovetailMate: "Мат «ласточкин хвост»",
  hookMate: "Мат крючком",
  vukovicMate: "Мат Вуковича",
  // Phases
  opening: "Дебют",
  middlegame: "Миттельшпиль",
  endgame: "Эндшпиль",
  rookEndgame: "Ладейный эндшпиль",
  bishopEndgame: "Слоновый эндшпиль",
  knightEndgame: "Коневой эндшпиль",
  queenEndgame: "Ферзевый эндшпиль",
  pawnEndgame: "Пешечный эндшпиль",
  queenRookEndgame: "Ферзь и ладья",
  // Goals
  advantage: "Перевес",
  crushing: "Разгром",
  equality: "Уравнение",
  // Length
  oneMove: "Один ход",
  short: "Короткая",
  long: "Длинная",
  veryLong: "Очень длинная",
};

function translateTheme(theme) {
  return THEME_NAMES[theme] || theme.replace(/([A-Z])/g, " $1").toLowerCase().trim();
}

// ─── CSV parser (field-level, handles quotes) ───────────────────────────────
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

// ─── Phase detection from FEN ───────────────────────────────────────────────
function detectPhase(fen, themes) {
  // Prefer explicit theme
  if (themes.includes("opening")) return "Opening";
  if (themes.includes("middlegame")) return "Middlegame";
  if (themes.includes("endgame")) return "Endgame";
  // Infer from material
  const placement = fen.split(" ")[0];
  const pieces = placement.replace(/[^a-zA-Z]/g, "");
  const nonPawn = pieces.replace(/[pP]/g, "").length;
  const fullmove = parseInt(fen.split(" ")[5] || "1");
  if (nonPawn <= 6) return "Endgame";
  if (fullmove <= 10) return "Opening";
  return "Middlegame";
}

// ─── Goal + mate detection ──────────────────────────────────────────────────
function detectGoal(themes) {
  const mateThemes = ["mate", "mateIn1", "mateIn2", "mateIn3", "mateIn4", "mateIn5"];
  if (themes.some(t => mateThemes.includes(t))) return "Mate";
  return "Best move";
}

function detectMateIn(themes) {
  if (themes.includes("mateIn1")) return 1;
  if (themes.includes("mateIn2")) return 2;
  if (themes.includes("mateIn3")) return 3;
  if (themes.includes("mateIn4")) return 4;
  if (themes.includes("mateIn5")) return 5;
  return null;
}

// ─── Main theme picker (one tactical theme for display) ─────────────────────
const PRIMARY_THEMES = [
  "mateIn1", "mateIn2", "mateIn3", "mateIn4", "mateIn5",
  "smotheredMate", "backRankMate", "anastasiaMate", "arabianMate",
  "fork", "pin", "skewer", "discoveredAttack", "doubleCheck",
  "sacrifice", "deflection", "attraction", "trappedPiece",
  "advancedPawn", "hangingPiece", "exposedKing", "zugzwang",
];

function pickPrimaryTheme(themes) {
  for (const pt of PRIMARY_THEMES) {
    if (themes.includes(pt)) return translateTheme(pt);
  }
  const firstReal = themes.find(t => t && !["short", "long", "veryLong", "oneMove", "crushing", "advantage", "equality"].includes(t));
  return firstReal ? translateTheme(firstReal) : "Тактика";
}

// ─── Name generator ─────────────────────────────────────────────────────────
function generateName(themes, rating) {
  const primary = pickPrimaryTheme(themes);
  const tier = rating < 800 ? "Лёгкая" : rating < 1400 ? "Средняя" : rating < 1900 ? "Сложная" : "Мастерская";
  return `${primary} · ${tier}`;
}

// ─── Fast pre-filter: just check metadata without touching chess.js ──────
function prefilter(row) {
  const [id, fen, movesStr, ratingStr, devStr, popStr, playsStr, themesStr] = row;
  if (!fen || !movesStr) return null;
  const rating = parseInt(ratingStr);
  const deviation = parseInt(devStr);
  const popularity = parseInt(popStr);
  const plays = parseInt(playsStr);
  if (isNaN(rating) || rating < MIN_RATING || rating > MAX_RATING) return null;
  if (isNaN(deviation) || deviation > MAX_DEVIATION) return null;
  if (isNaN(popularity) || popularity < MIN_POPULARITY) return null;
  if (isNaN(plays) || plays < MIN_PLAYS) return null;
  const themes = (themesStr || "").split(" ").filter(Boolean);
  if (THEMES_FILTER && !themes.some(t => THEMES_FILTER.includes(t))) return null;
  const moves = movesStr.trim().split(" ");
  if (moves.length < 2) return null;
  return { id, fen, moves, rating, deviation, popularity, plays, themes };
}

// ─── Full conversion: applies setup move, computes all fields (slow) ─────
function fullConvert(pre) {
  const { fen, moves, rating, popularity, plays, themes } = pre;
  const setupMove = moves[0];
  const solution = moves.slice(1);

  let startFen;
  try {
    const chess = new Chess(fen);
    const m = chess.move({
      from: setupMove.slice(0, 2),
      to: setupMove.slice(2, 4),
      promotion: setupMove.length > 4 ? setupMove[4] : undefined,
    });
    if (!m) return null;
    startFen = chess.fen();
  } catch {
    return null;
  }

  const activeColor = startFen.split(" ")[1];
  const goal = detectGoal(themes);
  const mateIn = goal === "Mate" ? detectMateIn(themes) : null;
  const phase = detectPhase(startFen, themes);
  const name = generateName(themes, rating);
  const primaryTheme = pickPrimaryTheme(themes);

  const puzzle = {
    fen: startFen,
    sol: solution,
    name,
    r: rating,
    theme: primaryTheme,
    phase,
    side: activeColor,
    goal,
  };
  if (mateIn) puzzle.mateIn = mateIn;

  return { puzzle, themes, rating, plays, popularity };
}

// ─── Legacy single-call convertPuzzle kept for compat ────────────────────
function convertPuzzle(row) {
  const pre = prefilter(row);
  if (!pre) return null;
  return fullConvert(pre);
}

// ─── Verify every converted puzzle is actually solvable ─────────────────────
function verifyPuzzle(p) {
  try {
    const c = new Chess(p.fen);
    for (const uci of p.sol) {
      const m = c.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined,
      });
      if (!m) return false;
    }
    // Mate puzzles must end in checkmate
    if (p.goal === "Mate" && !c.isCheckmate()) return false;
    return true;
  } catch {
    return false;
  }
}

// ─── Main pipeline ──────────────────────────────────────────────────────────
console.log("\n🎯 AEVION CyberChess — Lichess Puzzle Importer\n");
console.log(`Input:          ${INPUT_PATH}`);
console.log(`Output:         ${OUTPUT_PATH}`);
console.log(`Target count:   ${COUNT}`);
console.log(`Rating range:   ${MIN_RATING}–${MAX_RATING}`);
console.log(`Min popularity: ${MIN_POPULARITY}`);
console.log(`Min plays:      ${MIN_PLAYS}`);
console.log(`Max deviation:  ${MAX_DEVIATION}`);
if (THEMES_FILTER) console.log(`Themes:         ${THEMES_FILTER.join(", ")}`);
console.log(`Mate ratio:     ${(MATE_RATIO * 100).toFixed(0)}%`);
console.log(`Endgame ratio:  ${(ENDGAME_RATIO * 100).toFixed(0)}%`);
if (DRY_RUN) console.log("Mode:           DRY RUN (no file written)");
console.log();

const inputStats = statSync(INPUT_PATH);
console.log(`Scanning ${(inputStats.size / 1024 / 1024).toFixed(1)} MB...\n`);

const stream = createReadStream(INPUT_PATH, { encoding: "utf8" });
const rl = createInterface({ input: stream, crlfDelay: Infinity });

// Cap each pool at 10x the target to avoid OOM on full 5.8M-row Lichess database.
// We still get plenty of diversity since sorting by popularity picks the top anyway.
const POOL_CAP = Math.max(COUNT * 10, 5000);
const pool = { mate: [], endgame: [], tactical: [] };
let totalRows = 0;
let accepted = 0;
let rejected = 0;
let verifyFailed = 0;
let isFirstLine = true;

// When a pool hits its cap, we keep only the top-N by popularity.
// This is a streaming top-K selection that keeps memory bounded.
function insertIntoPool(poolArr, item) {
  if (poolArr.length < POOL_CAP) {
    poolArr.push(item);
    return;
  }
  // Pool full — evict lowest popularity if new item is better
  let minIdx = 0;
  for (let i = 1; i < poolArr.length; i++) {
    if (poolArr[i].popularity < poolArr[minIdx].popularity) minIdx = i;
  }
  if (item.popularity > poolArr[minIdx].popularity) {
    poolArr[minIdx] = item;
  }
}

for await (const line of rl) {
  if (isFirstLine) { isFirstLine = false; continue; } // skip header
  totalRows++;
  if (VERBOSE && totalRows % 100000 === 0) {
    process.stderr.write(`  scanned ${totalRows.toLocaleString()}, accepted ${accepted}, pools: mate=${pool.mate.length} endgame=${pool.endgame.length} tactical=${pool.tactical.length}\n`);
  }

  const row = parseCsvLine(line);
  if (row.length < 8) { rejected++; continue; }

  const converted = convertPuzzle(row);
  if (!converted) { rejected++; continue; }

  // NOTE: verification deferred to after sampling (too expensive for 5.8M rows)

  accepted++;
  if (converted.puzzle.goal === "Mate") insertIntoPool(pool.mate, converted);
  else if (converted.puzzle.phase === "Endgame") insertIntoPool(pool.endgame, converted);
  else insertIntoPool(pool.tactical, converted);
}

console.log(`\n✓ Scan complete: ${totalRows.toLocaleString()} rows\n`);
console.log(`  Accepted:       ${accepted.toLocaleString()}`);
console.log(`  Rejected:       ${rejected.toLocaleString()} (filters)`);
console.log(`  Verify failed:  ${verifyFailed.toLocaleString()} (broken moves)\n`);
console.log(`  Pool — mate:    ${pool.mate.length.toLocaleString()}`);
console.log(`  Pool — endgame: ${pool.endgame.length.toLocaleString()}`);
console.log(`  Pool — tactical:${pool.tactical.length.toLocaleString()}\n`);

// ─── Balanced sampling ──────────────────────────────────────────────────────
// Sort each pool by popularity descending for deterministic high-quality picks
for (const p of Object.values(pool)) {
  p.sort((a, b) => b.popularity - a.popularity);
}

const mateTarget = Math.round(COUNT * MATE_RATIO);
const endgameTarget = Math.round(COUNT * ENDGAME_RATIO);
const tacticalTarget = COUNT - mateTarget - endgameTarget;

function evenSample(arr, n) {
  if (arr.length <= n) return arr;
  // Stratify by rating brackets to avoid rating clumping
  const brackets = [[0, 800], [800, 1200], [1200, 1500], [1500, 1800], [1800, 2200], [2200, 3500]];
  const bucketed = brackets.map(([lo, hi]) => arr.filter(p => p.rating >= lo && p.rating < hi));
  const perBucket = Math.ceil(n / brackets.length);
  const picked = [];
  for (const b of bucketed) picked.push(...b.slice(0, perBucket));
  return picked.slice(0, n);
}

const sampled = [
  ...evenSample(pool.mate, mateTarget),
  ...evenSample(pool.endgame, endgameTarget),
  ...evenSample(pool.tactical, tacticalTarget),
];

// Final shuffle by rating for a clean UX (easy→hard not obvious, but grouped-ish)
sampled.sort((a, b) => a.rating - b.rating);

console.log(`📦 Sampled ${sampled.length} puzzles:`);
console.log(`   Mate:     ${sampled.filter(x => x.puzzle.goal === "Mate").length}`);
console.log(`   Endgame:  ${sampled.filter(x => x.puzzle.phase === "Endgame" && x.puzzle.goal !== "Mate").length}`);
console.log(`   Tactical: ${sampled.filter(x => x.puzzle.phase !== "Endgame" && x.puzzle.goal !== "Mate").length}\n`);

// Verify each sampled puzzle is solvable (chess.js move-by-move replay)
console.log(`🔍 Verifying ${sampled.length} puzzles through chess.js...`);
const verified = [];
let vFail = 0;
for (const s of sampled) {
  if (verifyPuzzle(s.puzzle)) verified.push(s);
  else vFail++;
}
console.log(`   ✓ Verified: ${verified.length}`);
console.log(`   ✗ Broken:   ${vFail} (discarded)\n`);

// Rating distribution
const ratingBuckets = { "0-800": 0, "800-1200": 0, "1200-1500": 0, "1500-1800": 0, "1800-2200": 0, "2200+": 0 };
for (const s of verified) {
  const r = s.rating;
  if (r < 800) ratingBuckets["0-800"]++;
  else if (r < 1200) ratingBuckets["800-1200"]++;
  else if (r < 1500) ratingBuckets["1200-1500"]++;
  else if (r < 1800) ratingBuckets["1500-1800"]++;
  else if (r < 2200) ratingBuckets["1800-2200"]++;
  else ratingBuckets["2200+"]++;
}
console.log("  Rating distribution:");
for (const [k, v] of Object.entries(ratingBuckets)) {
  const pct = (v / verified.length * 100).toFixed(0);
  const bar = "█".repeat(Math.round(v / verified.length * 40));
  console.log(`   ${k.padEnd(10)} ${String(v).padStart(5)} ${bar} ${pct}%`);
}
console.log();

if (DRY_RUN) {
  console.log("💡 Dry run complete. Remove --dry-run to write output.\n");
  process.exit(0);
}

// ─── Write output ───────────────────────────────────────────────────────────
const outputAbs = resolve(OUTPUT_PATH);
if (BACKUP && existsSync(outputAbs)) {
  const backupPath = outputAbs + ".backup-" + Date.now();
  copyFileSync(outputAbs, backupPath);
  console.log(`💾 Backup: ${backupPath}`);
}

const finalArr = verified.map(s => s.puzzle);
writeFileSync(outputAbs, JSON.stringify(finalArr));
const outSize = statSync(outputAbs).size;
console.log(`✅ Wrote ${finalArr.length} puzzles to ${outputAbs}`);
console.log(`   Size: ${(outSize / 1024).toFixed(1)} KB (${(outSize / 1024 / 1024).toFixed(2)} MB)\n`);
console.log("💡 Validate with:  node validate-puzzles.mjs public\\puzzles.json\n");
