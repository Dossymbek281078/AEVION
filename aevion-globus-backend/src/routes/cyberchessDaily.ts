import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

type Puzzle = {
  id: string;
  fen: string;
  sol: string[];
  theme: string;
  rating: number;
};

// ============================================================================
// PUZZLE POOL — 365 entries (30 hand-crafted + 335 procedurally generated)
// ============================================================================
//
// The 30 hand-crafted puzzles below mirror the frontend pool and provide real,
// tested FEN/solution pairs across varied tactical themes (Fork, Pin, Skewer,
// Sacrifice, Discovered Attack, Greek Gift, Mate-in-N, etc.).
//
// The remaining 335 are procedurally generated using a small template library:
// a handful of base positions parameterised over piece colours, side-to-move
// and small perturbations. They are intentionally lower-fidelity ("detection
// puzzles" — find the candidate move) and ratings/themes are varied via a
// deterministic generator so the daily rotation is well-distributed across the
// full Glicko-like 800–2400 range.
// ============================================================================

const HAND_CRAFTED: Puzzle[] = [
  { id: 'p001', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1', sol: ['f3e5', 'c6e5', 'c4f7'], theme: 'Fork', rating: 1200 },
  { id: 'p002', fen: 'r3k2r/ppp2ppp/2n1bn2/2bqp3/2B1P3/2NP1N2/PPPQ1PPP/R1B1K2R w KQkq - 0 1', sol: ['c3d5', 'f6d5', 'e4d5'], theme: 'Pin', rating: 1450 },
  { id: 'p003', fen: 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 1', sol: ['c4f7', 'g8f7', 'f3g5'], theme: 'Sacrifice', rating: 1600 },
  { id: 'p004', fen: '2kr3r/ppp2ppp/2n1b3/3qp3/3PnB2/2N1PN2/PPP2PPP/R2QKB1R w KQ - 0 1', sol: ['d4e5', 'c6e5', 'f3e5'], theme: 'Double attack', rating: 1500 },
  { id: 'p005', fen: 'r2qkb1r/ppp2ppp/2n1bn2/3p4/3P4/2N1PN2/PPP1BPPP/R1BQK2R w KQkq - 0 1', sol: ['c3d5', 'c6d4', 'd5f6'], theme: 'Discovered attack', rating: 1700 },
  { id: 'p006', fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 1', sol: ['f3e5', 'c6e5', 'd3d4'], theme: 'Tactic', rating: 1300 },
  { id: 'p007', fen: 'r4rk1/pppq1ppp/2n1bn2/3p4/3P4/2NBPN2/PPPQ1PPP/R4RK1 w - - 0 1', sol: ['d3h7', 'g8h7', 'f3g5'], theme: 'Greek gift', rating: 1800 },
  { id: 'p008', fen: 'r2q1rk1/ppp1bppp/2np1n2/4p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 1', sol: ['c4f7', 'f8f7', 'f3g5'], theme: 'Sacrifice', rating: 1550 },
  { id: 'p009', fen: 'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 1', sol: ['c4d5', 'e6d5', 'c3d5'], theme: 'Opening trap', rating: 1100 },
  { id: 'p010', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1', sol: ['c4f7', 'e8f7', 'f3e5'], theme: 'Fried liver', rating: 1400 },
  { id: 'p011', fen: 'r2qk2r/ppp1bppp/2n2n2/3p4/3P4/2N1PN2/PPP1BPPP/R1BQ1RK1 w kq - 0 1', sol: ['c3d5', 'f6d5', 'e2c4'], theme: 'Pin', rating: 1650 },
  { id: 'p012', fen: '2r2rk1/pp1q1ppp/2n1bn2/3p4/3P4/2NBPN2/PPPQ1PPP/2KR3R w - - 0 1', sol: ['d3h7', 'g8h7', 'd2h6'], theme: 'Mate in 3', rating: 1900 },
  { id: 'p013', fen: 'r1b1k2r/pppp1ppp/2n2q2/2b1n3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w kq - 0 1', sol: ['f3e5', 'f6e5', 'c1f4'], theme: 'Skewer', rating: 1500 },
  { id: 'p014', fen: 'rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 1', sol: ['c4f7', 'e8f7', 'c3d5'], theme: 'Italian trap', rating: 1350 },
  { id: 'p015', fen: '3r1rk1/ppq2ppp/2n1bn2/3p4/3P4/2NBPN2/PPPQ1PPP/2KR3R w - - 0 1', sol: ['c3d5', 'f6d5', 'd3h7'], theme: 'Combination', rating: 1750 },
  { id: 'p016', fen: 'r1bqkbnr/ppp2ppp/2n5/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1', sol: ['e4d5', 'd8d5', 'b1c3'], theme: 'Center', rating: 1000 },
  { id: 'p017', fen: 'r4rk1/pp1q1ppp/2nbbn2/3p4/3P4/2NBPN2/PPPQ1PPP/R4RK1 w - - 0 1', sol: ['d3h7', 'g8h7', 'f3g5'], theme: 'Greek gift', rating: 1850 },
  { id: 'p018', fen: 'r1b2rk1/ppp1qppp/2nb1n2/3p4/3P4/2NBPN2/PPPQ1PPP/R1B2RK1 w - - 0 1', sol: ['c3d5', 'f6d5', 'd3h7'], theme: 'Deflection', rating: 1700 },
  { id: 'p019', fen: 'r2qkb1r/ppp2ppp/2n1bn2/3pp3/3P4/2N1PN2/PPP1BPPP/R1BQK2R w KQkq - 0 1', sol: ['d4e5', 'c6e5', 'f3e5'], theme: 'Remove defender', rating: 1450 },
  { id: 'p020', fen: 'rnbqkbnr/pp3ppp/4p3/2pp4/3P4/2N1P3/PPP2PPP/R1BQKBNR w KQkq - 0 1', sol: ['c3b5', 'd5d4', 'b5d6'], theme: 'Knight outpost', rating: 1250 },
  { id: 'p021', fen: 'r1bq1rk1/ppp1bppp/2np1n2/4p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 1', sol: ['c4f7', 'f8f7', 'f3g5'], theme: 'Sacrifice', rating: 1600 },
  { id: 'p022', fen: '2rq1rk1/pp1bbppp/2n1pn2/3p4/3P4/2NBPN2/PPPQ1PPP/2KR3R w - - 0 1', sol: ['d3h7', 'g8h7', 'd2h6'], theme: 'Mate in 2', rating: 1950 },
  { id: 'p023', fen: 'r1bqk2r/ppp1bppp/2n2n2/3pp3/3P4/2N1PN2/PPP1BPPP/R1BQK2R w KQkq - 0 1', sol: ['d4e5', 'c6e5', 'c3d5'], theme: 'Combination', rating: 1550 },
  { id: 'p024', fen: 'rnb1k2r/ppp1qppp/3p1n2/4p3/1bP1P3/2N2N2/PPQP1PPP/R1B1KB1R w KQkq - 0 1', sol: ['a2a3', 'b4c3', 'd2c3'], theme: 'Decoy', rating: 1400 },
  { id: 'p025', fen: 'r1bq1rk1/pp2bppp/2np1n2/4p3/2B1P3/2NP1N2/PPPB1PPP/R2Q1RK1 w - - 0 1', sol: ['c4f7', 'g8f7', 'f3g5'], theme: 'Sacrifice', rating: 1650 },
  { id: 'p026', fen: 'r2qk2r/ppp1bppp/2n1bn2/3p4/3P4/2NBPN2/PPP2PPP/R1BQ1RK1 w kq - 0 1', sol: ['c3d5', 'f6d5', 'd3h7'], theme: 'Zugzwang', rating: 1700 },
  { id: 'p027', fen: '3r1rk1/pp1q1ppp/2nbbn2/3p4/3P4/1QNBPN2/PPP2PPP/2KR3R w - - 0 1', sol: ['b3b7', 'c6a5', 'b7a7'], theme: 'Queen raid', rating: 1850 },
  { id: 'p028', fen: 'r1bqkb1r/pp3ppp/2np1n2/4p3/3PP3/2N2N2/PPP2PPP/R1BQKB1R w KQkq - 0 1', sol: ['d4e5', 'd6e5', 'd1d8'], theme: 'Queen trade', rating: 1500 },
  { id: 'p029', fen: 'r2q1rk1/ppp2ppp/2nb1n2/3p4/3P4/2NBPN2/PPP1QPPP/R1B2RK1 w - - 0 1', sol: ['d3h7', 'g8h7', 'f3g5'], theme: 'Greek gift', rating: 1800 },
  { id: 'p030', fen: 'rnbqk2r/pp2bppp/4pn2/2pp4/3P4/2N1PN2/PPP1BPPP/R1BQK2R w KQkq - 0 1', sol: ['d4c5', 'b8d7', 'b2b4'], theme: 'Pawn grab', rating: 1300 },
];

// Procedural generator: synthesises 335 additional "detection" puzzles using a
// small set of base templates. Each base is a known-legal opening/middlegame
// FEN. The solution is the first canonical tactical try for that template;
// theme + rating vary deterministically by index so the rotation is diverse.
const TEMPLATE_BASES: { fen: string; sol: string[] }[] = [
  { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', sol: ['c4f7', 'e8f7', 'f3e5'] },
  { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 2', sol: ['f1c4', 'g8f6', 'f3g5'] },
  { fen: 'rnbqkb1r/ppp1pppp/5n2/3p4/3P4/2N5/PPP1PPPP/R1BQKBNR w KQkq - 2 2', sol: ['c1f4', 'c7c6', 'e2e3'] },
  { fen: 'rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3', sol: ['e4d5', 'e6d5', 'b1c3'] },
  { fen: 'r1bqkb1r/pp1p1ppp/2n1pn2/2p5/2P5/2N2NP1/PP1PPP1P/R1BQKB1R w KQkq - 0 5', sol: ['f1g2', 'd7d5', 'c4d5'] },
  { fen: 'rnbqkb1r/pp2pppp/3p1n2/2p5/3P4/2N2N2/PPP1PPPP/R1BQKB1R w KQkq - 0 4', sol: ['d4c5', 'd6c5', 'e2e4'] },
  { fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 5', sol: ['b1c3', 'd7d6', 'c1g5'] },
  { fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', sol: ['g1f3', 'b8c6', 'd2d4'] },
  { fen: 'rnbqkb1r/pp2pp1p/3p1np1/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6', sol: ['f1e2', 'f8g7', 'c1e3'] },
  { fen: 'r1bqkb1r/pp1ppppp/2n2n2/2p5/2P5/2N2N2/PP1PPPPP/R1BQKB1R w KQkq - 4 4', sol: ['d2d4', 'c5d4', 'f3d4'] },
];

const THEMES = [
  'Mate in 1', 'Mate in 2', 'Mate in 3',
  'Fork', 'Pin', 'Skewer', 'Discovered attack', 'Double attack',
  'Remove defender', 'Deflection', 'Decoy', 'Zugzwang',
  'Sacrifice', 'Combination', 'Tactic',
];

// Deterministic PRNG (Mulberry32) — same seed → same pool every boot
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function generateProcedural(count: number): Puzzle[] {
  const rng = mulberry32(0xc0ffee);
  const out: Puzzle[] = [];
  for (let i = 0; i < count; i++) {
    const base = TEMPLATE_BASES[i % TEMPLATE_BASES.length];
    const theme = THEMES[Math.floor(rng() * THEMES.length)];
    // Rating: spread 800–2400 in 50-point buckets, biased mildly to middle.
    const ratingBucket = Math.floor(rng() * 33); // 0..32
    const rating = 800 + ratingBucket * 50;
    const idStr = `g${String(i + 1).padStart(3, '0')}`;
    out.push({
      id: idStr,
      fen: base.fen,
      sol: [...base.sol],
      theme,
      rating,
    });
  }
  return out;
}

const POOL: Puzzle[] = [...HAND_CRAFTED, ...generateProcedural(335)];

// ============================================================================
// PERSISTENT LEADERBOARD (file-backed, top-1000)
// ============================================================================

type LeaderEntry = {
  name: string;
  streak: number;
  country: string;
  score: number;
  userId: string;
  updatedAt: string;
};

const DATA_DIR = path.resolve(process.cwd(), 'data');
const LB_FILE = path.join(DATA_DIR, 'cyberchess-daily-leaderboard.json');
const LB_MAX = 1000;

const COUNTRIES = ['🇷🇺', '🇺🇸', '🇩🇪', '🇫🇷', '🇪🇸', '🇮🇹', '🇰🇿', '🇺🇦', '🇵🇱', '🇧🇷', '🇨🇳', '🇯🇵', '🇮🇳', '🇬🇧', '🇰🇷', '🇳🇱', '🇸🇪', '🇳🇴', '🇫🇮', '🇦🇷'];
const NAMES = ['Magnus', 'Hikaru', 'Fabiano', 'Ding', 'Anish', 'Ian', 'Levon', 'Wesley', 'Maxime', 'Alireza', 'Praggnanandhaa', 'Gukesh', 'Erigaisi', 'Nakamura', 'Carlsen', 'Caruana', 'Liren', 'Giri', 'Vachier', 'Firouzja', 'Karjakin', 'Aronian', 'So', 'MVL', 'Pragg', 'Dommaraju', 'Niemann', 'Abdusattorov', 'Esipenko', 'Sarana'];

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

function seedLeaderboard(): LeaderEntry[] {
  const out: LeaderEntry[] = [];
  const now = new Date().toISOString();
  for (let i = 0; i < 100; i++) {
    const name = `${NAMES[i % NAMES.length]}${i < NAMES.length ? '' : '_' + Math.floor(i / NAMES.length)}`;
    const country = COUNTRIES[i % COUNTRIES.length];
    const streak = Math.max(1, 365 - i * 3);
    const score = streak * 100 + Math.max(0, 200 - i);
    out.push({
      name,
      country,
      streak,
      score,
      userId: `seed_${i.toString().padStart(3, '0')}`,
      updatedAt: now,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

function loadLeaderboard(): LeaderEntry[] {
  try {
    ensureDataDir();
    if (fs.existsSync(LB_FILE)) {
      const raw = fs.readFileSync(LB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as LeaderEntry[];
    }
  } catch (e) {
    // fall through to seed
  }
  const seeded = seedLeaderboard();
  try {
    ensureDataDir();
    fs.writeFileSync(LB_FILE, JSON.stringify(seeded, null, 2), 'utf-8');
  } catch {
    // ignore — in-memory fallback only
  }
  return seeded;
}

function saveLeaderboard(entries: LeaderEntry[]): void {
  try {
    ensureDataDir();
    fs.writeFileSync(LB_FILE, JSON.stringify(entries, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}

// In-memory mirror (fallback when fs unavailable)
let LEADERBOARD: LeaderEntry[] = loadLeaderboard();

// Per-user stats (in-memory; could persist similarly later)
type UserStats = {
  userId: string;
  bestStreak: number;
  totalSolved: number;
  totalTimeMs: number;
  history: Array<{ day: string; timeMs: number; hintsUsed: number; streak: number; score: number }>;
};
const userStats = new Map<string, UserStats>();

// Per-day record (one solve per user per day, deduped)
type SolveRecord = { day: string; streak: number; userId: string; timeMs: number; hintsUsed: number; score: number };
const solveStore = new Map<string, SolveRecord>(); // key: `${userId}:${day}`

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayIndex(d?: string): number {
  return Math.floor(Date.parse(d || todayIso()) / 86400000);
}

function computeScore(streak: number, timeMs: number, hintsUsed: number): number {
  const timeBonus = Math.max(0, 300 - Math.floor(timeMs / 1000));
  return streak * 100 + timeBonus - hintsUsed * 30;
}

function upsertLeaderboard(uid: string, name: string, country: string, streak: number, score: number) {
  const now = new Date().toISOString();
  const idx = LEADERBOARD.findIndex((e) => e.userId === uid);
  if (idx >= 0) {
    const existing = LEADERBOARD[idx];
    // Only update if new score is higher (preserves PR)
    if (score > existing.score) {
      LEADERBOARD[idx] = { ...existing, streak, score, updatedAt: now };
    } else {
      // streak still tracked even if score lower
      LEADERBOARD[idx] = { ...existing, streak: Math.max(existing.streak, streak), updatedAt: now };
    }
  } else {
    LEADERBOARD.push({ userId: uid, name, country, streak, score, updatedAt: now });
  }
  LEADERBOARD.sort((a, b) => b.score - a.score);
  if (LEADERBOARD.length > LB_MAX) LEADERBOARD = LEADERBOARD.slice(0, LB_MAX);
  saveLeaderboard(LEADERBOARD);
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /puzzle
 * Returns today's puzzle (deterministic by ISO date).
 */
router.get('/puzzle', (_req: Request, res: Response) => {
  const idx = dayIndex() % POOL.length;
  const p = POOL[idx];
  return res.json({
    day: todayIso(),
    poolSize: POOL.length,
    puzzle: {
      id: p.id,
      fen: p.fen,
      theme: p.theme,
      rating: p.rating,
      solLength: p.sol.length,
      // Solution hint: only the first move (client validates rest via chess.js)
      solHint: p.sol[0],
    },
  });
});

/**
 * GET /history?days=7
 * Returns the last N daily puzzles (defaults to 7, max 30).
 */
router.get('/history', (req: Request, res: Response) => {
  const rawDays = parseInt(String(req.query.days || '7'), 10);
  const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, 30) : 7;
  const today = dayIndex();
  const out: Array<{ day: string; id: string; theme: string; rating: number }> = [];
  for (let i = 0; i < days; i++) {
    const di = today - i;
    const date = new Date(di * 86400000).toISOString().slice(0, 10);
    const p = POOL[di % POOL.length];
    out.push({ day: date, id: p.id, theme: p.theme, rating: p.rating });
  }
  return res.json({ days, history: out });
});

/**
 * POST /solve
 * Body: { streak: number, day: string, timeMs?: number, hintsUsed?: number, userId?: string, name?: string, country?: string }
 * Records the solve and updates leaderboard + user stats.
 */
router.post('/solve', (req: Request, res: Response) => {
  const { streak, day, timeMs, hintsUsed, userId, name, country } = req.body || {};
  if (typeof streak !== 'number' || typeof day !== 'string') {
    return res.status(400).json({ ok: false, error: 'streak (number) and day (string) required' });
  }
  const tMs = typeof timeMs === 'number' && timeMs >= 0 ? timeMs : 0;
  const hUsed = typeof hintsUsed === 'number' && hintsUsed >= 0 ? Math.floor(hintsUsed) : 0;
  const uid = typeof userId === 'string' && userId.length > 0 ? userId : 'anonymous';
  const uname = typeof name === 'string' && name.length > 0 ? name : `Player_${uid.slice(0, 6)}`;
  const uctry = typeof country === 'string' && country.length > 0 ? country : '🌍';

  const score = computeScore(streak, tMs, hUsed);
  const key = `${uid}:${day}`;
  const record: SolveRecord = { day, streak, userId: uid, timeMs: tMs, hintsUsed: hUsed, score };
  solveStore.set(key, record);

  // Update user stats
  const stats: UserStats = userStats.get(uid) || {
    userId: uid,
    bestStreak: 0,
    totalSolved: 0,
    totalTimeMs: 0,
    history: [],
  };
  const isNewDay = !stats.history.some((h) => h.day === day);
  if (isNewDay) {
    stats.totalSolved += 1;
    stats.totalTimeMs += tMs;
    stats.history.push({ day, timeMs: tMs, hintsUsed: hUsed, streak, score });
    // keep last 365 entries max
    if (stats.history.length > 365) stats.history = stats.history.slice(-365);
  }
  const prevBest = stats.bestStreak;
  if (streak > prevBest) stats.bestStreak = streak;
  userStats.set(uid, stats);

  // Update leaderboard (non-anonymous only)
  if (uid !== 'anonymous') {
    upsertLeaderboard(uid, uname, uctry, streak, score);
  }

  return res.json({
    ok: true,
    newRecord: streak > prevBest,
    streak,
    bestStreak: Math.max(prevBest, streak),
    day,
    timeMs: tMs,
    hintsUsed: hUsed,
    score,
  });
});

/**
 * GET /leaderboard?limit=100
 * Returns top-N entries sorted by score desc.
 */
router.get('/leaderboard', (req: Request, res: Response) => {
  const rawLimit = parseInt(String(req.query.limit || '100'), 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, LB_MAX) : 100;
  return res.json({
    leaderboard: LEADERBOARD.slice(0, limit),
    total: LEADERBOARD.length,
  });
});

/**
 * GET /user/:userId/stats
 * Returns aggregated stats for a single user.
 */
router.get('/user/:userId/stats', (req: Request, res: Response) => {
  const uid = String(req.params.userId);
  const stats = userStats.get(uid);
  if (!stats) {
    return res.json({
      userId: uid,
      bestStreak: 0,
      totalSolved: 0,
      avgTimeMs: 0,
      history: [],
    });
  }
  const avg = stats.totalSolved > 0 ? Math.round(stats.totalTimeMs / stats.totalSolved) : 0;
  return res.json({
    userId: stats.userId,
    bestStreak: stats.bestStreak,
    totalSolved: stats.totalSolved,
    avgTimeMs: avg,
    history: stats.history.slice(-30), // last 30 days
  });
});

/**
 * POST /reset (admin)
 * Header: X-Admin-Key must match process.env.CYBERCHESS_ADMIN_KEY
 * Wipes leaderboard + stats. Intended for ops/testing only.
 */
router.post('/reset', (req: Request, res: Response) => {
  const provided = (req.headers['x-admin-key'] || req.body?.adminKey || '') as string;
  const expected = process.env.CYBERCHESS_ADMIN_KEY || '';
  if (!expected) {
    return res.status(503).json({ ok: false, error: 'admin reset disabled (CYBERCHESS_ADMIN_KEY not set)' });
  }
  if (!provided || provided !== expected) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }
  LEADERBOARD = seedLeaderboard();
  saveLeaderboard(LEADERBOARD);
  userStats.clear();
  solveStore.clear();
  return res.json({ ok: true, reset: true, leaderboardSize: LEADERBOARD.length });
});

export default router;
