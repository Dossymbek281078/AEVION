// Style Cloner — анализ Lichess партий → профиль игрока → бот-клон.
// Импорт через публичный Lichess API (без auth) или вручную через PGN paste.
// Профайл сжимается в URL-safe base64 для share-link.

import { Chess } from "chess.js";

const CK = "aevion_clones_v1";

export type CloneProfile = {
  v: 1;
  username: string;        // Lichess handle or "manual"
  ts: number;
  gamesAnalyzed: number;
  // Aggregate style metrics
  rating: number;          // average from games (or last)
  avgMoves: number;
  whiteWinRate: number;    // 0..1
  blackWinRate: number;    // 0..1
  // Behavioural metrics
  earlyQueenRate: number;  // 0..1 — queen out before move 5
  castleRate: number;      // 0..1 — castled at all
  earlyCastleRate: number; // 0..1 — castled before move 12
  captureRate: number;     // 0..1 — captures per ply
  sacrificeRate: number;   // 0..1 — moves where higher-value piece is captured next
  enPassantCount: number;
  // Opening preferences (first 6 plies)
  topOpenings: { line: string; count: number }[];
  // Style verdict
  style: "Aggressive" | "Tactical" | "Solid" | "Positional" | "Wild";
  // Rating bucket → maps to AI level
  aiLevel: number;         // 0..5 (clamped to ALS index)
};

export function ldClones(): CloneProfile[] {
  try { const s = localStorage.getItem(CK); if (!s) return []; const r = JSON.parse(s); return Array.isArray(r) ? r : [] } catch { return [] }
}
export function svClones(list: CloneProfile[]) {
  try { localStorage.setItem(CK, JSON.stringify(list.slice(0, 20))) } catch {}
}

// Fetch raw PGN text bundle from Lichess for a user.
// Lichess returns NDJSON if Accept: application/x-ndjson, but plain PGN is simpler.
export async function fetchLichessGames(username: string, max = 30): Promise<string[]> {
  const url = `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${max}&pgnInJson=false&clocks=false&evals=false&opening=false&literate=false`;
  const r = await fetch(url, { headers: { Accept: "application/x-chess-pgn" } });
  if (!r.ok) throw new Error(`Lichess ${r.status}: ${r.statusText}`);
  const text = await r.text();
  // Split on double newlines between games (PGN convention)
  const games = text.split(/\n\n\n/).map(g => g.trim()).filter(Boolean);
  return games;
}

