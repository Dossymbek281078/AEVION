#!/usr/bin/env node
/**
 * import-lichess-puzzles-dump.mjs — grow the CyberChess puzzle pool toward
 * lichess-scale from the open Lichess puzzle database (CC0).
 *
 * The dump is a CSV downloadable from https://database.lichess.org/#puzzles
 * (lichess_db_puzzle.csv.zst → decompress to .csv). Columns:
 *   PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
 *
 * Lichess convention: FEN is the position BEFORE the opponent's setup move;
 * the FIRST move in `Moves` is that opponent move, and the puzzle starts AFTER
 * it. We apply the first move to get the puzzle's start FEN and keep the
 * remaining moves (UCI) as the solution — matching CyberChess's schema
 * {fen, sol[], name, r, theme, phase, side, goal}.
 *
 * Usage:
 *   node scripts/import-lichess-puzzles-dump.mjs <path-to-lichess_db_puzzle.csv> [--max N] [--min-rating R] [--max-rating R] [--merge]
 *
 * By default writes data/cyberchess-puzzles.json (overwrite). With --merge it
 * appends to the existing pool (de-duped by FEN). Requires chess.js
 * (already a dependency of the frontend; install in backend if missing).
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const args = process.argv.slice(2);
const csvPath = args.find((a) => !a.startsWith("--"));
const getFlag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const MAX = parseInt(getFlag("--max", "1000000"), 10);
const MIN_RATING = parseInt(getFlag("--min-rating", "0"), 10);
const MAX_RATING = parseInt(getFlag("--max-rating", "4000"), 10);
const MERGE = args.includes("--merge");

if (!csvPath) {
  console.error("Usage: node import-lichess-puzzles-dump.mjs <lichess_db_puzzle.csv> [--max N] [--min-rating R] [--max-rating R] [--merge]");
  process.exit(1);
}

let Chess;
try {
  ({ Chess } = await import("chess.js"));
} catch {
  console.error("chess.js is required. In aevion-globus-backend run:  npm i chess.js");
  process.exit(1);
}

const OUT = path.resolve(process.cwd(), "data", "cyberchess-puzzles.json");
fs.mkdirSync(path.dirname(OUT), { recursive: true });

// Map a couple of common Lichess themes to the RU labels CyberChess uses; any
// unmapped theme is passed through so filtering still works.
const THEME_RU = {
  mateIn1: "Мат в 1", mateIn2: "Мат в 2", mateIn3: "Мат в 3",
  fork: "Вилка", pin: "Связка", skewer: "Рентген", discoveredAttack: "Вскрытое нападение",
  deflection: "Отвлечение", sacrifice: "Жертва", hangingPiece: "Висящая фигура",
  advancedPawn: "Продвинутая пешка", endgame: "Эндшпиль", middlegame: "Миттельшпиль",
  opening: "Дебют", kingsideAttack: "Атака на короля", master: "master",
};
const phaseOf = (themes) =>
  themes.includes("endgame") ? "Endgame" : themes.includes("opening") ? "Opening" : "Middlegame";

const existing = MERGE && fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf-8")) : [];
const seenFen = new Set(existing.map((p) => p.fen));
const out = existing.slice();

const rl = readline.createInterface({ input: fs.createReadStream(csvPath), crlfDelay: Infinity });
let lineNo = 0, added = 0, skipped = 0;

for await (const line of rl) {
  lineNo++;
  if (lineNo === 1 && line.startsWith("PuzzleId")) continue; // header
  if (!line.trim()) continue;
  if (added >= MAX) break;
  const cols = line.split(",");
  if (cols.length < 8) { skipped++; continue; }
  const [, fen, moves, ratingStr, , , , themesStr] = cols;
  const rating = parseInt(ratingStr, 10) || 0;
  if (rating < MIN_RATING || rating > MAX_RATING) { skipped++; continue; }
  const uci = moves.trim().split(/\s+/);
  if (uci.length < 2) { skipped++; continue; }
  try {
    const ch = new Chess(fen);
    // apply the opponent's setup move → puzzle start position
    const first = uci[0];
    const mv = ch.move({ from: first.slice(0, 2), to: first.slice(2, 4), promotion: first[4] || undefined });
    if (!mv) { skipped++; continue; }
    const startFen = ch.fen();
    if (seenFen.has(startFen)) { skipped++; continue; }
    const sol = uci.slice(1);
    const themes = themesStr.trim().split(/\s+/);
    const primary = themes.find((t) => THEME_RU[t]) || themes[0] || "tactics";
    const isMate = themes.some((t) => t.startsWith("mateIn"));
    out.push({
      fen: startFen,
      sol,
      name: `Lichess ${rating}`,
      r: rating,
      theme: THEME_RU[primary] || primary,
      phase: phaseOf(themes),
      side: ch.turn(),
      goal: isMate ? "Mate" : "Best move",
      ...(isMate ? { mateIn: Math.ceil(sol.length / 2) } : {}),
    });
    seenFen.add(startFen);
    added++;
    if (added % 50000 === 0) console.log(`  …${added} imported`);
  } catch {
    skipped++;
  }
}

fs.writeFileSync(OUT, JSON.stringify(out), "utf-8");
console.log(`Done. Imported ${added}, skipped ${skipped}. Pool now ${out.length} puzzles → ${OUT}`);
