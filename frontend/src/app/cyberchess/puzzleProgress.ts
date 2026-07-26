/* AEVION CyberChess — which puzzles this player has already been paid for.

   Why this exists: solving a puzzle awards Chessy (a difficulty reward plus a
   speed bonus, 6–33 in total), and nothing recorded that a given puzzle had
   already paid out. The same position could be re-solved without limit, and
   Chessy gates real things — Master AI costs 30, the shop sells boosts — so the
   currency could be farmed off one easy puzzle indefinitely.

   Repeat solving stays available: replaying a position you got wrong last week
   is the point of a puzzle trainer. It just does not pay twice, which is how
   lichess and chess.com treat it too.

   Puzzle records carry no id — `fen` is the stable key. Storing ~10,800 full
   FENs would be ~650KB of localStorage; a 32-bit hash brings that to ~90KB.
   Collisions cost a player one duplicate reward, which is the harmless
   direction to fail in. */

const KEY = "aevion_pz_solved_v1";
/** Keep the store bounded even if the corpus grows well past today's 10,818. */
const MAX_ENTRIES = 20000;

/** FNV-1a, 32-bit, hex. Small, fast, and stable across sessions. */
export function fenKey(fen: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < fen.length; i++) {
    h ^= fen.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function loadSolved(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function persist(set: Set<string>): void {
  try {
    let arr = [...set];
    if (arr.length > MAX_ENTRIES) arr = arr.slice(arr.length - MAX_ENTRIES);
    localStorage.setItem(KEY, JSON.stringify(arr));
  } catch {
    /* quota or private mode — rewards simply stay repeatable, no crash */
  }
}

/** Has this position already paid out? */
export function isRewarded(set: Set<string>, fen: string): boolean {
  return set.has(fenKey(fen));
}

/**
 * Record a payout. Returns true when this was the first time — the caller uses
 * that to decide whether to award, so the check and the write cannot drift
 * apart into a double-award race.
 */
export function claimReward(set: Set<string>, fen: string): boolean {
  const k = fenKey(fen);
  if (set.has(k)) return false;
  set.add(k);
  persist(set);
  return true;
}
