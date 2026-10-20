"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureTreeLoaded = ensureTreeLoaded;
exports.treeSize = treeSize;
exports.treeMeta = treeMeta;
exports.lookupPath = lookupPath;
const fs = __importStar(require("node:fs"));
const node_zlib_1 = require("node:zlib");
const DISABLED = process.env.CYBERCHESS_OPENING_TREE_DISABLED === "1";
const TREE_PATH = process.env.CYBERCHESS_OPENING_TREE_PATH || "";
const TREE_URL = process.env.CYBERCHESS_OPENING_TREE_URL ||
    "https://aevion.app/opening-tree.json.gz";
let TREE = {};
let META = {};
let size = 0;
let loadPromise = null;
function parseBuffer(buf, source) {
    const bytes = source.endsWith(".gz") ? (0, node_zlib_1.gunzipSync)(buf) : buf;
    const parsed = JSON.parse(bytes.toString("utf-8"));
    if (!parsed || typeof parsed !== "object" || !parsed.tree) {
        console.warn(`[cyberchess-tree] ${source}: unexpected shape — serving empty`);
        return;
    }
    const compact = parsed.meta?.format === "compact";
    const out = {};
    for (const [k, rows] of Object.entries(parsed.tree)) {
        if (!Array.isArray(rows))
            continue;
        out[k] = compact
            ? rows
            : rows.map((r) => [r.m, r.w, r.d, r.b, r.n]);
    }
    TREE = out;
    META = parsed.meta || {};
    size = Object.keys(TREE).length;
    console.log(`[cyberchess-tree] loaded ${size} nodes (${source})`);
}
// Load once, lazily. Local file (if configured) wins; else fetch the public
// (gzipped) URL. Any failure → empty tree (caller degrades to the static book).
// Never throws.
function ensureTreeLoaded() {
    if (DISABLED)
        return Promise.resolve();
    if (loadPromise)
        return loadPromise;
    loadPromise = (async () => {
        if (TREE_PATH) {
            try {
                if (fs.existsSync(TREE_PATH)) {
                    parseBuffer(fs.readFileSync(TREE_PATH), `file ${TREE_PATH}`);
                    if (size > 0)
                        return;
                }
            }
            catch (e) {
                console.warn("[cyberchess-tree] local load failed:", e instanceof Error ? e.message : e);
            }
        }
        try {
            const r = await fetch(TREE_URL);
            if (!r.ok)
                throw new Error(`HTTP ${r.status}`);
            parseBuffer(Buffer.from(await r.arrayBuffer()), `url ${TREE_URL}`);
        }
        catch (e) {
            console.warn("[cyberchess-tree] url load failed:", e instanceof Error ? e.message : e);
        }
    })().then(() => {
        // If we ended up empty (e.g. the static asset wasn't deployed yet), clear
        // the cached promise so a later request retries instead of being stuck.
        if (size === 0)
            loadPromise = null;
    });
    return loadPromise;
}
function treeSize() {
    return size;
}
function treeMeta() {
    return META;
}
// Look up the node for a SAN move path (array from the start position).
// Returns null when the position isn't in the tree.
function lookupPath(sanPath) {
    const rows = TREE[sanPath.join(" ")];
    if (!rows || !rows.length)
        return null;
    let w = 0, d = 0, b = 0;
    const moves = new Array(rows.length);
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        w += r[1];
        d += r[2];
        b += r[3];
        moves[i] = { m: r[0], w: r[1], d: r[2], b: r[3], n: r[4] };
    }
    return { white: w, draws: d, black: b, total: w + d + b, moves };
}
