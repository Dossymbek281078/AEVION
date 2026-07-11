// AEVION CyberChess — our own deep opening tree (built from CC0 Lichess Elite).
//
// Served node lookup by MOVE PREFIX (SAN path from the start). The tree is
// produced offline by scripts/build-opening-tree.mjs from ALL Lichess Elite
// months (2020-2025) and hosted GZIPPED as a static asset. Shape (compact):
//   { meta:{format:"compact",fields:["m","w","d","b","n"]},
//     tree: { "e4 e5 Nf3": [ ["Nc6",w,d,b,n], ... ], ... } }
//
// This is the middle tier of the opening explorer: real master-level W/D/L
// statistics deep into theory, with NO dependency on Lichess's (now gated) live
// API and no token.
//
// Memory safety (this loads into the SHARED backend process, so an OOM would
// take down every AEVION module):
//   - LAZY: not loaded at startup — only on the first request that needs it,
//     so idle deployments pay nothing.
//   - kill-switch: CYBERCHESS_OPENING_TREE_DISABLED=1 disables it entirely.
//   - compact array rows + gzip keep the file and heap small (~100 MB parsed).

import * as fs from "node:fs";
import { gunzipSync } from "node:zlib";

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

type CompactRow = [string, number, number, number, number];

const DISABLED = process.env.CYBERCHESS_OPENING_TREE_DISABLED === "1";
const TREE_PATH = process.env.CYBERCHESS_OPENING_TREE_PATH || "";
const TREE_URL =
  process.env.CYBERCHESS_OPENING_TREE_URL ||
  "https://aevion.vercel.app/opening-tree.json.gz";

let TREE: Record<string, CompactRow[]> = {};
let META: Record<string, unknown> = {};
let size = 0;
let loadPromise: Promise<void> | null = null;

function parseBuffer(buf: Buffer, source: string): void {
  const bytes = source.endsWith(".gz") ? gunzipSync(buf) : buf;
  const parsed = JSON.parse(bytes.toString("utf-8")) as {
    tree?: Record<string, unknown[]>;
    meta?: Record<string, unknown>;
  };
  if (!parsed || typeof parsed !== "object" || !parsed.tree) {
    console.warn(`[cyberchess-tree] ${source}: unexpected shape — serving empty`);
    return;
  }
  const compact = (parsed.meta as { format?: string })?.format === "compact";
  const out: Record<string, CompactRow[]> = {};
  for (const [k, rows] of Object.entries(parsed.tree)) {
    if (!Array.isArray(rows)) continue;
    out[k] = compact
      ? (rows as CompactRow[])
      : (rows as Array<{ m: string; w: number; d: number; b: number; n: number }>).map(
          (r) => [r.m, r.w, r.d, r.b, r.n] as CompactRow,
        );
  }
  TREE = out;
  META = parsed.meta || {};
  size = Object.keys(TREE).length;
  console.log(`[cyberchess-tree] loaded ${size} nodes (${source})`);
}

// Load once, lazily. Local file (if configured) wins; else fetch the public
// (gzipped) URL. Any failure → empty tree (caller degrades to the static book).
// Never throws.
export function ensureTreeLoaded(): Promise<void> {
  if (DISABLED) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    if (TREE_PATH) {
      try {
        if (fs.existsSync(TREE_PATH)) {
          parseBuffer(fs.readFileSync(TREE_PATH), `file ${TREE_PATH}`);
          if (size > 0) return;
        }
      } catch (e) {
        console.warn("[cyberchess-tree] local load failed:", e instanceof Error ? e.message : e);
      }
    }
    try {
      const r = await fetch(TREE_URL);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      parseBuffer(Buffer.from(await r.arrayBuffer()), `url ${TREE_URL}`);
    } catch (e) {
      console.warn("[cyberchess-tree] url load failed:", e instanceof Error ? e.message : e);
    }
  })().then(() => {
    // If we ended up empty (e.g. the static asset wasn't deployed yet), clear
    // the cached promise so a later request retries instead of being stuck.
    if (size === 0) loadPromise = null;
  });
  return loadPromise;
}

export function treeSize(): number {
  return size;
}
export function treeMeta(): Record<string, unknown> {
  return META;
}

// Look up the node for a SAN move path (array from the start position).
// Returns null when the position isn't in the tree.
export function lookupPath(sanPath: string[]): TreeNode | null {
  const rows = TREE[sanPath.join(" ")];
  if (!rows || !rows.length) return null;
  let w = 0,
    d = 0,
    b = 0;
  const moves: TreeRow[] = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    w += r[1];
    d += r[2];
    b += r[3];
    moves[i] = { m: r[0], w: r[1], d: r[2], b: r[3], n: r[4] };
  }
  return { white: w, draws: d, black: b, total: w + d + b, moves };
}
