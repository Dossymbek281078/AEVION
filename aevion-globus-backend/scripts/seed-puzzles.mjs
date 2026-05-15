#!/usr/bin/env node
/**
 * Seed ChessPuzzle table from Lichess CC0 puzzle CSV.
 *
 * USAGE:
 *   1. Download: https://database.lichess.org/lichess_db_puzzle.csv.zst (~300MB)
 *   2. Decompress: zstd -d lichess_db_puzzle.csv.zst   (or 7zip on Windows)
 *   3. Run:
 *      PUZZLE_SEED_KEY=mysecret BACKEND_URL=https://api.aevion.app \
 *        node scripts/seed-puzzles.mjs --in ./lichess_db_puzzle.csv --limit 100000
 *
 * Alternatively seed the local DB directly via Prisma by setting DATABASE_URL
 * and removing the fetch call.
 *
 * CSV columns (Lichess format):
 *   PuzzleId, FEN, Moves, Rating, RatingDeviation, Popularity, NbPlays,
 *   Themes, GameUrl, OpeningTags
 */

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1] || "true"]);
    return acc;
  }, [])
);

const IN = args.in || "./lichess_db_puzzle.csv";
const LIMIT = parseInt(args.limit || "50000");
const BATCH = parseInt(args.batch || "500");
const KEY = process.env.PUZZLE_SEED_KEY || args.key;
const BACKEND = (process.env.BACKEND_URL || args.backend || "http://localhost:4001").replace(/\/$/, "");
const MIN_R = parseInt(args.minR || "400");
const MAX_R = parseInt(args.maxR || "2800");

const THEME_MAP = {
  fork:"Вилка", pin:"Связка", skewer:"Рентген", discoveredAttack:"Вскрытое нападение",
  doubleCheck:"Двойной шах", deflection:"Отвлечение", decoy:"Завлечение",
  interference:"Перекрытие", zugzwang:"Цугцванг", sacrifice:"Жертва",
  backRankMate:"Мат на последней горизонтали", smotheredMate:"Мат Филидора",
  promotion:"Превращение пешки", trappedPiece:"Поймана фигура",
  exposedKing:"Открытый король", advancedPawn:"Продвинутая пешка",
  kingsideAttack:"Атака на королевском", queensideAttack:"Атака на ферзевом",
  xRayAttack:"Рентген", clearance:"Расчистка", mateIn1:"Мат в 1",
  mateIn2:"Мат в 2", mateIn3:"Мат в 3", mateIn4:"Мат в 4", mateIn5:"Мат в 5+",
  endgame:"Эндшпиль", opening:"Дебютная ловушка", middlegame:"Миттельшпиль",
  hangingPiece:"Висящая фигура", rookEndgame:"Ладейный эндшпиль",
  queenEndgame:"Ферзевый эндшпиль", pawnEndgame:"Пешечный эндшпиль",
  bishopEndgame:"Слоновый эндшпиль", knightEndgame:"Конный эндшпиль",
  attraction:"Завлечение", equality:"Спасение",
};

function getPhase(themes) {
  if (themes.some(t => ["endgame","rookEndgame","queenEndgame","pawnEndgame","bishopEndgame","knightEndgame"].includes(t))) return "Endgame";
  if (themes.includes("opening")) return "Opening";
  return "Middlegame";
}
function getMateIn(themes) {
  for (const [t,n] of [["mateIn1",1],["mateIn2",2],["mateIn3",3],["mateIn4",4],["mateIn5",5]])
    if (themes.includes(t)) return n;
  return null;
}

async function sendBatch(batch) {
  const res = await fetch(`${BACKEND}/api/puzzles/seed`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Puzzle-Seed-Key": KEY || "" },
    body: JSON.stringify({ puzzles: batch }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return await res.json();
}

let parsed = 0, skipped = 0, sent = 0;
let batch = [];
let header = null;

console.log(`Seeding from: ${IN}`);
console.log(`Limit: ${LIMIT} | Rating: ${MIN_R}-${MAX_R} | Backend: ${BACKEND}`);

const rl = createInterface({ input: createReadStream(IN), crlfDelay: Infinity });
for await (const line of rl) {
  if (!header) { header = line.split(","); continue; }
  if (sent >= LIMIT) break;

  const cols = line.split(",");
  if (cols.length < 4) { skipped++; continue; }

  const id = cols[0];
  const fen = cols[1];
  const moves = cols[2].split(" ").filter(Boolean);
  const rating = parseInt(cols[3]);
  const themes = (cols[7] || "").split(" ").filter(Boolean);

  if (rating < MIN_R || rating > MAX_R || !fen || !moves.length) { skipped++; continue; }

  parsed++;
  const mateIn = getMateIn(themes);
  const isMate = themes.some(t => t.startsWith("mate")) || mateIn != null;
  const themeKey = themes.find(t => THEME_MAP[t] && !["short","long","oneMove","master"].includes(t));
  const theme = THEME_MAP[themeKey] || "Тактика";
  const phase = getPhase(themes);
  const side = fen.split(" ")[1] || "w";

  let name = mateIn ? `Мат в ${mateIn}` : theme;
  if (rating < 800) name += " · Новичок";
  else if (rating < 1200) name += " · Лёгкая";
  else if (rating < 1600) name += " · Средняя";
  else if (rating < 2000) name += " · Сложная";
  else name += " · Мастер";

  batch.push({ id: `li_${id}`, fen, sol: moves, name, r: rating, theme, phase, side, goal: isMate ? "Mate" : "Best move", ...(mateIn ? { mateIn } : {}) });

  if (batch.length >= BATCH) {
    try {
      const result = await sendBatch(batch);
      sent += result.upserted || batch.length;
      process.stdout.write(`\r✓ ${sent} seeded (${parsed} parsed, ${skipped} skipped)`);
    } catch (e) {
      process.stdout.write(`\n! Batch error: ${e.message}\n`);
    }
    batch = [];
  }
}

if (batch.length > 0) {
  try {
    const result = await sendBatch(batch);
    sent += result.upserted || batch.length;
  } catch (e) {
    console.error("\nFinal batch error:", e.message);
  }
}

console.log(`\n\nDone! Seeded: ${sent} | Parsed: ${parsed} | Skipped: ${skipped}`);