// Parse a PGN block into { headers, sans, sideOfUser } where sideOfUser is "w"|"b"|null
function parsePgnBlock(pgn: string, username: string): { white: string; black: string; result: string; sans: string[]; userSide: "w" | "b" | null; whiteElo: number; blackElo: number } {
  const headerMap: Record<string, string> = {};
  const headerRe = /\[(\w+)\s+"([^"]*)"\]/g;
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(pgn))) headerMap[m[1]] = m[2];
  let body = pgn.replace(/^\s*\[[^\]]*\][^\n]*\n/gm, "");
  body = body.replace(/\{[^}]*\}/g, "").replace(/\([^)]*\)/g, "");
  body = body.replace(/\$\d+/g, "").replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g, "");
  body = body.replace(/\d+\.(\.\.)?/g, "");
  const sans = body.split(/\s+/).filter(t => t && !/^\d+$/.test(t));
  const lc = username.toLowerCase();
  const userSide: "w" | "b" | null =
    headerMap.White?.toLowerCase() === lc ? "w" :
    headerMap.Black?.toLowerCase() === lc ? "b" : null;
  return {
    white: headerMap.White || "?",
    black: headerMap.Black || "?",
    result: headerMap.Result || "*",
    sans,
    userSide,
    whiteElo: parseInt(headerMap.WhiteElo || "0") || 0,
    blackElo: parseInt(headerMap.BlackElo || "0") || 0,
  };
}

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// Analyze N PGN game blocks for username → profile.
// userPredicate: optional override (use "manual" to count all sides as user).
export function analyzeGames(pgnBlocks: string[], username: string): CloneProfile {
  const games = pgnBlocks.map(p => parsePgnBlock(p, username));
  const userGames = username === "manual" ? games : games.filter(g => g.userSide);
  if (userGames.length === 0) {
    return {
      v: 1, username, ts: Date.now(), gamesAnalyzed: 0, rating: 800, avgMoves: 30,
      whiteWinRate: 0.5, blackWinRate: 0.5, earlyQueenRate: 0, castleRate: 0,
      earlyCastleRate: 0, captureRate: 0, sacrificeRate: 0, enPassantCount: 0,
      topOpenings: [], style: "Solid", aiLevel: 2,
    };
  }
  let wins = { w: 0, l: 0, d: 0 };
  let blackResults = { w: 0, l: 0, d: 0 };
  let totalMoves = 0;
  let earlyQueenGames = 0;
  let castledGames = 0;
  let earlyCastledGames = 0;
  let captures = 0;
  let totalPly = 0;
  let sacrifices = 0;
  let enPassant = 0;
  const openingMap = new Map<string, number>();
  let ratingSum = 0;
  let ratingN = 0;

  for (const g of userGames) {
    const us = username === "manual" ? "w" : g.userSide!;
    const ch = new Chess();
    let ply = 0;
    let userQueenMoved = false;
    let userCastled = false;
    let userCastleMove = -1;
    const opening: string[] = [];
    for (let i = 0; i < g.sans.length; i++) {
      const san = g.sans[i];
      let mv;
      try { mv = ch.move(san) } catch { break }
      if (!mv) break;
      ply++;
      totalPly++;
      const isUserMove = mv.color === us;
      if (i < 6) opening.push(mv.san);
      if (mv.captured) captures++;
      if (mv.flags.includes("e")) enPassant++;
      // Sacrifice heuristic: user moves piece into capture by lower-value piece next move
      if (isUserMove && i + 1 < g.sans.length) {
        const myVal = PIECE_VALUE[mv.piece] || 0;
        try {
          const nextMv = ch.moves({ verbose: true }).find(x => x.to === mv.to && x.captured === mv.piece);
          if (nextMv) {
            const theirVal = PIECE_VALUE[nextMv.piece] || 0;
            if (myVal > theirVal + 1) sacrifices++;
          }
        } catch {}
      }
      if (isUserMove) {
        if (mv.piece === "q" && i < 10 && !userQueenMoved) {
          userQueenMoved = true;
          if (i < 8) earlyQueenGames++;
        }
        if (mv.flags.includes("k") || mv.flags.includes("q")) {
          userCastled = true;
          userCastleMove = i;
        }
      }
    }
    totalMoves += Math.floor(ply / 2);
    if (userCastled) castledGames++;
    if (userCastleMove >= 0 && userCastleMove < 24) earlyCastledGames++;
    const key = opening.slice(0, 4).join(" ");
    if (key) openingMap.set(key, (openingMap.get(key) || 0) + 1);
    // Result tally
    const userWon = (us === "w" && g.result === "1-0") || (us === "b" && g.result === "0-1");
    const userLost = (us === "w" && g.result === "0-1") || (us === "b" && g.result === "1-0");
    const draw = g.result === "1/2-1/2";
    const bucket = us === "w" ? wins : blackResults;
    if (userWon) bucket.w++;
    else if (userLost) bucket.l++;
    else if (draw) bucket.d++;
    const elo = us === "w" ? g.whiteElo : g.blackElo;
    if (elo > 0) { ratingSum += elo; ratingN++ }
  }

  const wTot = wins.w + wins.l + wins.d || 1;
  const bTot = blackResults.w + blackResults.l + blackResults.d || 1;
  const sortedOpenings = [...openingMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([line, count]) => ({ line, count }));
  const rating = ratingN > 0 ? Math.round(ratingSum / ratingN) : 1200;
  const earlyQueenRate = earlyQueenGames / userGames.length;
  const castleRate = castledGames / userGames.length;
  const earlyCastleRate = earlyCastledGames / userGames.length;
  const captureRate = totalPly > 0 ? captures / totalPly : 0;
  const sacrificeRate = userGames.length > 0 ? sacrifices / userGames.length : 0;

  // Style verdict
  let style: CloneProfile["style"] = "Solid";
  if (sacrificeRate > 0.4 || earlyQueenRate > 0.5) style = "Wild";
  else if (captureRate > 0.18) style = "Aggressive";
  else if (sacrificeRate > 0.2) style = "Tactical";
  else if (earlyCastleRate > 0.7 && captureRate < 0.13) style = "Positional";
  else if (earlyCastleRate > 0.6) style = "Solid";

  // Map rating → aiLevel (0..5)
  const aiLevel =
    rating < 700 ? 1 :
    rating < 1100 ? 2 :
    rating < 1500 ? 3 :
    rating < 1900 ? 4 :
    5;

  return {
    v: 1,
    username,
    ts: Date.now(),
    gamesAnalyzed: userGames.length,
    rating,
    avgMoves: Math.round(totalMoves / userGames.length),
    whiteWinRate: wins.w / wTot,
    blackWinRate: blackResults.w / bTot,
    earlyQueenRate,
    castleRate,
    earlyCastleRate,
    captureRate,
    sacrificeRate,
    enPassantCount: enPassant,
    topOpenings: sortedOpenings,
    style,
    aiLevel,
  };
}

