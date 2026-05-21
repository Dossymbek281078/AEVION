#!/usr/bin/env node
/**
 * AEVION CyberChess — real Stockfish-based feature extraction for FIDE calibration.
 *
 * Replaces the proxy-CPI heuristics in cyberchess-fide-calibrate.mjs (which
 * set accuracy=95/85/72 by result and blunderRate=0/0.05/0.10) with engine-
 * measured per-move centipawn loss.
 *
 * Pipeline:
 *   1. Parse PGN (same regex as calibrate.mjs).
 *   2. For each (game × side), replay moves through chess.js, ask Stockfish
 *      for the position eval before each move from the moving side's POV.
 *   3. Centipawn loss for a move = eval_before(player_pov) - eval_after(player_pov).
 *      eval_after_pov_flip = -eval_after(opponent_pov) since stockfish reports
 *      cp score from side-to-move POV.
 *   4. Aggregate per side:
 *      - accuracyPct  = mean(100 * exp(-cpLoss/100)), clamped [0..100]
 *      - blunderRate  = fraction of moves with cpLoss >= 200
 *      - openingTheoryDepth (same proxy as calibrate.mjs — needs an opening DB
 *        to do properly, out of scope here)
 *      - tacticalEfficiency, endgameStrength, avgMoveTime (proxy from PGN)
 *   5. Emit CSV: gameId,playerSide,targetElo,result,accuracyPct,openingDepth,
 *      tacticalEff,endgameStrength,blunderRate,avgMoveTime
 *
 * The calibrate script can then ingest this CSV via `--features-csv` instead of
 * deriving features from headers alone.
 *
 * Engine: bundled Stockfish 18 Lite WASM from frontend/node_modules/stockfish.
 *         No native binary needed. ~7 MB, single-threaded, lite NNUE.
 *
 * Usage:
 *   node scripts/cyberchess-stockfish-eval.mjs \
 *     --pgn scripts/fixtures/fide-smoke-corpus.pgn \
 *     --output scripts/fixtures/fide-smoke-features.csv \
 *     --depth 12 \
 *     --limit 100
 *
 * Args:
 *   --pgn      Required. Path to PGN dump.
 *   --output   Required. Output CSV path.
 *   --depth    Engine search depth per position. Default 12 (~50-200ms each).
 *   --limit    Cap games processed. Default unlimited.
 *
 * Performance: with depth=12 lite-single, ~30 plies/sec on a modern laptop.
 *   12 games × ~40 plies × 2 sides = ~960 evals ≈ 30 seconds.
 *   For a 5k-game corpus plan ~3-4 hours; consider depth=10 or sampling.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/* ─── CLI args ──────────────────────────────────────────────────────── */

function parseArgs(argv) {
  const args = { pgn: null, output: null, depth: 12, limit: Infinity };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--pgn") args.pgn = argv[++i];
    else if (a === "--output") args.output = argv[++i];
    else if (a === "--depth") args.depth = Number(argv[++i]) || 12;
    else if (a === "--limit") args.limit = Number(argv[++i]) || Infinity;
    else if (a === "--help" || a === "-h") {
      console.log("Usage: node scripts/cyberchess-stockfish-eval.mjs --pgn <path> --output <path> [--depth N] [--limit N]");
      process.exit(0);
    }
  }
  if (!args.pgn || !args.output) {
    console.error("ERROR: --pgn and --output are required. See --help.");
    process.exit(1);
  }
  return args;
}

/* ─── PGN parsing (same shape as calibrate.mjs) ─────────────────────── */

function splitGames(raw) {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const games = [];
  let current = [];
  for (const line of lines) {
    if (line.startsWith("[Event ")) {
      if (current.length > 0) games.push(current.join("\n"));
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) games.push(current.join("\n"));
  return games.filter(g => g.includes("[Event"));
}

function parseHeader(chunk, name) {
  const re = new RegExp(`\\[${name}\\s+"([^"]*)"\\]`);
  const m = chunk.match(re);
  return m ? m[1] : null;
}

function extractMoves(chunk) {
  // Strip headers, comments {...}, NAGs $n, variations (...)
  const movePart = chunk
    .split(/\n\n/)
    .slice(1)
    .join(" ")
    .replace(/\{[^}]*\}/g, "")
    .replace(/\$\d+/g, "")
    .replace(/\([^)]*\)/g, "");
  const tokens = movePart.split(/\s+/).filter(t => t && !/^\d+\.+$/.test(t) && t !== "1-0" && t !== "0-1" && t !== "1/2-1/2" && t !== "*");
  return tokens;
}

/* ─── Stockfish driver via WASM + intercepted console ───────────────── */

let logBuffer = [];
const origConsoleLog = console.log;
const origStdoutWrite = process.stdout.write.bind(process.stdout);

function startCapture() {
  console.log = (msg) => { if (typeof msg === "string") logBuffer.push(msg); };
}
function stopCapture() {
  console.log = origConsoleLog;
}

