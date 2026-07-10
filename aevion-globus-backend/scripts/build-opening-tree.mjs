// AEVION CyberChess — build a deep opening tree from CC0 Lichess game dumps.
//
// Streams a lichess_db_standard_rated_YYYY-MM.pgn.zst dump (CC0) straight from
// the URL, decompresses with Node 24's built-in zstd, filters by rating, and
// aggregates real games into an opening tree keyed by MOVE PREFIX (SAN):
//
//   prefix "e4 e5 Nf3" -> { "Nc6": [w,d,b], "d6": [w,d,b], ... }
//
// No chess engine: we only tokenize SAN movetext and count outcomes per
// continuation. That's what makes it tractable in JS on a laptop (millions of
// games in minutes, not days). Trade-off: transpositions via a different move
// order are separate nodes — fine for mainline study.
//
// This is "terabytes -> megabytes" done legitimately: we keep NOT the games,
// but the aggregated statistics. Source games (CC0) stay at Lichess.
//
// Usage:
//   node build-opening-tree.mjs <url|file> [--minElo=2200] [--depth=30]
//        [--maxGames=0] [--minGames=8] [--topK=15] [--out=opening-tree.json]
//   --maxGames>0 downloads/processes only the first N games (validation).

import { createZstdDecompress } from "node:zlib";
import { createReadStream, writeFileSync, statSync, readFileSync } from "node:fs";
import { get } from "node:https";
import { createInterface } from "node:readline";
import { Transform } from "node:stream";

// Lichess dumps begin with a zstd *skippable* frame (magic 0x184D2A50-5F:
// 4-byte magic + 4-byte LE size + payload). Node's zstd stream chokes on it
// ("Unknown frame descriptor"), so strip a leading skippable frame before
// decompressing the real frame that follows.
function skippableStripper() {
  let head = Buffer.alloc(0);
  let decided = false;
  let toDrop = 0;
  return new Transform({
    transform(chunk, _enc, cb) {
      if (decided) {
        if (toDrop > 0) {
          const d = Math.min(toDrop, chunk.length);
          toDrop -= d;
          chunk = chunk.subarray(d);
        }
        cb(null, chunk.length ? chunk : undefined);
        return;
      }
      head = Buffer.concat([head, chunk]);
      if (head.length < 8) return cb();
      const magic = head.readUInt32LE(0);
      if (magic >= 0x184d2a50 && magic <= 0x184d2a5f) {
        toDrop = 8 + head.readUInt32LE(4); // whole skippable frame
      }
      decided = true;
      let buf = head;
      if (toDrop > 0) {
        const d = Math.min(toDrop, buf.length);
        toDrop -= d;
        buf = buf.subarray(d);
      }
      cb(null, buf.length ? buf : undefined);
    },
  });
}

const args = process.argv.slice(2);
const src = args.find((a) => !a.startsWith("--"));
const opt = (k, d) => {
  const hit = args.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.split("=")[1] : d;
};
const MIN_ELO = parseInt(opt("minElo", "2200"), 10);
const DEPTH = parseInt(opt("depth", "30"), 10); // plies
const MAX_GAMES = parseInt(opt("maxGames", "0"), 10);
const MIN_GAMES = parseInt(opt("minGames", "8"), 10); // final prune: drop continuations below this
const TOP_K = parseInt(opt("topK", "15"), 10);
const OUT = opt("out", "opening-tree.json");
// Memory guard: periodically drop deep, rare nodes so the in-RAM Map stays
// bounded on a full month. A continuation at ply > PRUNE_DEPTH seen < PRUNE_MIN
// times so far is almost certainly a one-off; real theory that deep has many
// games. Shallow nodes are never periodically pruned (they always matter).
const PRUNE_DEPTH = parseInt(opt("pruneDepth", "14"), 10); // plies
const PRUNE_MIN = parseInt(opt("pruneMin", "2"), 10);
// Prune by MAP SIZE, not game count: unique deep positions grow ~linearly with
// games (each deep prefix is usually a one-off), so a game-count trigger can't
// bound memory and V8's Map hits its hard element cap. When the tree exceeds
// SIZE_CAP nodes we drop deep+rare nodes. Mainlines (thousands of games) far
// exceed PRUNE_MIN within a prune interval and survive; rare deep lines (noise,
// and below the final minGames anyway) are dropped.
const SIZE_CAP = parseInt(opt("sizeCap", "2500000"), 10); // nodes
const MERGE = opt("merge", ""); // seed from an existing built tree (incremental months)

