import { Router, Request, Response } from 'express';

const router = Router();

type Puzzle = {
  id: string;
  fen: string;
  sol: string[];
  theme: string;
  rating: number;
};

// Mock pool of 30 puzzles (mirrors frontend pool)
const POOL: Puzzle[] = [
  { id: 'p01', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1', sol: ['f3e5', 'c6e5', 'c4f7'], theme: 'Fork', rating: 1200 },
  { id: 'p02', fen: 'r3k2r/ppp2ppp/2n1bn2/2bqp3/2B1P3/2NP1N2/PPPQ1PPP/R1B1K2R w KQkq - 0 1', sol: ['c3d5', 'f6d5', 'e4d5'], theme: 'Pin', rating: 1450 },
  { id: 'p03', fen: 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 1', sol: ['c4f7', 'g8f7', 'f3g5'], theme: 'Sacrifice', rating: 1600 },
  { id: 'p04', fen: '2kr3r/ppp2ppp/2n1b3/3qp3/3PnB2/2N1PN2/PPP2PPP/R2QKB1R w KQ - 0 1', sol: ['d4e5', 'c6e5', 'f3e5'], theme: 'Double attack', rating: 1500 },
  { id: 'p05', fen: 'r2qkb1r/ppp2ppp/2n1bn2/3p4/3P4/2N1PN2/PPP1BPPP/R1BQK2R w KQkq - 0 1', sol: ['c3d5', 'c6d4', 'd5f6'], theme: 'Discovered attack', rating: 1700 },
  { id: 'p06', fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 1', sol: ['f3e5', 'c6e5', 'd3d4'], theme: 'Tactic', rating: 1300 },
  { id: 'p07', fen: 'r4rk1/pppq1ppp/2n1bn2/3p4/3P4/2NBPN2/PPPQ1PPP/R4RK1 w - - 0 1', sol: ['d3h7', 'g8h7', 'f3g5'], theme: 'Greek gift', rating: 1800 },
  { id: 'p08', fen: 'r2q1rk1/ppp1bppp/2np1n2/4p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 1', sol: ['c4f7', 'f8f7', 'f3g5'], theme: 'Sacrifice', rating: 1550 },
  { id: 'p09', fen: 'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 1', sol: ['c4d5', 'e6d5', 'c3d5'], theme: 'Opening trap', rating: 1100 },
  { id: 'p10', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1', sol: ['c4f7', 'e8f7', 'f3e5'], theme: 'Fried liver', rating: 1400 },
  { id: 'p11', fen: 'r2qk2r/ppp1bppp/2n2n2/3p4/3P4/2N1PN2/PPP1BPPP/R1BQ1RK1 w kq - 0 1', sol: ['c3d5', 'f6d5', 'e2c4'], theme: 'Pin', rating: 1650 },
  { id: 'p12', fen: '2r2rk1/pp1q1ppp/2n1bn2/3p4/3P4/2NBPN2/PPPQ1PPP/2KR3R w - - 0 1', sol: ['d3h7', 'g8h7', 'd2h6'], theme: 'Mating net', rating: 1900 },
  { id: 'p13', fen: 'r1b1k2r/pppp1ppp/2n2q2/2b1n3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w kq - 0 1', sol: ['f3e5', 'f6e5', 'c1f4'], theme: 'Tactic', rating: 1500 },
  { id: 'p14', fen: 'rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 1', sol: ['c4f7', 'e8f7', 'c3d5'], theme: 'Italian trap', rating: 1350 },
  { id: 'p15', fen: '3r1rk1/ppq2ppp/2n1bn2/3p4/3P4/2NBPN2/PPPQ1PPP/2KR3R w - - 0 1', sol: ['c3d5', 'f6d5', 'd3h7'], theme: 'Combination', rating: 1750 },
  { id: 'p16', fen: 'r1bqkbnr/ppp2ppp/2n5/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1', sol: ['e4d5', 'd8d5', 'b1c3'], theme: 'Center', rating: 1000 },
  { id: 'p17', fen: 'r4rk1/pp1q1ppp/2nbbn2/3p4/3P4/2NBPN2/PPPQ1PPP/R4RK1 w - - 0 1', sol: ['d3h7', 'g8h7', 'f3g5'], theme: 'Greek gift', rating: 1850 },
  { id: 'p18', fen: 'r1b2rk1/ppp1qppp/2nb1n2/3p4/3P4/2NBPN2/PPPQ1PPP/R1B2RK1 w - - 0 1', sol: ['c3d5', 'f6d5', 'd3h7'], theme: 'Double attack', rating: 1700 },
  { id: 'p19', fen: 'r2qkb1r/ppp2ppp/2n1bn2/3pp3/3P4/2N1PN2/PPP1BPPP/R1BQK2R w KQkq - 0 1', sol: ['d4e5', 'c6e5', 'f3e5'], theme: 'Tactic', rating: 1450 },
  { id: 'p20', fen: 'rnbqkbnr/pp3ppp/4p3/2pp4/3P4/2N1P3/PPP2PPP/R1BQKBNR w KQkq - 0 1', sol: ['c3b5', 'd5d4', 'b5d6'], theme: 'Knight outpost', rating: 1250 },
  { id: 'p21', fen: 'r1bq1rk1/ppp1bppp/2np1n2/4p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 1', sol: ['c4f7', 'f8f7', 'f3g5'], theme: 'Sacrifice', rating: 1600 },
  { id: 'p22', fen: '2rq1rk1/pp1bbppp/2n1pn2/3p4/3P4/2NBPN2/PPPQ1PPP/2KR3R w - - 0 1', sol: ['d3h7', 'g8h7', 'd2h6'], theme: 'Attack', rating: 1950 },
  { id: 'p23', fen: 'r1bqk2r/ppp1bppp/2n2n2/3pp3/3P4/2N1PN2/PPP1BPPP/R1BQK2R w KQkq - 0 1', sol: ['d4e5', 'c6e5', 'c3d5'], theme: 'Combination', rating: 1550 },
  { id: 'p24', fen: 'rnb1k2r/ppp1qppp/3p1n2/4p3/1bP1P3/2N2N2/PPQP1PPP/R1B1KB1R w KQkq - 0 1', sol: ['a2a3', 'b4c3', 'd2c3'], theme: 'Bishop trap', rating: 1400 },
  { id: 'p25', fen: 'r1bq1rk1/pp2bppp/2np1n2/4p3/2B1P3/2NP1N2/PPPB1PPP/R2Q1RK1 w - - 0 1', sol: ['c4f7', 'g8f7', 'f3g5'], theme: 'Sacrifice', rating: 1650 },
  { id: 'p26', fen: 'r2qk2r/ppp1bppp/2n1bn2/3p4/3P4/2NBPN2/PPP2PPP/R1BQ1RK1 w kq - 0 1', sol: ['c3d5', 'f6d5', 'd3h7'], theme: 'Tactic', rating: 1700 },
  { id: 'p27', fen: '3r1rk1/pp1q1ppp/2nbbn2/3p4/3P4/1QNBPN2/PPP2PPP/2KR3R w - - 0 1', sol: ['b3b7', 'c6a5', 'b7a7'], theme: 'Queen raid', rating: 1850 },
  { id: 'p28', fen: 'r1bqkb1r/pp3ppp/2np1n2/4p3/3PP3/2N2N2/PPP2PPP/R1BQKB1R w KQkq - 0 1', sol: ['d4e5', 'd6e5', 'd1d8'], theme: 'Queen trade', rating: 1500 },
  { id: 'p29', fen: 'r2q1rk1/ppp2ppp/2nb1n2/3p4/3P4/2NBPN2/PPP1QPPP/R1B2RK1 w - - 0 1', sol: ['d3h7', 'g8h7', 'f3g5'], theme: 'Greek gift', rating: 1800 },
  { id: 'p30', fen: 'rnbqk2r/pp2bppp/4pn2/2pp4/3P4/2N1PN2/PPP1BPPP/R1BQK2R w KQkq - 0 1', sol: ['d4c5', 'b8d7', 'b2b4'], theme: 'Pawn grab', rating: 1300 },
];

// In-memory storage
type SolveRecord = { day: string; streak: number; userId: string };
const solveStore = new Map<string, SolveRecord>(); // key: `${userId}:${day}`
const streakStore = new Map<string, number>(); // key: userId -> best streak

type LeaderEntry = { name: string; streak: number; country: string };
const COUNTRIES = ['🇷🇺', '🇺🇸', '🇩🇪', '🇫🇷', '🇪🇸', '🇮🇹', '🇰🇿', '🇺🇦', '🇵🇱', '🇧🇷', '🇨🇳', '🇯🇵', '🇮🇳', '🇬🇧', '🇰🇷', '🇳🇱', '🇸🇪', '🇳🇴', '🇫🇮', '🇦🇷'];
const NAMES = ['Magnus', 'Hikaru', 'Fabiano', 'Ding', 'Anish', 'Ian', 'Levon', 'Wesley', 'Maxime', 'Alireza', 'Praggnanandhaa', 'Gukesh', 'Erigaisi', 'Nakamura', 'Carlsen', 'Caruana', 'Liren', 'Giri', 'Vachier', 'Firouzja', 'Karjakin', 'Aronian', 'So', 'MVL', 'Pragg', 'Dommaraju', 'Niemann', 'Abdusattorov', 'Esipenko', 'Sarana'];

const MOCK_LEADERBOARD: LeaderEntry[] = (() => {
  const out: LeaderEntry[] = [];
  for (let i = 0; i < 100; i++) {
    const name = `${NAMES[i % NAMES.length]}${i < NAMES.length ? '' : '_' + Math.floor(i / NAMES.length)}`;
    const country = COUNTRIES[i % COUNTRIES.length];
    const streak = Math.max(1, 365 - i * 3);
    out.push({ name, country, streak });
  }
  return out.sort((a, b) => b.streak - a.streak);
})();

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayIndex(): number {
  return Math.floor(Date.parse(todayIso()) / 86400000);
}

/**
 * GET /puzzle
 * Returns today's puzzle (deterministic by ISO date).
 */
router.get('/puzzle', (_req: Request, res: Response) => {
  const idx = dayIndex() % POOL.length;
  const p = POOL[idx];
  return res.json({
    day: todayIso(),
    puzzle: {
      id: p.id,
      fen: p.fen,
      theme: p.theme,
      rating: p.rating,
      // do NOT expose solution in real prod; mock returns first move only for client validation parity
      solHint: p.sol[0],
    },
  });
});

/**
 * POST /solve
 * Body: { streak: number, day: string, userId?: string }
 * Echoes the streak and returns whether it's a new personal record.
 */
router.post('/solve', (req: Request, res: Response) => {
  const { streak, day, userId } = req.body || {};
  if (typeof streak !== 'number' || typeof day !== 'string') {
    return res.status(400).json({ ok: false, error: 'streak (number) and day (string) required' });
  }
  const uid = typeof userId === 'string' && userId.length > 0 ? userId : 'anonymous';
  const key = `${uid}:${day}`;
  solveStore.set(key, { day, streak, userId: uid });

  const prevBest = streakStore.get(uid) || 0;
  const newRecord = streak > prevBest;
  if (newRecord) streakStore.set(uid, streak);

  return res.json({
    ok: true,
    newRecord,
    streak,
    bestStreak: Math.max(prevBest, streak),
    day,
  });
});

/**
 * GET /leaderboard?limit=100
 * Returns mock top-N leaderboard.
 */
router.get('/leaderboard', (req: Request, res: Response) => {
  const rawLimit = parseInt(String(req.query.limit || '100'), 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 100;
  return res.json({
    leaderboard: MOCK_LEADERBOARD.slice(0, limit),
    total: MOCK_LEADERBOARD.length,
  });
});

export default router;