async function makeEngine() {
  // The stockfish WASM loader prints UCI output via console.log; capture it.
  startCapture();
  const initEngine = require("../frontend/node_modules/stockfish/index.js");
  const engine = await initEngine("lite-single");
  await waitFor(() => true, 100);  // settle
  return engine;
}

async function waitFor(predicate, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await new Promise(r => setTimeout(r, 10));
  }
  return false;
}

function clearBuffer() { logBuffer = []; }
function send(engine, cmd) { engine.sendCommand(cmd); }

async function waitForLine(re, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (let i = 0; i < logBuffer.length; i++) {
      if (re.test(logBuffer[i])) return logBuffer[i];
    }
    await new Promise(r => setTimeout(r, 10));
  }
  return null;
}

async function uciReady(engine) {
  clearBuffer();
  send(engine, "uci");
  await waitForLine(/^uciok$/, 5000);
  send(engine, "isready");
  await waitForLine(/^readyok$/, 5000);
}

async function evalPosition(engine, fen, depth) {
  // Returns cp score from side-to-move's POV (positive = side-to-move better),
  // or null on engine error / mate (mate-converted to ±10000 to keep numeric).
  clearBuffer();
  send(engine, "ucinewgame");
  send(engine, `position fen ${fen}`);
  send(engine, `go depth ${depth}`);
  const last = await waitForLine(/^bestmove /, 30000);
  if (!last) return null;
  // Walk the buffer backwards to find the last info line with a score
  let scoreCp = null;
  for (let i = logBuffer.length - 1; i >= 0; i--) {
    const line = logBuffer[i];
    if (!line.startsWith("info")) continue;
    const mCp = line.match(/score cp (-?\d+)/);
    const mMate = line.match(/score mate (-?\d+)/);
    if (mCp) { scoreCp = parseInt(mCp[1], 10); break; }
    if (mMate) {
      const ply = parseInt(mMate[1], 10);
      scoreCp = ply > 0 ? 10000 - ply : -10000 - ply;
      break;
    }
  }
  return scoreCp;
}

/* ─── Per-game feature derivation ───────────────────────────────────── */

async function deriveFeaturesForGame(engine, depth, headers, moveTokens, chessjs) {
  // chessjs is the Chess class from chess.js
  const { Chess } = chessjs;
  const game = new Chess();

  const whiteCpLosses = [];
  const blackCpLosses = [];
  let plyCount = 0;
  let captureOrCheckCount = 0;

  // For opening-theory-depth proxy: count consecutive non-capture, non-check plies
  let openingDepthWhite = 0;
  let openingDepthBlack = 0;
  let stillOpeningWhite = true;
  let stillOpeningBlack = true;

  for (let mIdx = 0; mIdx < moveTokens.length; mIdx++) {
    const san = moveTokens[mIdx];
    const fenBefore = game.fen();
    const sideToMove = game.turn(); // 'w' or 'b'

    // Eval BEFORE move (from side-to-move POV — positive = mover is better)
    const evalBefore = await evalPosition(engine, fenBefore, depth);

    // Apply the actual move
    let moveObj;
    try { moveObj = game.move(san); }
    catch { moveObj = null; }
    if (!moveObj) break;  // malformed PGN — stop this game

    plyCount++;
    const isCapture = !!moveObj.captured;
    const isCheck = game.isCheck();
    if (isCapture || isCheck) captureOrCheckCount++;

    // Eval AFTER move (from new side-to-move POV) — convert to mover's POV by negation
    const fenAfter = game.fen();
    const evalAfterNewMover = await evalPosition(engine, fenAfter, depth);
    if (evalBefore === null || evalAfterNewMover === null) continue;
    const evalAfterMoverPov = -evalAfterNewMover;

    // Cap eval at ±1500 so a lost-position blunder doesn't dominate accuracy
    const capped = (v) => Math.max(-1500, Math.min(1500, v));
    const cpLoss = Math.max(0, capped(evalBefore) - capped(evalAfterMoverPov));

    // Opening-theory-depth proxy: still in theory while consecutive plies aren't captures/checks
    if (sideToMove === "w") {
      if (stillOpeningWhite && !isCapture && !isCheck) openingDepthWhite++;
      else stillOpeningWhite = false;
    } else {
      if (stillOpeningBlack && !isCapture && !isCheck) openingDepthBlack++;
      else stillOpeningBlack = false;
    }

    if (sideToMove === "w") whiteCpLosses.push(cpLoss);
    else blackCpLosses.push(cpLoss);
  }

  const accuracy = (losses) => {
    if (!losses.length) return 50;
    const mean = losses.reduce((s, x) => s + x, 0) / losses.length;
    return Math.max(0, Math.min(100, 100 * Math.exp(-mean / 100)));
  };
  const blunderRate = (losses) => {
    if (!losses.length) return 0;
    return losses.filter(l => l >= 200).length / losses.length;
  };

  const tacticalEff = plyCount > 0 ? Math.min(1, captureOrCheckCount / plyCount) : 0;
  const endgameStrengthWhite = plyCount > 40 ? 0.7 : 0.5;
  const endgameStrengthBlack = plyCount > 40 ? 0.7 : 0.5;
  const avgMoveTime = 30; // PGN rarely has clocks; matches calibrate.mjs default

  const result = headers.result;
  const whiteResult = result === "1-0" ? "win" : result === "0-1" ? "loss" : "draw";
  const blackResult = result === "1-0" ? "loss" : result === "0-1" ? "win" : "draw";

  return [
    {
      gameId: headers.event || "unknown",
      side: "white",
      targetElo: parseInt(headers.whiteElo, 10),
      result: whiteResult,
      accuracyPct: accuracy(whiteCpLosses),
      openingDepth: Math.min(14, openingDepthWhite),
      tacticalEff,
      endgameStrength: endgameStrengthWhite,
      blunderRate: blunderRate(whiteCpLosses),
      avgMoveTime,
      plies: whiteCpLosses.length,
      meanCpLoss: whiteCpLosses.length ? whiteCpLosses.reduce((s,x)=>s+x,0)/whiteCpLosses.length : 0,
    },
    {
      gameId: headers.event || "unknown",
      side: "black",
      targetElo: parseInt(headers.blackElo, 10),
      result: blackResult,
      accuracyPct: accuracy(blackCpLosses),
      openingDepth: Math.min(14, openingDepthBlack),
      tacticalEff,
      endgameStrength: endgameStrengthBlack,
      blunderRate: blunderRate(blackCpLosses),
      avgMoveTime,
      plies: blackCpLosses.length,
      meanCpLoss: blackCpLosses.length ? blackCpLosses.reduce((s,x)=>s+x,0)/blackCpLosses.length : 0,
    },
  ];
}