if (!src) {
  console.error("need a .pgn.zst url or local file path");
  process.exit(1);
}

// tree: Map<prefix, Map<move, Int32[3]>>  (0=white win, 1=draw, 2=black win)
const tree = new Map();
let games = 0,
  kept = 0,
  t0 = Date.now();

const plyOf = (prefix) => (prefix === "" ? 0 : prefix.split(" ").length);

// Seed from an existing built tree (JSON: {tree:{prefix:[{m,w,d,b,n}]}}) so
// months can be accumulated incrementally without holding all of them at once.
function seedFromMerge(path) {
  try {
    const data = JSON.parse(readFileSync(path, "utf-8"));
    let n = 0;
    for (const [prefix, rows] of Object.entries(data.tree || {})) {
      const node = new Map();
      for (const r of rows) {
        node.set(r.m, [r.w | 0, r.d | 0, r.b | 0]);
        n++;
      }
      tree.set(prefix, node);
    }
    console.log(`merged seed: ${tree.size} nodes, ${n} continuations from ${path}`);
  } catch (e) {
    console.warn("merge seed failed:", e.message);
  }
}

// Memory guard: drop deep+rare continuations. Escalates the depth/min threshold
// until the tree is back under SIZE_CAP, so it can never blow past V8's limit.
function sizeGuardPrune() {
  let depth = PRUNE_DEPTH;
  let min = PRUNE_MIN;
  while (tree.size > SIZE_CAP) {
    let removed = 0;
    for (const [prefix, node] of tree) {
      if (plyOf(prefix) <= depth) continue;
      for (const [move, c] of node) {
        if (c[0] + c[1] + c[2] < min) {
          node.delete(move);
          removed++;
        }
      }
      if (node.size === 0) tree.delete(prefix);
    }
    console.log(`  [prune] depth>${depth} min<${min}: removed ${removed} → ${tree.size} nodes`);
    // Escalate: go shallower, then raise the count threshold.
    if (depth > 8) depth -= 2;
    else min += 1;
    if (min > 8) break; // safety: don't loop forever
  }
}

function record(moves, outcomeIdx) {
  const n = Math.min(moves.length, DEPTH);
  for (let i = 0; i < n; i++) {
    const prefix = i === 0 ? "" : moves.slice(0, i).join(" ");
    let node = tree.get(prefix);
    if (!node) {
      node = new Map();
      tree.set(prefix, node);
    }
    let cell = node.get(moves[i]);
    if (!cell) {
      cell = [0, 0, 0];
      node.set(moves[i], cell);
    }
    cell[outcomeIdx]++;
  }
}

// Strip comments {..}, NAGs $n, move numbers, results → SAN token array.
const RESULTS = new Set(["1-0", "0-1", "1/2-1/2", "*"]);
function sanTokens(movetext) {
  const noComments = movetext.replace(/\{[^}]*\}/g, " ").replace(/;[^\n]*/g, " ");
  const out = [];
  for (let tok of noComments.split(/\s+/)) {
    if (!tok) continue;
    if (tok[0] === "$") continue; // NAG
    // strip leading move number like "12." / "12..."
    tok = tok.replace(/^\d+\.(\.\.)?/, "");
    if (!tok) continue;
    if (RESULTS.has(tok)) continue;
    // a real SAN move starts with a piece letter, file, O (castle)
    if (/^[a-hRNBQKO]/.test(tok)) out.push(tok);
  }
  return out;
}

function flush(headers, movetext) {
  games++;
  const we = parseInt(headers.WhiteElo, 10);
  const be = parseInt(headers.BlackElo, 10);
  if (!(we >= MIN_ELO && be >= MIN_ELO)) return;
  const res = headers.Result;
  const outcomeIdx = res === "1-0" ? 0 : res === "0-1" ? 2 : res === "1/2-1/2" ? 1 : -1;
  if (outcomeIdx < 0) return;
  const moves = sanTokens(movetext);
  if (moves.length < 2) return;
  record(moves, outcomeIdx);
  kept++;
}

