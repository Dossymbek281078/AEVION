#!/usr/bin/env node
/**
 * Generate tactical puzzles programmatically using chess.js.
 * Algorithm:
 *  1. Play random games from various starting positions (2-30 plies deep)
 *  2. At each position, scan for "hanging piece" — if one side has an undefended
 *     piece attackable for free, record as "Best move → win material"
 *  3. Scan for mate-in-1 positions (chess.js isCheckmate after each move attempt)
 *  4. Verify positions are unique (by FEN) and add to puzzles.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Chess } from "./frontend/node_modules/chess.js/dist/esm/chess.js";

const OUT = "./frontend/public/puzzles.json";
const existing = JSON.parse(readFileSync(OUT, "utf8"));
const existingFens = new Set(existing.map(p => p.fen));
console.log(`Existing puzzles: ${existing.length}`);

// Piece values
const VAL = { p:1, n:3, b:3, r:5, q:9, k:0 };

// Count attackers of a square using chess.js
function countAttackers(chess, sq, color) {
  try { return chess.attackers(sq, color).length; } catch { return 0; }
}

// Evaluate material balance from white's perspective
function material(chess) {
  let score = 0;
  const fen = chess.fen().split(" ")[0];
  for (const c of fen) {
    if (c === "/" || /\d/.test(c)) continue;
    const v = VAL[c.toLowerCase()] || 0;
    score += c === c.toUpperCase() ? v : -v;
  }
  return score;
}

// Random move (biased toward captures and checks)
function randomMove(chess) {
  const moves = chess.moves({ verbose: true });
  if (!moves.length) return null;
  // Prefer captures and checks
  const captures = moves.filter(m => m.captured || m.san.includes("+"));
  const pool = captures.length > 0 && Math.random() < 0.3 ? captures : moves;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Play a random game from start position, return array of intermediate positions
function playGame(startFen, maxPlies = 40) {
  const chess = new Chess(startFen);
  const positions = [];
  for (let i = 0; i < maxPlies; i++) {
    if (chess.isGameOver()) break;
    const m = randomMove(chess);
    if (!m) break;
    chess.move(m);
    if (i >= 6) positions.push(chess.fen()); // skip opening book positions
  }
  return positions;
}

// Check if there's a mate-in-1 in a position (returns the move or null)
function findMateIn1(fen) {
  try {
    const chess = new Chess(fen);
    if (chess.isGameOver()) return null;
    const moves = chess.moves({ verbose: true });
    for (const m of moves) {
      chess.move(m);
      if (chess.isCheckmate()) {
        chess.undo();
        return m;
      }
      chess.undo();
    }
    return null;
  } catch { return null; }
}

// Find mate-in-2 (returns the first move or null)
function findMateIn2(fen) {
  try {
    const chess1 = new Chess(fen);
    if (chess1.isGameOver()) return null;
    const moves1 = chess1.moves({ verbose: true });
    for (const m1 of moves1) {
      chess1.move(m1);
      // After first move, check all opponent replies
      if (chess1.isGameOver()) { chess1.undo(); continue; }
      const replies = chess1.moves({ verbose: true });
      let allMated = replies.length > 0;
      if (replies.length === 0) { chess1.undo(); continue; }
      for (const m2 of replies) {
        chess1.move(m2);
        const canMate = findMateIn1(chess1.fen());
        chess1.undo();
        if (!canMate) { allMated = false; break; }
      }
      chess1.undo();
      if (allMated) return m1;
    }
    return null;
  } catch { return null; }
}

// Find a "best move" — captures a hanging piece (undefended)
function findHangingCapture(fen) {
  try {
    const chess = new Chess(fen);
    if (chess.isGameOver()) return null;
    const sideToMove = chess.turn();
    const oppColor = sideToMove === "w" ? "b" : "w";
    const captures = chess.moves({ verbose: true }).filter(m => m.captured);
    for (const cap of captures) {
      // Check if the capturing square is safe (not recapturable by opponent for free)
      chess.move(cap);
      const afterFen = chess.fen();
      const defender = chess.attackers(cap.to, oppColor);
      chess.undo();
      if (defender.length === 0) {
        // Target is undefended — this is a free capture
        const capturedVal = VAL[cap.captured?.toLowerCase() || "p"] || 0;
        const capturerVal = VAL[cap.piece?.toLowerCase() || "p"] || 0;
        if (capturedVal >= capturerVal) return cap; // at worst a trade, often +material
      }
    }
    return null;
  } catch { return null; }
}

// Curated starting positions for diverse puzzle generation
const STARTS = [
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", // standard
  "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", // Italian
  "rnbqkb1r/pp1ppppp/5n2/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", // Sicilian
  "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", // Scandinavian
  "rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4", // QGD
  "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", // Ruy Lopez setup
  "8/5kpp/8/1p1pP3/p2P4/P6P/1B4P1/6K1 w - - 0 1", // pawn endgame
  "r3k2r/ppp2ppp/2np1n2/2b1p1B1/2B1P1b1/2NP1N2/PPP2PPP/R3K2R w KQkq - 0 1", // middle game
  "6k1/pp3pp1/3bp2p/2r5/4B3/1P6/P4PPP/R5K1 w - - 0 1", // rook endgame
  "8/pp1k4/8/2pP4/2P5/8/PP6/3K4 w - - 0 1", // KPK
  "r2qr1k1/ppp2ppp/2n1bn2/4p3/2B1P3/2N2N2/PPP2PPP/R1BQR1K1 w - - 4 8", // open game
  "3r1rk1/pp1qppbp/2np2p1/8/2PPb3/2N1BP2/PP2N1PP/2RQ1RK1 w - - 0 1", // complex middle
];

let added = 0;
const TARGET = 800;
const puzzles = [...existing];

console.log(`Generating up to ${TARGET} new puzzles...`);
let attempts = 0;
const maxAttempts = 15000;

while (added < TARGET && attempts < maxAttempts) {
  attempts++;
  const startFen = STARTS[Math.floor(Math.random() * STARTS.length)];
  const randomPlies = 5 + Math.floor(Math.random() * 25);
  const positions = playGame(startFen, randomPlies);

  for (const fen of positions) {
    if (added >= TARGET) break;
    if (existingFens.has(fen)) continue;

    // Try mate-in-1
    const m1 = findMateIn1(fen);
    if (m1) {
      const chess = new Chess(fen);
      const side = chess.turn();
      const rating = 500 + Math.floor(Math.random() * 500); // 500-1000
      puzzles.push({
        fen,
        sol: [`${m1.from}${m1.to}${m1.promotion||""}`],
        name: `Мат в 1 · ${rating < 700 ? "Новичок" : "Лёгкая"}`,
        r: rating,
        theme: "Мат в 1",
        phase: fen.split(" ")[5] && parseInt(fen.split(" ")[5]) > 25 ? "Endgame" : "Middlegame",
        side,
        goal: "Mate",
        mateIn: 1,
        id: `gen_m1_${Date.now()}_${added}`,
      });
      existingFens.add(fen);
      added++;
      process.stdout.write("♔");
      continue;
    }

    // Try hanging capture
    const hc = findHangingCapture(fen);
    if (hc) {
      const chess = new Chess(fen);
      const side = chess.turn();
      const capturedVal = VAL[hc.captured?.toLowerCase() || "p"] || 0;
      const theme = capturedVal >= 9 ? "Висящий ферзь" : capturedVal >= 5 ? "Висящая ладья" : capturedVal >= 3 ? "Висящая фигура" : "Висящая фигура";
      const rating = 400 + capturedVal * 50 + Math.floor(Math.random() * 200);
      puzzles.push({
        fen,
        sol: [`${hc.from}${hc.to}${hc.promotion||""}`],
        name: `${theme} · ${rating < 700 ? "Лёгкая" : "Средняя"}`,
        r: rating,
        theme,
        phase: "Middlegame",
        side,
        goal: "Best move",
        id: `gen_hc_${Date.now()}_${added}`,
      });
      existingFens.add(fen);
      added++;
      process.stdout.write("♟");
      continue;
    }

    // Try mate-in-2 (slower, limit attempts)
    if (Math.random() < 0.05) { // only 5% of positions to limit compute
      const m2 = findMateIn2(fen);
      if (m2) {
        const chess = new Chess(fen);
        const side = chess.turn();
        const rating = 900 + Math.floor(Math.random() * 600); // 900-1500
        puzzles.push({
          fen,
          sol: [`${m2.from}${m2.to}${m2.promotion||""}`],
          name: `Мат в 2 · ${rating < 1200 ? "Средняя" : "Сложная"}`,
          r: rating,
          theme: "Мат в 2",
          phase: "Middlegame",
          side,
          goal: "Mate",
          mateIn: 2,
          id: `gen_m2_${Date.now()}_${added}`,
        });
        existingFens.add(fen);
        added++;
        process.stdout.write("♕");
      }
    }
  }

  if (added % 100 === 0 && added > 0) {
    process.stdout.write(`\n+${added} (${attempts} attempts)`);
  }
}

console.log(`\n\nGenerated: ${added}, Total: ${puzzles.length}`);
writeFileSync(OUT, JSON.stringify(puzzles), "utf8");
console.log("✓ Written to puzzles.json");
