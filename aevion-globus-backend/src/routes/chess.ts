// AEVION CyberChess — public stats & leaderboard API
//
// All data is simulated (no real DB for now).  Three endpoints:
//   GET /api/chess/leaderboard?category=rating|puzzles|rush  — top-50 list
//   GET /api/chess/daily-puzzle                              — day-of-week puzzle seed
//   GET /api/chess/stats                                     — aggregate platform counters

import { Router, type Request, type Response } from "express";

export const chessRouter = Router();

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  username: string;
  rating: number;
  puzzlesSolved: number;
  rushScore: number;
  gamesPlayed: number;
  winRate: number;
  country: string;
  badge?: string;
}

interface DailyPuzzle {
  id: string;
  fen: string;
  solution: string[];
  difficulty: "beginner" | "intermediate" | "advanced" | "expert";
  theme: string;
  description: string;
  dayOfWeek: number;
}

// ─── Seed data ────────────────────────────────────────────────────────────────

// 7 puzzles — one per day of the week (0 = Sunday … 6 = Saturday).
// FENs are well-known tactical positions, solutions expressed as UCI move sequences.
const DAILY_PUZZLES: DailyPuzzle[] = [
  {
    id: "dp_sunday",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    solution: ["f3g5", "f6e4", "g5f7"],
    difficulty: "beginner",
    theme: "Fork",
    description: "White to move — find the knight fork winning material.",
    dayOfWeek: 0,
  },
  {
    id: "dp_monday",
    fen: "r3k2r/ppp2ppp/2n1b3/3Np3/4P1b1/3P1N2/PPP2PPP/R1BQR1K1 b kq - 0 10",
    solution: ["g4f3", "g2f3", "e6h3"],
    difficulty: "intermediate",
    theme: "Pin",
    description: "Black to move — exploit the pin on g2 to win material.",
    dayOfWeek: 1,
  },
  {
    id: "dp_tuesday",
    fen: "2r3k1/1ppq1ppp/p2p4/3Pp3/4P3/2P2N2/PP3PPP/R2Q2K1 w - - 0 18",
    solution: ["f3e5", "d7e7", "e5f7"],
    difficulty: "intermediate",
    theme: "Sacrifice",
    description: "White to move — sacrifice to open the king position.",
    dayOfWeek: 2,
  },
  {
    id: "dp_wednesday",
    fen: "6k1/pp4p1/2p3Pp/8/3P4/2PB4/PP1K4/8 w - - 0 30",
    solution: ["d3h7", "g8h7", "g6g7"],
    difficulty: "beginner",
    theme: "Passed Pawn",
    description: "White to move — create a decisive passed pawn.",
    dayOfWeek: 3,
  },
  {
    id: "dp_thursday",
    fen: "r4rk1/ppp2ppp/2n1bn2/3qp3/3P4/2PBP3/PP3PPP/R1BQK2R w KQ - 4 10",
    solution: ["d4e5", "d5d1", "e1d1", "f6e4"],
    difficulty: "advanced",
    theme: "Queen Exchange",
    description: "White to move — find the tactical sequence to win a pawn.",
    dayOfWeek: 4,
  },
  {
    id: "dp_friday",
    fen: "1r1q1rk1/pb1n1ppp/1p2p3/2ppN3/3P1B2/2PB4/PP3PPP/R2Q1RK1 w - - 0 14",
    solution: ["e5f7", "f8f7", "f4e5", "d8e7", "e5b8"],
    difficulty: "advanced",
    theme: "Combination",
    description: "White to move — multi-step tactical combination wins the exchange.",
    dayOfWeek: 5,
  },
  {
    id: "dp_saturday",
    fen: "r2qr1k1/ppp2pp1/2nb3p/3pp3/3P4/2N1PN2/PPP1BPPP/R1BQR1K1 b - - 0 12",
    solution: ["d5d4", "e3d5", "c6d4", "d5b4", "d4e2"],
    difficulty: "expert",
    theme: "Discovered Attack",
    description: "Black to move — unleash a devastating discovered attack.",
    dayOfWeek: 6,
  },
];

// Country codes for fake leaderboard variety
const COUNTRIES = ["KZ", "RU", "UA", "PL", "DE", "IN", "US", "CN", "FR", "BR"];

// Fixed list of 60 seeded usernames so the leaderboard is stable across requests
const USERNAMES: string[] = [
  "MagnusK_777", "LeoTigrov", "AstanaKnight", "QueenSlayer9", "BishopRush",
  "PawnStorm88", "NimzoIndian", "Caro_Kann_Fan", "SicilianDragon", "DutchDefense",
  "RookEndgame", "BlitzMaster_KZ", "TacticsKing", "EndgameWizard", "OpeningBook",
  "KingHunt_Pro", "ForkFactory", "SkeweredPin", "ZugzwangKing", "TacticsBomber",
  "GrandmasterBot", "SacrificeKing", "CheckMate_Fast", "CastlingLong", "EnPassant_Pro",
  "PawnPromotion", "KnightOutpost", "BishopPair_KZ", "DoubledPawns_No", "IsolatedPawn",
  "ChessSniper", "EloClimber", "RatingRocket", "OpenFileRook", "SeventhRankRook",
  "AlmightyQueen", "ThreeChecks", "AtomicChess1", "KingOfTheHill", "CrazyHouseKing",
  "FischerFan960", "ChessPoet", "PositionalGenius", "SharpAttacker", "SolidDefender",
  "CounterPuncher", "StrategicMind", "TacticalEye", "ComboBreaker", "TimeTrouble",
  "IncrementLover", "BulletChess_1", "BlitzBeast_2", "RapidKing_3", "ClassicalPro_4",
  "CorresChamp_5", "PuzzleHunter", "StreakMaster", "DailyPuzzle99", "ELO_Booster",
];