function getStream(cb) {
  if (/^https?:\/\//.test(src)) {
    get(src, (res) => {
      if (res.statusCode !== 200) {
        console.error("HTTP", res.statusCode);
        process.exit(1);
      }
      cb(res);
    });
  } else {
    cb(createReadStream(src));
  }
}

console.log(`source: ${src}`);
console.log(`minElo=${MIN_ELO} depth=${DEPTH} maxGames=${MAX_GAMES || "all"} minGames=${MIN_GAMES} topK=${TOP_K}`);
console.log(`sizeCap=${SIZE_CAP} pruneDepth=${PRUNE_DEPTH} pruneMin=${PRUNE_MIN}${MERGE ? ` merge=${MERGE}` : ""}`);
if (MERGE) seedFromMerge(MERGE);

// When src is "-", read already-decompressed PGN from stdin (pipeline:
//   curl -sL URL | zstd.exe -dc | node build-opening-tree.mjs - ...).
// The external zstd CLI robustly handles the seekable/skippable frames that
// Node's built-in decompressor chokes on. Otherwise decompress in-process.
function withPgnStream(cb) {
  if (src === "-") {
    cb(process.stdin);
  } else {
    getStream((netStream) => {
      const zstd = createZstdDecompress();
      netStream.pipe(skippableStripper()).pipe(zstd);
      cb(zstd);
    });
  }
}

withPgnStream((pgnStream) => {
  const rl = createInterface({ input: pgnStream, crlfDelay: Infinity });
  const netStream = pgnStream;
  const zstd = pgnStream;

  let headers = {};
  let movetext = "";
  let inMoves = false;
  let stopped = false;

  rl.on("line", (line) => {
    if (stopped) return;
    if (line.startsWith("[")) {
      if (inMoves) {
        // new game began → flush the previous one
        flush(headers, movetext);
        if (games % 500000 === 0)
          console.log(`  ${games} games, ${kept} kept, ${tree.size} nodes, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
        if (games % 100000 === 0 && tree.size > SIZE_CAP) sizeGuardPrune();
        if (MAX_GAMES && games >= MAX_GAMES) {
          stopped = true;
          rl.close();
          netStream.destroy();
          return;
        }
        headers = {};
        movetext = "";
        inMoves = false;
      }
      const m = line.match(/^\[(\w+)\s+"(.*)"\]/);
      if (m) headers[m[1]] = m[2];
    } else if (line.trim() === "") {
      // blank: separates headers/moves or games — ignore, boundaries handled above
    } else {
      inMoves = true;
      movetext += " " + line;
    }
  });

  rl.on("close", () => finish());
  zstd.on("error", (e) => {
    // aborting the socket after maxGames triggers a benign stream error
    if (!stopped) {
      console.error("zstd error:", e.message);
    }
    finish();
  });

  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    if (!stopped && inMoves) flush(headers, movetext); // last game at EOF
    prune();
  }
});

function prune() {
  let nodesKept = 0,
    contsKept = 0;
  const outObj = {};
  for (const [prefix, node] of tree) {
    const rows = [];
    for (const [move, [w, d, b]] of node) {
      const total = w + d + b;
      if (total < MIN_GAMES) continue;
      rows.push({ m: move, w, d, b, n: total });
    }
    if (!rows.length) continue;
    rows.sort((a, b) => b.n - a.n);
    outObj[prefix] = rows.slice(0, TOP_K);
    nodesKept++;
    contsKept += Math.min(rows.length, TOP_K);
  }
  const meta = {
    source: src,
    minElo: MIN_ELO,
    depth: DEPTH,
    minGames: MIN_GAMES,
    topK: TOP_K,
    gamesScanned: games,
    gamesKept: kept,
    nodes: nodesKept,
    continuations: contsKept,
    builtSeconds: Math.round((Date.now() - t0) / 1000),
  };
  writeFileSync(OUT, JSON.stringify({ meta, tree: outObj }));
  const kb = statSync(OUT).size / 1024;
  console.log("=== DONE ===");
  console.log(JSON.stringify(meta, null, 2));
  console.log(`wrote ${OUT} — ${kb > 1024 ? (kb / 1024).toFixed(1) + " MB" : kb.toFixed(0) + " KB"}`);
}
