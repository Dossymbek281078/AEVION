// AEVION CyberChess — our own deep opening tree (built from CC0 Lichess Elite).
//
// Served node lookup by MOVE PREFIX (SAN path from the start). The tree is
// produced offline by scripts/build-opening-tree.mjs and hosted as a static
// JSON (like puzzles.json). Shape:
//   { meta: {...}, tree: { "e4 e5 Nf3": [ {m,w,d,b,n}, ... ], ... } }
// where each row is a continuation move `m` (SAN) with white/draw/black counts
// and total games `n`.
//
// This is the middle tier of the opening explorer: real master-level W/D/L
// statistics deep into theory, with NO dependency on Lichess's (now gated)
// live API and no token. Loads once, lazily, from a public URL.

import * as fs from "node:fs";

export interface TreeRow {
  m: string; // SAN continuation
  w: number;
  d: number;
  b: number;
  n: number; // total games
}

export interface TreeNode {
  white: number;
  draws: number;
  black: number;
  total: number;
  moves: TreeRow[];
}

const TREE_PATH = process.env.CYBERCHESS_OPENING_TREE_PATH || "";
const TREE_URL =
  process.env.CYBERCHESS_OPENING_TREE_URL ||
  "https://aevion.vercel.app/opening-tree.json";

let TREE: Record<string, TreeRow[]> = {};
let META: Record<string, unknown> = {};
let size = 0;
let loadPromise: Promise<void> | null = null;

function ingest(parsed: unknown, source: string): void {
  const obj = parsed as { tree?: Record<string, TreeRow[]>; meta?: Record<string, unknown> };
  if (!obj || typeof obj !== "object" || !obj.tree || typeof obj.tree !== "object") {
    console.warn(`[cyberchess-tree] ${source}: unexpected shape — serving empty`);
    return;
  }
  TREE = obj.tree;
  META = obj.meta || {};
  size = Object.keys(TREE).length;
  console.log(`[cyberchess-tree] loaded ${size} nodes (${source})`);
}

// Load once. Local file (if configured) wins; else fetch the public URL. Any
// failure → empty tree (the caller degrades to the static book). Never throws.
export function ensureTreeLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    if (TREE_PATH) {
      try {
        if (fs.existsSync(TREE_PATH)) {
          ingest(JSON.parse(fs.readFileSync(TREE_PATH, "utf-8")), `file ${TREE_PATH}`);
          if (size > 0) return;
        }
      } catch (e) {
        console.warn("[cyberchess-tree] local load failed:", e instanceof Error ? e.message : e);
      }
    }
    try {
      const r = await fetch(TREE_URL);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      ingest(await r.json(), `url ${TREE_URL}`);
    } catch (e) {
      console.warn("[cyberchess-tree] url load failed:", e instanceof Error ? e.message : e);
    }
  })();
  return loadPromise;
}

// warm at startup (non-blocking)
void ensureTreeLoaded();

export function treeSize(): number {
  return size;
}
export function treeMeta(): Record<string, unknown> {
  return META;
}

// Look up the node for a SAN move path (array from the start position).
// Returns null when the position isn't in the tree.
export function lookupPath(sanPath: string[]): TreeNode | null {
  const key = sanPath.join(" ");
  const rows = TREE[key];
  if (!rows || !rows.length) return null;
  let w = 0,
    d = 0,
    b = 0;
  for (const r of rows) {
    w += r.w;
    d += r.d;
    b += r.b;
  }
  return { white: w, draws: d, black: b, total: w + d + b, moves: rows };
}