/* ─── main ──────────────────────────────────────────────────────────── */

async function main() {
  const args = parseArgs(process.argv);
  origStdoutWrite(`AEVION CyberChess — Stockfish CPI extraction\n`);
  origStdoutWrite(`  PGN:    ${args.pgn}\n`);
  origStdoutWrite(`  Output: ${args.output}\n`);
  origStdoutWrite(`  Depth:  ${args.depth}\n`);

  if (!existsSync(args.pgn)) { origStdoutWrite(`ERROR: PGN not found\n`); process.exit(1); }
  const raw = readFileSync(args.pgn, "utf8");
  const gameChunks = splitGames(raw);
  origStdoutWrite(`  Games:  ${gameChunks.length}\n\n`);

  origStdoutWrite("Loading Stockfish WASM...\n");
  const engine = await makeEngine();
  await uciReady(engine);
  // Re-print to show user we're alive — captured buffer hid it
  origStdoutWrite("  engine ready ✓\n\n");

  const chessjs = require("../frontend/node_modules/chess.js/dist/cjs/chess.js");
  const rows = [];
  let processed = 0;

  for (const chunk of gameChunks) {
    if (processed >= args.limit) break;
    const headers = {
      event: parseHeader(chunk, "Event"),
      whiteElo: parseHeader(chunk, "WhiteElo"),
      blackElo: parseHeader(chunk, "BlackElo"),
      result: parseHeader(chunk, "Result"),
    };
    if (!headers.whiteElo || !headers.blackElo || !headers.result) {
      origStdoutWrite(`  [skip] ${headers.event}: missing elo or result\n`);
      continue;
    }
    const moves = extractMoves(chunk);
    if (moves.length < 2) {
      origStdoutWrite(`  [skip] ${headers.event}: too short (${moves.length} plies)\n`);
      continue;
    }

    const t0 = Date.now();
    let gameRows;
    try {
      gameRows = await deriveFeaturesForGame(engine, args.depth, headers, moves, chessjs);
    } catch (e) {
      origStdoutWrite(`  [fail] ${headers.event}: ${e.message}\n`);
      continue;
    }
    rows.push(...gameRows);
    const t1 = Date.now();
    origStdoutWrite(
      `  ${headers.event}: white=${gameRows[0].accuracyPct.toFixed(1)}% (${gameRows[0].meanCpLoss.toFixed(0)}cp, ` +
      `blunder=${(gameRows[0].blunderRate*100).toFixed(0)}%), ` +
      `black=${gameRows[1].accuracyPct.toFixed(1)}% (${gameRows[1].meanCpLoss.toFixed(0)}cp, ` +
      `blunder=${(gameRows[1].blunderRate*100).toFixed(0)}%)  [${t1-t0}ms]\n`
    );
    processed++;
  }

  stopCapture();

  // Write CSV
  const headersCsv = ["gameId","side","targetElo","result","accuracyPct","openingDepth","tacticalEff","endgameStrength","blunderRate","avgMoveTime","plies","meanCpLoss"];
  const csv = [
    headersCsv.join(","),
    ...rows.map(r => headersCsv.map(h => r[h]).join(","))
  ].join("\n") + "\n";

  const outDir = dirname(resolve(args.output));
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(args.output, csv);
  origStdoutWrite(`\nWrote ${rows.length} rows → ${args.output}\n`);
  process.exit(0);
}

main().catch(e => { stopCapture(); console.error(e); process.exit(1); });