// URL-safe base64 of compact profile (drops verbose fields for share size).
export function profileToShareCode(p: CloneProfile): string {
  const compact = {
    u: p.username,
    g: p.gamesAnalyzed,
    r: p.rating,
    am: p.avgMoves,
    wwr: +p.whiteWinRate.toFixed(2),
    bwr: +p.blackWinRate.toFixed(2),
    eq: +p.earlyQueenRate.toFixed(2),
    cr: +p.castleRate.toFixed(2),
    ecr: +p.earlyCastleRate.toFixed(2),
    cap: +p.captureRate.toFixed(2),
    s: +p.sacrificeRate.toFixed(2),
    op: p.topOpenings.slice(0, 3),
    st: p.style,
    al: p.aiLevel,
  };
  const json = JSON.stringify(compact);
  if (typeof btoa === "undefined") return "";
  // URL-safe base64
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function shareCodeToProfile(code: string): CloneProfile | null {
  try {
    if (typeof atob === "undefined") return null;
    const b64 = code.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - code.length % 4) % 4);
    const json = decodeURIComponent(escape(atob(b64)));
    const c = JSON.parse(json);
    return {
      v: 1, username: c.u || "shared", ts: Date.now(), gamesAnalyzed: c.g || 0,
      rating: c.r || 1200, avgMoves: c.am || 30,
      whiteWinRate: c.wwr || 0.5, blackWinRate: c.bwr || 0.5,
      earlyQueenRate: c.eq || 0, castleRate: c.cr || 0, earlyCastleRate: c.ecr || 0,
      captureRate: c.cap || 0, sacrificeRate: c.s || 0, enPassantCount: 0,
      topOpenings: c.op || [], style: c.st || "Solid", aiLevel: c.al || 2,
    };
  } catch { return null }
}

// Get the clone's preferred opening move for the current position.
// Returns SAN string or null. Looks at top opening lines and replays them.
export function clonePreferredMove(p: CloneProfile, history: string[]): string | null {
  if (history.length >= 8) return null; // Only force opening for first 8 plies
  for (const op of p.topOpenings) {
    const moves = op.line.split(" ").filter(Boolean);
    // Check that the first `history.length` moves match
    if (history.length >= moves.length) continue;
    let ok = true;
    for (let i = 0; i < history.length; i++) {
      if (moves[i] !== history[i]) { ok = false; break }
    }
    if (ok) return moves[history.length];
  }
  return null;
}

// Human-readable style verdict text (ru-RU)
export function styleVerdict(p: CloneProfile): string {
  const parts: string[] = [];
  if (p.earlyCastleRate > 0.6) parts.push("любит рокировку рано");
  else if (p.castleRate < 0.4) parts.push("часто играет без рокировки");
  if (p.captureRate > 0.18) parts.push("охотно идёт на размены");
  else if (p.captureRate < 0.1) parts.push("избегает разменов");
  if (p.sacrificeRate > 0.3) parts.push("жертвует материал");
  if (p.earlyQueenRate > 0.4) parts.push("выводит ферзя рано");
  if (parts.length === 0) parts.push("сбалансированный стиль");
  return parts.join(", ");
}