// Deterministic pseudo-random from seed (linear congruential generator)
function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function generateLeaderboard(category: string): LeaderboardEntry[] {
  const seed = category === "puzzles" ? 42 : category === "rush" ? 99 : 7;
  const rand = lcg(seed);
  const count = 50;

  const entries: LeaderboardEntry[] = [];
  const usedUsernames = new Set<string>();

  for (let i = 0; i < count; i++) {
    // Pick unique username
    let username = "";
    let attempts = 0;
    do {
      const idx = Math.floor(rand() * USERNAMES.length);
      username = USERNAMES[idx];
      attempts++;
    } while (usedUsernames.has(username) && attempts < 200);
    usedUsernames.add(username);

    const baseRating = Math.round(2800 - i * 30 - rand() * 20);
    const puzzlesSolved = Math.round(5000 - i * 80 - rand() * 200);
    const rushScore = Math.round(3200 - i * 55 - rand() * 100);
    const gamesPlayed = Math.round(500 + rand() * 2000);
    const winRate = Math.round((60 - i * 0.4 - rand() * 5) * 10) / 10;
    const country = COUNTRIES[Math.floor(rand() * COUNTRIES.length)];

    let badge: string | undefined;
    if (i === 0) badge = "champion";
    else if (i < 3) badge = "grandmaster";
    else if (i < 10) badge = "master";

    entries.push({
      rank: i + 1,
      username,
      rating: Math.max(1200, baseRating),
      puzzlesSolved: Math.max(0, puzzlesSolved),
      rushScore: Math.max(0, rushScore),
      gamesPlayed: Math.max(1, gamesPlayed),
      winRate: Math.max(30, Math.min(95, winRate)),
      country,
      badge,
    });
  }

  // Sort by the requested category
  if (category === "puzzles") {
    entries.sort((a, b) => b.puzzlesSolved - a.puzzlesSolved);
  } else if (category === "rush") {
    entries.sort((a, b) => b.rushScore - a.rushScore);
  }
  // For "rating" (default) — already sorted

  // Re-rank after sort
  entries.forEach((e, idx) => {
    e.rank = idx + 1;
    if (idx === 0) e.badge = "champion";
    else if (idx < 3) e.badge = "grandmaster";
    else if (idx < 10) e.badge = "master";
    else e.badge = undefined;
  });

  return entries;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/chess/leaderboard?category=rating|puzzles|rush
chessRouter.get("/leaderboard", (req: Request, res: Response) => {
  const raw = (req.query.category as string) || "rating";
  const VALID = ["rating", "puzzles", "rush"] as const;
  type Category = typeof VALID[number];
  const category: Category = (VALID as readonly string[]).includes(raw)
    ? (raw as Category)
    : "rating";

  const entries = generateLeaderboard(category);

  return res.json({
    category,
    total: entries.length,
    updatedAt: new Date().toISOString(),
    entries,
  });
});

// GET /api/chess/daily-puzzle
chessRouter.get("/daily-puzzle", (_req: Request, res: Response) => {
  const dayOfWeek = new Date().getDay(); // 0 = Sunday
  const puzzle = DAILY_PUZZLES.find((p) => p.dayOfWeek === dayOfWeek) ?? DAILY_PUZZLES[0];

  return res.json({
    date: new Date().toISOString().slice(0, 10),
    dayOfWeek,
    puzzle,
  });
});

// GET /api/chess/stats
chessRouter.get("/stats", (_req: Request, res: Response) => {
  return res.json({
    updatedAt: new Date().toISOString(),
    platform: {
      totalUsers: 18_420,
      activeUsersToday: 1_247,
      totalGamesPlayed: 2_384_651,
      totalPuzzlesSolved: 7_193_042,
      totalTournaments: 842,
      activeTournamentsNow: 3,
    },
    ratings: {
      averageRating: 1_534,
      highestRating: 2_791,
      lowestRating: 800,
      ratingDistribution: {
        "800-1000": 2_318,
        "1001-1200": 4_107,
        "1201-1400": 5_023,
        "1401-1600": 3_498,
        "1601-1800": 2_111,
        "1801-2000": 847,
        "2001+": 516,
      },
    },
    puzzles: {
      totalAvailable: 5_818,
      solvedToday: 12_384,
      averageSolveTimeMs: 43_200,
      popularThemes: ["Fork", "Pin", "Skewer", "Discovered Attack", "Checkmate in 2"],
    },
    topCountries: [
      { country: "KZ", users: 4_218 },
      { country: "RU", users: 3_741 },
      { country: "IN", users: 2_109 },
      { country: "US", users: 1_884 },
      { country: "PL", users: 1_203 },
    ],
  });
});
