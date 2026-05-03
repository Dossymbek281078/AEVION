/* ═══ Coordinates Trainer ═══
   Тренажёр координат. Показываем "e4", игрок тапает по
   правильной клетке. Скорость + точность за 30 сек. */

const FILES = "abcdefgh";
const RANKS = "12345678";

export type CoordRound = {
  target: string; // e.g. "e4"
  startedAt: number;
};

export type CoordSession = {
  v: 1;
  startedAt: number;
  endsAt: number;
  durationMs: number;
  round: CoordRound;
  hits: number;
  misses: number;
  reactions: number[]; // ms per correct hit
  asWhite: boolean; // perspective
};

export type CoordResult = {
  hits: number;
  misses: number;
  total: number;
  accuracy: number; // 0..100
  avgReactionMs: number;
  bestReactionMs: number;
  score: number;
};

const LBK = "aevion_chess_coord_lb_v1";

export function randomSquare(): string {
  return FILES[Math.floor(Math.random() * 8)] + RANKS[Math.floor(Math.random() * 8)];
}

export function startSession(durationMs = 30_000, asWhite = true): CoordSession {
  const startedAt = Date.now();
  return {
    v: 1,
    startedAt,
    endsAt: startedAt + durationMs,
    durationMs,
    round: { target: randomSquare(), startedAt },
    hits: 0,
    misses: 0,
    reactions: [],
    asWhite,
  };
}

export function isExpired(s: CoordSession, now = Date.now()): boolean {
  return now >= s.endsAt;
}

export function timeLeftMs(s: CoordSession, now = Date.now()): number {
  return Math.max(0, s.endsAt - now);
}

export function registerHit(s: CoordSession, square: string): { session: CoordSession; correct: boolean; reactionMs: number } {
  if (isExpired(s)) return { session: s, correct: false, reactionMs: 0 };
  const correct = square === s.round.target;
  const now = Date.now();
  const reactionMs = now - s.round.startedAt;
  if (correct) {
    return {
      session: {
        ...s,
        hits: s.hits + 1,
        reactions: [...s.reactions, reactionMs],
        round: { target: nextDifferent(s.round.target), startedAt: now },
      },
      correct: true,
      reactionMs,
    };
  }
  return {
    session: { ...s, misses: s.misses + 1 },
    correct: false,
    reactionMs,
  };
}

function nextDifferent(prev: string): string {
  let n = randomSquare();
  let safety = 0;
  while (n === prev && safety++ < 5) n = randomSquare();
  return n;
}

export function summarize(s: CoordSession): CoordResult {
  const total = s.hits + s.misses;
  const accuracy = total ? Math.round((s.hits / total) * 100) : 0;
  const avgReactionMs = s.reactions.length
    ? Math.round(s.reactions.reduce((a, b) => a + b, 0) / s.reactions.length)
    : 0;
  const bestReactionMs = s.reactions.length ? Math.min(...s.reactions) : 0;
  // Score = hits * 100 - misses * 50 + speed bonus (capped)
  const speedBonus = s.reactions.length
    ? Math.max(0, Math.round(2000 - avgReactionMs) / 10)
    : 0;
  const score = Math.max(0, s.hits * 100 - s.misses * 50 + Math.round(speedBonus));
  return { hits: s.hits, misses: s.misses, total, accuracy, avgReactionMs, bestReactionMs, score };
}

export type CoordLeaderboardEntry = { ts: number; result: CoordResult };

export function loadLeaderboard(): CoordLeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LBK);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveToLeaderboard(result: CoordResult): CoordLeaderboardEntry[] {
  try {
    const lb = loadLeaderboard();
    lb.push({ ts: Date.now(), result });
    lb.sort((a, b) => b.result.score - a.result.score);
    const trimmed = lb.slice(0, 20);
    localStorage.setItem(LBK, JSON.stringify(trimmed));
    return trimmed;
  } catch {
    return [];
  }
}

// Rank vs everyone
export function bestScore(): number {
  const lb = loadLeaderboard();
  return lb[0]?.result.score ?? 0;
}

// Title based on score
export function rankTitle(score: number): { title: string; emoji: string; reward: number } {
  if (score >= 4000) return { title: "Lightning Master", emoji: "⚡", reward: 100 };
  if (score >= 3000) return { title: "Quick Sight", emoji: "🦅", reward: 60 };
  if (score >= 2000) return { title: "Solid", emoji: "🎯", reward: 40 };
  if (score >= 1000) return { title: "Learner", emoji: "📚", reward: 20 };
  return { title: "Rookie", emoji: "🌱", reward: 10 };
}
